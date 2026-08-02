import { memo, useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  Alert,
  PanResponder,
} from 'react-native';
import { Text } from 'react-native-paper';
import { addDays, startOfWeek, format, isToday } from 'date-fns';
import type { Course, Semester, TimeSlot } from '@/types';
import {
  findSemesterForDate,
  getWeekNumberForDate,
  isWeekInRange,
  matchesRepeatRule,
  toISODate,
} from '@/utils/scheduleDate';
import { useCourseStore } from '@/stores/courseStore';
import { useDesignTokens } from '@/hooks/useDesignTokens';
import { getOnColor } from '@/utils/color';
import { CourseDetailSheet } from '@/components/CourseDetailSheet';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ROW_HEIGHT = 52;
const TIME_COLUMN_WIDTH = 42;
const DAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

interface Props {
  semesters: Semester[];
  weekOffset: number;
  onWeekChange: (offset: number) => void;
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

export const CourseSchedule = memo(function CourseSchedule({ semesters, weekOffset, onWeekChange, onEdit }: Props) {
  const dt = useDesignTokens();
  const courses = useCourseStore((s) => s.courses);
  const deleteCourse = useCourseStore((s) => s.deleteCourse);
  const [dayMode, setDayMode] = useState<7 | 3>(7);
  const [refreshing, setRefreshing] = useState(false);
  const [detailCourse, setDetailCourse] = useState<Course | null>(null);

  const anchor = addDays(new Date(), weekOffset * 7);
  const semester = findSemesterForDate(anchor, semesters);
  const isDefault = semesters.length === 0 || semester.id === 'default';
  const weekNumber = getWeekNumberForDate(anchor, semester);
  const inSemesterRange = !isDefault && weekNumber >= 1 && weekNumber <= semester.weekCount;

  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const days = useMemo(
    () =>
      dayMode === 7
        ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
        : [anchor, addDays(anchor, 1), addDays(anchor, 2)],
    [dayMode, weekStart, anchor],
  );

  const columnWidth = (SCREEN_WIDTH - TIME_COLUMN_WIDTH) / days.length;

  const swipeThreshold = 25;
  const weekOffsetRef = useRef(weekOffset);
  useEffect(() => {
    weekOffsetRef.current = weekOffset;
  });
  const onWeekChangeRef = useRef(onWeekChange);
  useEffect(() => {
    onWeekChangeRef.current = onWeekChange;
  });
  const [panHandlers, setPanHandlers] = useState<object>({});
  useLayoutEffect(() => {
    const responder = PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy) * 0.6,
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > swipeThreshold) {
          onWeekChangeRef.current(weekOffsetRef.current - 1);
        } else if (gs.dx < -swipeThreshold) {
          onWeekChangeRef.current(weekOffsetRef.current + 1);
        }
      },
    });
    setPanHandlers(responder.panHandlers);
  }, []);

  // 预计算每天课程块，避免重复遍历 courses × slots（原 O(7 × courses × slots) → O(courses × slots)）
  const blocksByDay = useMemo(() => {
    const map = new Map<string, RenderedBlock[]>();
    for (const date of days) {
      const dateStr = toISODate(date);
      const dow = ((date.getDay() + 6) % 7) + 1;
      const instances: CourseInstance[] = [];
      for (const course of courses) {
        if (course.semesterId !== semester.id) continue;
        for (const slot of course.timeSlots) {
          if (slot.dayOfWeek !== dow) continue;
          if (!isWeekInRange(weekNumber, slot.weekRange)) continue;
          if (!matchesRepeatRule(weekNumber, slot.repeatRule)) continue;
          instances.push({ course, sections: slot.classSections, slot });
        }
      }
      const blocks: RenderedBlock[] = [];
      const covered = new Set<string>();
      for (const inst of instances) {
        const key = `${inst.course.id}-${inst.slot.dayOfWeek}`;
        if (covered.has(key)) continue;
        covered.add(key);
        blocks.push({
          course: inst.course,
          slot: inst.slot,
          sections: inst.sections,
          firstSection: Math.min(...inst.sections),
        });
      }
      map.set(dateStr, blocks);
    }
    return map;
  }, [days, courses, semester.id, weekNumber]);

  const getBlocksForDay = (date: Date): RenderedBlock[] => {
    return blocksByDay.get(toISODate(date)) ?? [];
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
    if (!location) return undefined;
    const dashIndex = location.indexOf('-');
    if (dashIndex > 0 && /校区$/.test(location.slice(0, dashIndex))) {
      return location.slice(dashIndex + 1);
    }
    return location;
  };

  const currentDateStr = format(anchor, 'M月d日');
  const weekLabel = inSemesterRange ? `第${weekNumber}周` : '学期外';

  return (
    <View style={[styles.container, { backgroundColor: dt.colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: dt.colors.surface, borderBottomColor: dt.colors.border }]}>
        <View style={styles.headerLeft}>
          <Text
            style={{ fontSize: dt.fontSize.subheading, fontWeight: dt.fontWeight.subheading, color: dt.colors.text }}
          >
            {currentDateStr}
          </Text>
          <Text
            style={{
              fontSize: dt.fontSize.caption,
              color: isDefault ? dt.colors.textMuted : dt.colors.primary,
              marginTop: 2,
            }}
          >
            {semester.name} · {weekLabel}
          </Text>
        </View>
        <View style={[styles.dayToggle, { backgroundColor: dt.colors.surfaceAlt }]}>
          <TouchableOpacity
            onPress={() => setDayMode(7)}
            style={[
              styles.toggleBtn,
              dayMode === 7 && { backgroundColor: dt.colors.primary },
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.toggleText,
                { color: dayMode === 7 ? dt.colors.onPrimary : dt.colors.textSecondary },
              ]}
            >
              7天
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setDayMode(3)}
            style={[
              styles.toggleBtn,
              dayMode === 3 && { backgroundColor: dt.colors.primary },
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.toggleText,
                { color: dayMode === 3 ? dt.colors.onPrimary : dt.colors.textSecondary },
              ]}
            >
              3天
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Grid */}
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={dt.colors.primary} />}
      >
        {/* Day Headers */}
        <View style={[styles.dayHeaderRow, { borderBottomColor: dt.colors.border, backgroundColor: dt.colors.bg }]}>
          <View style={{ width: TIME_COLUMN_WIDTH }} />
          {days.map((date) => {
            const today = isToday(date);
            const dowIndex = ((date.getDay() + 6) % 7) + 1;
            return (
              <View
                key={date.toISOString()}
                style={[
                  styles.dayHeader,
                  { width: columnWidth },
                ]}
              >
                {today ? (
                  <View style={[styles.todayPill, { backgroundColor: dt.colors.primary }]}>
                    <Text style={[styles.todayDayName, { color: dt.colors.bg }]}>
                      {DAY_NAMES[dowIndex]}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.dayName, { color: dt.colors.textMuted }]}>
                    {DAY_NAMES[dowIndex]}
                  </Text>
                )}
                <Text
                  style={[
                    styles.dayDateText,
                    { color: today ? dt.colors.primary : dt.colors.textSecondary },
                    today && { fontWeight: dt.fontWeight.heading },
                  ]}
                >
                  {format(date, 'd')}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Grid Body */}
        <View style={styles.gridBody} {...panHandlers}>
          {/* Time Column */}
          <View style={{ width: TIME_COLUMN_WIDTH }}>
            {Array.from({ length: semester.sectionCount }, (_, i) => i + 1).map((sec) => (
              <View key={sec} style={[styles.timeCell, { height: ROW_HEIGHT, borderRightColor: dt.colors.border }]}>
                <Text style={[styles.timeText, { color: dt.colors.textMuted }]}>{sec}</Text>
                <Text style={[styles.timeSubText, { color: dt.colors.textMuted }]}>
                  {semester.sectionTimes[sec - 1]?.start ?? ''}
                </Text>
              </View>
            ))}
          </View>

          {/* Day Columns */}
          {days.map((date) => {
            const blocks = inSemesterRange ? getBlocksForDay(date) : [];
            const dow = ((date.getDay() + 6) % 7) + 1;
            return (
              <View
                key={date.toISOString()}
                style={[
                  styles.dayColumn,
                  {
                    width: columnWidth,
                    height: semester.sectionCount * ROW_HEIGHT,
                    borderRightColor: dt.colors.border,
                  },
                  isToday(date) && { backgroundColor: `${dt.colors.primary}0D` },
                ]}
              >
                {Array.from({ length: semester.sectionCount }, (_, i) => i + 1).map((sec) => (
                  <View
                    key={sec}
                    style={[
                      styles.gridCell,
                      { height: ROW_HEIGHT, borderBottomColor: dt.colors.border },
                      !inSemesterRange && { backgroundColor: dt.colors.surfaceAlt },
                    ]}
                  />
                ))}
                {blocks.map((block, idx) => {
                  const blockColor = block.course.color ?? dt.colors.primary;
                  return (
                    <TouchableOpacity
                      key={`${block.course.id}-${dow}-${idx}`}
                      activeOpacity={0.85}
                      onPress={() => setDetailCourse(block.course)}
                      style={[
                        styles.courseBlock,
                        {
                          top: (block.firstSection - 1) * ROW_HEIGHT + 2,
                          height: block.sections.length * ROW_HEIGHT - 4,
                          backgroundColor: isDefault || !inSemesterRange
                            ? dt.colors.surfaceAlt
                            : blockColor,
                          borderColor: `${blockColor}40`,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.courseName,
                          {
                            color: isDefault || !inSemesterRange
                              ? dt.colors.textMuted
                              : getOnColor(blockColor),
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {block.course.name}
                      </Text>
                      {block.sections.length * ROW_HEIGHT > 76 && block.course.location ? (
                        <Text
                          style={[
                            styles.courseLoc,
                            {
                              color: isDefault || !inSemesterRange
                                ? dt.colors.textMuted
                                : getOnColor(blockColor, 0.85),
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {stripCampusPrefix(block.course.location)}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </View>
        <View style={{ height: 80 }} />
      </ScrollView>

      <CourseDetailSheet
        course={detailCourse}
        onDismiss={() => setDetailCourse(null)}
        onEdit={onEdit}
        onDelete={handleDelete}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flexDirection: 'column' },
  dayToggle: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 2,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dayHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
  },
  dayHeader: { alignItems: 'center', paddingVertical: 4 },
  todayPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  todayDayName: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  dayName: {
    fontSize: 12,
  },
  dayDateText: {
    fontSize: 14,
    marginTop: 2,
  },
  gridBody: { flexDirection: 'row' },
  timeCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  timeText: { fontSize: 11, fontWeight: 'bold' },
  timeSubText: { fontSize: 9, marginTop: 1 },
  dayColumn: {
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  gridCell: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  courseBlock: {
    position: 'absolute',
    left: 2,
    right: 2,
    borderRadius: 8,
    padding: 4,
    overflow: 'hidden',
  },
  courseName: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  courseLoc: {
    fontSize: 10,
    marginTop: 2,
  },
});

export default CourseSchedule;
