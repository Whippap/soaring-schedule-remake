import { memo, useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  format,
  isSameMonth,
  isToday,
} from 'date-fns';
import type { Course, Semester } from '@/types';
import {
  findSemesterForDate,
  getWeekNumberForDate,
  isWeekInRange,
  matchesRepeatRule,
  toISODate,
} from '@/utils/scheduleDate';
import { useDesignTokens } from '@/hooks/useDesignTokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Icon } from '@/components/Icon';

const DAY_NAMES_SHORT = ['一', '二', '三', '四', '五', '六', '日'];

interface Props {
  courses: Course[];
  semesters: Semester[];
}

interface DayCourses {
  date: Date;
  courses: Course[];
  count: number;
}

export const CalendarView = memo(function CalendarView({ courses, semesters }: Props) {
  const dt = useDesignTokens();
  const reduced = useReducedMotion();
  const [cursor, setCursor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<DayCourses | null>(null);

  const sheetTranslateY = useSharedValue(400);

  const days = useMemo(() => {
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [cursor]);

  const showSheet = useCallback(() => {
    sheetTranslateY.value = reduced ? 0 : withSpring(0, { damping: 20, stiffness: 150 });
  }, [sheetTranslateY, reduced]);

  const hideSheet = useCallback(() => {
    const target = 400;
    if (reduced) {
      sheetTranslateY.value = target;
      runOnJS(setSelectedDay)(null);
      return;
    }
     
    sheetTranslateY.value = withSpring(target, { damping: 20, stiffness: 150 }, () => {
      runOnJS(setSelectedDay)(null);
    });
  }, [sheetTranslateY, reduced]);

  const animatedSheet = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  // 预计算每天课程映射，避免 per-day O(courses × slots) 重复计算
  const coursesByDay = useMemo(() => {
    const map = new Map<string, Course[]>();
    for (const date of days) {
      const dow = ((date.getDay() + 6) % 7) + 1;
      const semester = findSemesterForDate(date, semesters);
      if (semester.id === 'default' && semesters.length > 0) continue;
      const weekNumber = getWeekNumberForDate(date, semester);
      if (weekNumber < 1 || weekNumber > semester.weekCount) continue;
      const seen = new Set<string>();
      const result: Course[] = [];
      for (const c of courses) {
        if (c.semesterId !== semester.id) continue;
        const matches = c.timeSlots.some(
          (slot) =>
            slot.dayOfWeek === dow &&
            isWeekInRange(weekNumber, slot.weekRange) &&
            matchesRepeatRule(weekNumber, slot.repeatRule),
        );
        if (matches && !seen.has(c.id)) {
          seen.add(c.id);
          result.push(c);
        }
      }
      map.set(toISODate(date), result);
    }
    return map;
  }, [days, courses, semesters]);

  const getCoursesOn = (date: Date): Course[] => {
    return coursesByDay.get(toISODate(date)) ?? [];
  };

  const handleDayPress = (date: Date) => {
    const cs = getCoursesOn(date);
    setSelectedDay({ date, courses: cs, count: cs.length });
    showSheet();
  };

  return (
    <View style={[styles.container, { backgroundColor: dt.colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: dt.colors.border }]}>
        <TouchableOpacity
          onPress={() => setCursor((c) => addMonths(c, -1))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="chevron-left" size={22} color={dt.colors.text} />
        </TouchableOpacity>
        <Text
          style={{
            fontSize: dt.fontSize.subheading,
            fontWeight: dt.fontWeight.subheading,
            color: dt.colors.text,
          }}
        >
          {format(cursor, 'yyyy年M月')}
        </Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => setCursor(new Date())}
            style={[styles.todayPill, { backgroundColor: dt.colors.primary }]}
            activeOpacity={0.7}
          >
            <Text style={{ color: dt.colors.onPrimary, fontSize: 12, fontWeight: '600' }}>
              今天
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setCursor((c) => addMonths(c, 1))}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="chevron-right" size={22} color={dt.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Day Names */}
      <View style={[styles.weekHeader, { borderBottomColor: dt.colors.border }]}>
        {DAY_NAMES_SHORT.map((d) => (
          <Text
            key={d}
            style={[styles.weekHeaderCell, { color: dt.colors.textMuted }]}
          >
            {d}
          </Text>
        ))}
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {days.map((date) => {
          const inMonth = isSameMonth(date, cursor);
          const today = isToday(date);
          const courseList = getCoursesOn(date);
          const count = courseList.length;

          return (
            <TouchableOpacity
              key={date.toISOString()}
              style={styles.dayCell}
              onPress={() => handleDayPress(date)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.dayCircle,
                  today && { backgroundColor: dt.colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    { color: dt.colors.text },
                    !inMonth && { color: dt.colors.textMuted },
                    today && { color: dt.colors.onPrimary, fontWeight: dt.fontWeight.heading },
                  ]}
                >
                  {format(date, 'd')}
                </Text>
              </View>
              {count > 0 ? (
                <View style={styles.indicatorRow}>
                  {courseList.slice(0, 3).map((c, i) => (
                    <View
                      key={c.id}
                      style={[
                        styles.dot,
                        {
                          backgroundColor: c.color ?? dt.colors.primary,
                          marginLeft: i > 0 ? -3 : 0,
                        },
                      ]}
                    />
                  ))}
                  {count > 3 ? (
                    <Text style={[styles.countBadge, { color: dt.colors.textMuted }]}>
                      +{count - 3}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <View style={styles.indicatorRow} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Bottom Sheet */}
      {selectedDay ? (
        <View style={styles.sheetOverlay}>
          <Pressable style={[styles.sheetScrim, { backgroundColor: dt.colors.overlay }]} onPress={hideSheet} />
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
            <Text
              style={{
                fontSize: dt.fontSize.subheading,
                fontWeight: dt.fontWeight.subheading,
                color: dt.colors.text,
                paddingHorizontal: 20,
                paddingBottom: 12,
              }}
            >
              {format(selectedDay.date, 'M月d日 EEEE')}
            </Text>
            <ScrollView style={styles.sheetBody} bounces={false} showsVerticalScrollIndicator={false}>
              {selectedDay.courses.length === 0 ? (
                <Text style={{ color: dt.colors.textMuted, textAlign: 'center', paddingVertical: 24 }}>
                  当天无课程
                </Text>
              ) : (
                selectedDay.courses.map((c) => (
                  <View key={c.id} style={styles.courseItem}>
                    <View
                      style={[
                        styles.courseDot,
                        { backgroundColor: c.color ?? dt.colors.primary },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: dt.fontSize.body, color: dt.colors.text, fontWeight: '500' }}>
                        {c.name}
                      </Text>
                      {c.location ? (
                        <Text style={{ fontSize: dt.fontSize.caption, color: dt.colors.textSecondary, marginTop: 2 }}>
                          {c.location}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
            <View style={[styles.sheetFooter, { borderTopColor: dt.colors.border }]}>
              <TouchableOpacity onPress={hideSheet} style={styles.sheetCloseBtn}>
                <Text style={{ color: dt.colors.primary, fontSize: dt.fontSize.body, fontWeight: dt.fontWeight.subheading }}>
                  关闭
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  todayPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  weekHeader: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  weekHeaderCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 'bold',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: 14 },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 10,
    minHeight: 10,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  countBadge: {
    fontSize: 9,
    marginLeft: 3,
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
    // backgroundColor set inline via dt.colors.overlay
  },
  bottomSheet: {
    maxHeight: '60%',
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
  sheetBody: {
    paddingHorizontal: 20,
    maxHeight: 280,
  },
  courseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  courseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sheetFooter: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetCloseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});

export default CalendarView;
