import { useMemo, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  RefreshControl,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { Button, IconButton, Text, useTheme } from 'react-native-paper';
import { addDays, startOfWeek, format, isToday } from 'date-fns';
import type { Course, Semester, TimeSlot } from '@/types';
import {
  findSemesterForDate,
  getWeekNumberForDate,
  isWeekInRange,
  matchesRepeatRule,
  formatTimeSlot,
} from '@/utils/scheduleDate';
import { useCourseStore } from '@/stores/courseStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ROW_HEIGHT = 56;
const TIME_COLUMN_WIDTH = 44;
const DAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

interface Props {
  semesters: Semester[];
  onEdit?: (course: Course) => void;
}

interface CourseInstance {
  course: Course;
  sections: number[];
  slot: TimeSlot;
}

interface RenderedBlock {
  course: Course;
  slot: TimeSlot;
  sections: number[];
  firstSection: number;
}

export function CourseSchedule({ semesters, onEdit }: Props) {
  const theme = useTheme();
  const ts = useMemo(() => createThemedStyles(theme), [theme]);
  const courses = useCourseStore((s) => s.courses);
  const deleteCourse = useCourseStore((s) => s.deleteCourse);
  const [weekOffset, setWeekOffset] = useState(0);
  const [dayMode, setDayMode] = useState<7 | 3>(7);
  const [refreshing, setRefreshing] = useState(false);
  const [detailCourse, setDetailCourse] = useState<Course | null>(null);
  const [scale] = useState(() => new Animated.Value(1));

  const anchor = addDays(new Date(), weekOffset * 7);
  const semester = findSemesterForDate(anchor, semesters);
  const isDefault = semesters.length === 0 || semester.id === 'default';
  const weekNumber = getWeekNumberForDate(anchor, semester);
  const inSemesterRange = !isDefault && weekNumber >= 1 && weekNumber <= semester.weekCount;

  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const days =
    dayMode === 7
      ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
      : [anchor, addDays(anchor, 1), addDays(anchor, 2)];

  const columnWidth = (SCREEN_WIDTH - TIME_COLUMN_WIDTH) / days.length;

  const animateWeek = useCallback(
    (toValue: number) => {
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.96, duration: 120, useNativeDriver: false }),
        Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: false }),
      ]).start();
      setWeekOffset(toValue);
    },
    [scale],
  );

  const getInstancesForDay = (date: Date): CourseInstance[] => {
    const dow = ((date.getDay() + 6) % 7) + 1;
    const instances: CourseInstance[] = [];
    for (const course of courses) {
      if (course.semesterId !== semester.id) {
        continue;
      }
      for (const slot of course.timeSlots) {
        if (slot.dayOfWeek !== dow) {
          continue;
        }
        if (!isWeekInRange(weekNumber, slot.weekRange)) {
          continue;
        }
        if (!matchesRepeatRule(weekNumber, slot.repeatRule)) {
          continue;
        }
        instances.push({ course, sections: slot.classSections, slot });
      }
    }
    return instances;
  };

  const getBlocksForDay = (date: Date): RenderedBlock[] => {
    const instances = getInstancesForDay(date);
    const blocks: RenderedBlock[] = [];
    const covered = new Set<string>();
    for (const inst of instances) {
      const key = `${inst.course.id}-${inst.slot.dayOfWeek}`;
      if (covered.has(key)) {
        continue;
      }
      covered.add(key);
      blocks.push({
        course: inst.course,
        slot: inst.slot,
        sections: inst.sections,
        firstSection: Math.min(...inst.sections),
      });
    }
    return blocks;
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 300);
  };

  const handleDelete = (course: Course) => {
    Alert.alert('删除课程', `确定删除「${course.name}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          deleteCourse(course.id);
          setDetailCourse(null);
        },
      },
    ]);
  };

  const stripCampusPrefix = (location?: string): string | undefined => {
    if (!location) {
      return undefined;
    }
    const dashIndex = location.indexOf('-');
    if (dashIndex > 0 && /校区$/.test(location.slice(0, dashIndex))) {
      return location.slice(dashIndex + 1);
    }
    return location;
  };

  const currentDateStr = format(anchor, 'M月d日');
  const weekLabel = inSemesterRange ? `第${weekNumber}周` : '学期外';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
            {currentDateStr}
          </Text>
          <Text variant="bodySmall" style={{ color: isDefault ? theme.colors.outline : theme.colors.primary }}>
            {semester.name} · {weekLabel}
          </Text>
        </View>
        <View style={styles.dayToggle}>
          <Button
            compact
            mode={dayMode === 7 ? 'contained' : 'outlined'}
            onPress={() => setDayMode(7)}
          >
            7天
          </Button>
          <Button
            compact
            mode={dayMode === 3 ? 'contained' : 'outlined'}
            onPress={() => setDayMode(3)}
          >
            3天
          </Button>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={[ts.dayHeaderRow, { width: SCREEN_WIDTH }]}>
          <View style={{ width: TIME_COLUMN_WIDTH }} />
          {days.map((date) => {
            const today = isToday(date);
            return (
              <View
                key={date.toISOString()}
                style={[
                  ts.dayHeader,
                  { width: columnWidth },
                  today && { backgroundColor: `${theme.colors.primary}22` },
                ]}
              >
                <Text style={[ts.dayName, today && { color: theme.colors.primary }]}>
                  {DAY_NAMES[((date.getDay() + 6) % 7) + 1]}
                </Text>
                <Text style={[ts.dayDate, today && { color: theme.colors.primary, fontWeight: 'bold' }]}>
                  {format(date, 'd')}
                </Text>
              </View>
            );
          })}
        </View>

        <Animated.View style={[ts.gridBody, { transform: [{ scale }] }]}>
          <View style={{ width: TIME_COLUMN_WIDTH }}>
            {Array.from({ length: semester.sectionCount }, (_, i) => i + 1).map((sec) => (
              <View key={sec} style={[ts.timeCell, { height: ROW_HEIGHT }]}>
                <Text style={ts.timeText}>{sec}</Text>
                <Text style={ts.timeSubText}>
                  {semester.sectionTimes[sec - 1]?.start ?? ''}
                </Text>
              </View>
            ))}
          </View>

          {days.map((date) => {
            const blocks = inSemesterRange ? getBlocksForDay(date) : [];
            const dow = ((date.getDay() + 6) % 7) + 1;
            return (
              <View
                key={date.toISOString()}
                style={[
                  ts.dayColumn,
                  {
                    width: columnWidth,
                    height: semester.sectionCount * ROW_HEIGHT,
                  },
                  isToday(date) && { backgroundColor: `${theme.colors.primary}11` },
                ]}
              >
                {Array.from({ length: semester.sectionCount }, (_, i) => i + 1).map((sec) => (
                  <View
                    key={sec}
                    style={[ts.gridCell, { height: ROW_HEIGHT }, inSemesterRange ? null : ts.cellDisabled]}
                  />
                ))}
                {blocks.map((block, idx) => (
                  <TouchableOpacity
                    key={`${block.course.id}-${dow}-${idx}`}
                    activeOpacity={0.8}
                    onPress={() => setDetailCourse(block.course)}
                    style={[
                      ts.courseBlock,
                      {
                        top: (block.firstSection - 1) * ROW_HEIGHT + 2,
                        height: block.sections.length * ROW_HEIGHT - 4,
                        backgroundColor: block.course.color ?? theme.colors.primary,
                        opacity: isDefault || !inSemesterRange ? 0.4 : 1,
                      },
                    ]}
                  >
                    <Text style={ts.courseName} numberOfLines={2}>
                      {block.course.name}
                    </Text>
                    {block.sections.length * ROW_HEIGHT > 80 && block.course.location ? (
                      <Text style={ts.courseLoc} numberOfLines={1}>
                        {stripCampusPrefix(block.course.location)}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}
        </Animated.View>
        <View style={{ height: 80 }} />
      </ScrollView>

      <View style={styles.navBar}>
        <IconButton
          icon="chevron-left"
          size={28}
          iconColor={theme.colors.primary}
          onPress={() => animateWeek(weekOffset - 1)}
        />
        <Button
          mode="contained"
          textColor="white"
          buttonColor="#2ecc71"
          compact
          onPress={() => animateWeek(0)}
          disabled={weekOffset === 0}
        >
          返回本周
        </Button>
        <IconButton
          icon="chevron-right"
          size={28}
          iconColor={theme.colors.primary}
          onPress={() => animateWeek(weekOffset + 1)}
        />
      </View>

      <CourseDetailDialog
        course={detailCourse}
        onDismiss={() => setDetailCourse(null)}
        onEdit={(c) => {
          setDetailCourse(null);
          onEdit?.(c);
        }}
        onDelete={handleDelete}
      />
    </View>
  );
}

interface DetailProps {
  course: Course | null;
  onDismiss: () => void;
  onEdit: (c: Course) => void;
  onDelete: (c: Course) => void;
}

function CourseDetailDialog({ course, onDismiss, onEdit, onDelete }: DetailProps) {
  const theme = useTheme();
  const ts = useMemo(() => createThemedStyles(theme), [theme]);
  return (
    <Modal visible={course !== null} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={ts.dialog} onPress={(e) => e.stopPropagation()}>
          {course ? (
            <>
              <View style={[ts.dialogBar, { backgroundColor: course.color ?? '#3498db' }]}>
                <Text variant="titleLarge" style={ts.dialogTitle}>
                  {course.name}
                </Text>
              </View>
              <ScrollView style={ts.dialogBody}>
                <DetailRow label="课程代码" value={course.code} />
                <DetailRow label="地点" value={course.location} />
                <DetailRow label="教师" value={course.teacher} />
                <DetailRow label="学分" value={course.credits != null ? String(course.credits) : undefined} />
                <DetailRow label="考核方式" value={course.assessmentMethod} />
                <Text variant="labelLarge" style={ts.dialogSection}>
                  时间段
                </Text>
                {course.timeSlots.map((slot, i) => (
                  <Text key={i} style={ts.dialogText}>
                    {formatTimeSlot(slot)}
                  </Text>
                ))}
                {course.notes ? (
                  <>
                    <Text variant="labelLarge" style={ts.dialogSection}>
                      备注
                    </Text>
                    <Text style={ts.dialogText}>{course.notes}</Text>
                  </>
                ) : null}
              </ScrollView>
              <View style={ts.dialogActions}>
                <Button onPress={onDismiss}>关闭</Button>
                <Button mode="outlined" textColor="#e74c3c" onPress={() => onDelete(course)}>
                  删除
                </Button>
                <Button mode="contained" onPress={() => onEdit(course)}>
                  编辑
                </Button>
              </View>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  const theme = useTheme();
  const c = theme.colors;
  if (!value) {
    return null;
  }
  return (
    <View style={{ flexDirection: 'row', marginVertical: 2 }}>
      <Text style={{ width: 72, fontSize: 13, color: c.onSurfaceVariant }}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 13, color: c.onSurface }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  headerLeft: { flexDirection: 'column' },
  dayToggle: { flexDirection: 'row', gap: 4 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  navBar: { position: 'absolute', bottom: 16, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});

function createThemedStyles(theme: Record<string, unknown>) {
  const c = theme.colors as Record<string, string>;
  return StyleSheet.create({
    dayHeaderRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.outline },
    dayHeader: { alignItems: 'center', paddingVertical: 6 },
    dayName: { fontSize: 12, color: c.onSurfaceVariant },
    dayDate: { fontSize: 14, color: c.onSurface },
    gridBody: { flexDirection: 'row' },
    timeCell: { alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: c.surfaceVariant },
    timeText: { fontSize: 11, color: c.onSurfaceVariant, fontWeight: 'bold' },
    timeSubText: { fontSize: 9, color: c.outline },
    dayColumn: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: c.surfaceVariant },
    gridCell: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.surfaceVariant },
    cellDisabled: { backgroundColor: c.surfaceVariant },
    courseBlock: { position: 'absolute', left: 2, right: 2, borderRadius: 6, padding: 4, overflow: 'hidden' },
    courseName: { color: 'white', fontSize: 11, fontWeight: 'bold' },
    courseLoc: { color: 'rgba(255,255,255,0.85)', fontSize: 10, marginTop: 2 },
    dialog: { width: '85%', maxHeight: '75%', backgroundColor: c.surface, borderRadius: 12, overflow: 'hidden' },
    dialogBar: { padding: 16 },
    dialogTitle: { color: 'white', fontWeight: 'bold' },
    dialogBody: { padding: 16 },
    dialogSection: { marginTop: 8, marginBottom: 4, fontWeight: 'bold', color: c.onSurface },
    dialogText: { fontSize: 13, color: c.onSurfaceVariant, marginVertical: 2 },
    dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', padding: 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.surfaceVariant },
  });
}

export default CourseSchedule;
