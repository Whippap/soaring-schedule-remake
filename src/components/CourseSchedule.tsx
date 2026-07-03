import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  Pressable,
  Alert,
  PanResponder,
} from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
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
import { useDesignTokens } from '@/hooks/useDesignTokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Icon } from '@/components/Icon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ROW_HEIGHT = 52;
const TIME_COLUMN_WIDTH = 42;
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
  const dt = useDesignTokens();
  const reduced = useReducedMotion();
  const courses = useCourseStore((s) => s.courses);
  const deleteCourse = useCourseStore((s) => s.deleteCourse);
  const [weekOffset, setWeekOffset] = useState(0);
  const [dayMode, setDayMode] = useState<7 | 3>(7);
  const [refreshing, setRefreshing] = useState(false);
  const [detailCourse, setDetailCourse] = useState<Course | null>(null);

  const scale = useSharedValue(1);
  const sheetTranslateY = useSharedValue(400);
  const sheetVisible = useSharedValue(0);

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

  const goWeek = useCallback(
    (toValue: number) => {
      if (reduced) {
        setWeekOffset(toValue);
        return;
      }
      // eslint-disable-next-line react-hooks/immutability
      scale.value = withSequence(
        withSpring(0.96, { damping: 15, stiffness: 200 }),
         
        withSpring(1, { damping: 15, stiffness: 200 }),
      );
      setWeekOffset(toValue);
    },
    [scale, reduced],
  );

  const showSheet = useCallback(() => {
    // eslint-disable-next-line react-hooks/immutability
    sheetVisible.value = 1;
    // eslint-disable-next-line react-hooks/immutability
    sheetTranslateY.value = reduced ? 0 : withSpring(0, { damping: 20, stiffness: 150 });
  }, [sheetVisible, sheetTranslateY, reduced]);

  const hideSheet = useCallback(() => {
    const target = 400;
    if (reduced) {
      // eslint-disable-next-line react-hooks/immutability
      sheetTranslateY.value = target;
      // eslint-disable-next-line react-hooks/immutability
      sheetVisible.value = 0;
      runOnJS(setDetailCourse)(null);
      return;
    }
     
    sheetTranslateY.value = withSpring(target, { damping: 20, stiffness: 150 }, () => {
       
      sheetVisible.value = 0;
      runOnJS(setDetailCourse)(null);
    });
  }, [sheetTranslateY, sheetVisible, reduced]);

  const handleCoursePress = useCallback(
    (course: Course) => {
      setDetailCourse(course);
      showSheet();
    },
    [showSheet],
  );

  const swipeThreshold = 60;
  const weekOffsetRef = useRef(weekOffset);
  const goWeekRef = useRef(goWeek);
  useEffect(() => {
    goWeekRef.current = goWeek;
    weekOffsetRef.current = weekOffset;
  });
  const panResponder = useRef(
    // eslint-disable-next-line react-hooks/refs
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 20 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > swipeThreshold) {
          goWeekRef.current(weekOffsetRef.current - 1);
        } else if (gs.dx < -swipeThreshold) {
          goWeekRef.current(weekOffsetRef.current + 1);
        }
      },
    }),
  ).current;

  const animatedGrid = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedSheet = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  const getInstancesForDay = (date: Date): CourseInstance[] => {
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
    return instances;
  };

  const getBlocksForDay = (date: Date): RenderedBlock[] => {
    const instances = getInstancesForDay(date);
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
          hideSheet();
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
        {/* eslint-disable-next-line react-hooks/refs */}
        <Animated.View style={[styles.gridBody, animatedGrid]} {...panResponder.panHandlers}>
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
                      onPress={() => handleCoursePress(block.course)}
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
                              : '#FFFFFF',
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
                                : 'rgba(255,255,255,0.85)',
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
        </Animated.View>
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Week Navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={[styles.navBtn, { backgroundColor: dt.colors.surface, borderColor: dt.colors.border }]}
          onPress={() => goWeek(weekOffset - 1)}
          activeOpacity={0.7}
        >
          <Icon name="chevron-left" size={22} color={dt.colors.text} />
        </TouchableOpacity>
        {weekOffset !== 0 ? (
          <TouchableOpacity
            style={[styles.todayBtn, { backgroundColor: dt.colors.primary }]}
            onPress={() => goWeek(0)}
            activeOpacity={0.7}
          >
            <Text style={[styles.todayBtnText, { color: dt.colors.onPrimary }]}>返回本周</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.navBtn, { backgroundColor: dt.colors.surface, borderColor: dt.colors.border }]}
          onPress={() => goWeek(weekOffset + 1)}
          activeOpacity={0.7}
        >
          <Icon name="chevron-right" size={22} color={dt.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet - Course Detail */}
      {detailCourse ? (
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetScrim} onPress={hideSheet} />
          <Animated.View
            style={[
              styles.bottomSheet,
              {
                backgroundColor: dt.colors.surface,
                borderTopLeftRadius: dt.borderRadius.xl,
                borderTopRightRadius: dt.borderRadius.xl,
              },
              animatedSheet,
            ]}
          >
            <View style={styles.sheetHandle}>
              <View style={[styles.handleBar, { backgroundColor: dt.colors.border }]} />
            </View>
            <View style={[styles.sheetBar, { backgroundColor: detailCourse.color ?? dt.colors.primary }]}>
              <Text
                style={{
                  fontSize: dt.fontSize.subheading,
                  fontWeight: dt.fontWeight.subheading,
                  color: '#FFFFFF',
                }}
                numberOfLines={2}
              >
                {detailCourse.name}
              </Text>
            </View>
            <ScrollView
              style={styles.sheetBody}
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              <DetailRow dt={dt} label="课程代码" value={detailCourse.code} />
              <DetailRow dt={dt} label="地点" value={detailCourse.location} />
              <DetailRow dt={dt} label="教师" value={detailCourse.teacher} />
              <DetailRow
                dt={dt}
                label="学分"
                value={detailCourse.credits != null ? String(detailCourse.credits) : undefined}
              />
              <DetailRow dt={dt} label="考核方式" value={detailCourse.assessmentMethod} />
              <Text
                style={{
                  fontSize: dt.fontSize.caption,
                  fontWeight: dt.fontWeight.subheading,
                  color: dt.colors.text,
                  marginTop: dt.spacing.md,
                  marginBottom: 4,
                }}
              >
                时间段
              </Text>
              {detailCourse.timeSlots.map((slot, i) => (
                <Text
                  key={i}
                  style={{ fontSize: dt.fontSize.caption, color: dt.colors.textSecondary, marginVertical: 2 }}
                >
                  {formatTimeSlot(slot)}
                </Text>
              ))}
              {detailCourse.notes ? (
                <>
                  <Text
                    style={{
                      fontSize: dt.fontSize.caption,
                      fontWeight: dt.fontWeight.subheading,
                      color: dt.colors.text,
                      marginTop: dt.spacing.md,
                      marginBottom: 4,
                    }}
                  >
                    备注
                  </Text>
                  <Text style={{ fontSize: dt.fontSize.caption, color: dt.colors.textSecondary }}>
                    {detailCourse.notes}
                  </Text>
                </>
              ) : null}
            </ScrollView>
            <View style={[styles.sheetActions, { borderTopColor: dt.colors.border }]}>
              <TouchableOpacity onPress={hideSheet} style={styles.sheetAction}>
                <Text style={{ color: dt.colors.textSecondary, fontSize: dt.fontSize.body }}>关闭</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(detailCourse)}
                style={styles.sheetAction}
              >
                <Text style={{ color: dt.colors.destructive, fontSize: dt.fontSize.body, fontWeight: dt.fontWeight.subheading }}>
                  删除
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const c = detailCourse;
                  hideSheet();
                  onEdit?.(c);
                }}
                style={[styles.sheetActionPrimary, { backgroundColor: dt.colors.primary }]}
              >
                <Text style={{ color: dt.colors.onPrimary, fontSize: dt.fontSize.body, fontWeight: dt.fontWeight.subheading }}>
                  编辑
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

function DetailRow({ dt, label, value }: { dt: ReturnType<typeof useDesignTokens>; label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', marginVertical: 2 }}>
      <Text style={{ width: 72, fontSize: dt.fontSize.caption, color: dt.colors.textMuted }}>
        {label}
      </Text>
      <Text style={{ flex: 1, fontSize: dt.fontSize.caption, color: dt.colors.text }}>
        {value}
      </Text>
    </View>
  );
}

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
  navBar: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  todayBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  sheetScrim: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  bottomSheet: {
    maxHeight: '75%',
    overflow: 'hidden',
  },
  sheetHandle: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  sheetBar: {
    padding: 16,
  },
  sheetBody: {
    padding: 16,
    maxHeight: 300,
  },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetAction: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sheetActionPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
});

export default CourseSchedule;
