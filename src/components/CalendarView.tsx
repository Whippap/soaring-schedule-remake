import { useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
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
import { findSemesterForDate, getWeekNumberForDate, isWeekInRange, matchesRepeatRule } from '@/utils/scheduleDate';

const DAY_NAMES = ['一', '二', '三', '四', '五', '六', '日'];

interface Props {
  courses: Course[];
  semesters: Semester[];
}

export function CalendarView({ courses, semesters }: Props) {
  const theme = useTheme();
  const [cursor, setCursor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const days = useMemo(() => {
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [cursor]);

  const hasCourseOn = (date: Date): boolean => {
    const dow = ((date.getDay() + 6) % 7) + 1;
    const semester = findSemesterForDate(date, semesters);
    if (semester.id === 'default' && semesters.length > 0) {
      return false;
    }
    const weekNumber = getWeekNumberForDate(date, semester);
    if (weekNumber < 1 || weekNumber > semester.weekCount) {
      return false;
    }
    return courses.some(
      (c) =>
        c.semesterId === semester.id &&
        c.timeSlots.some(
          (slot) =>
            slot.dayOfWeek === dow &&
            isWeekInRange(weekNumber, slot.weekRange) &&
            matchesRepeatRule(weekNumber, slot.repeatRule) &&
            slot.classSections.length > 0,
        ),
    );
  };

  const getCoursesOn = (date: Date): Course[] => {
    const dow = ((date.getDay() + 6) % 7) + 1;
    const semester = findSemesterForDate(date, semesters);
    if (semester.id === 'default' && semesters.length > 0) {
      return [];
    }
    const weekNumber = getWeekNumberForDate(date, semester);
    if (weekNumber < 1 || weekNumber > semester.weekCount) {
      return [];
    }
    const seen = new Set<string>();
    const result: Course[] = [];
    for (const c of courses) {
      if (c.semesterId !== semester.id) {
        continue;
      }
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
    return result;
  };

  const selectedCourses = selectedDate ? getCoursesOn(selectedDate) : [];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <IconButton icon="chevron-left" onPress={() => setCursor((c) => addMonths(c, -1))} />
        <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
          {format(cursor, 'yyyy年M月')}
        </Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setCursor(new Date())}>
            <Text style={{ color: theme.colors.primary }}>今天</Text>
          </TouchableOpacity>
          <IconButton icon="chevron-right" onPress={() => setCursor((c) => addMonths(c, 1))} />
        </View>
      </View>

      <View style={[styles.weekHeader, { borderBottomColor: theme.colors.outline }]}>
        {DAY_NAMES.map((d) => (
          <Text key={d} style={[styles.weekHeaderCell, { color: theme.colors.onSurfaceVariant }]}>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((date) => {
          const inMonth = isSameMonth(date, cursor);
          const today = isToday(date);
          const hasCourse = hasCourseOn(date);
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          return (
            <TouchableOpacity
              key={date.toISOString()}
              style={styles.dayCell}
              onPress={() => setSelectedDate(date)}
            >
              <View
                style={[
                  styles.dayCircle,
                  today && { backgroundColor: theme.colors.primary },
                  isSelected && !today && { backgroundColor: theme.colors.surfaceVariant },
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    { color: theme.colors.onSurface },
                    !inMonth && { color: theme.colors.outline },
                    today && styles.dayTextToday,
                  ]}
                >
                  {format(date, 'd')}
                </Text>
              </View>
              {hasCourse ? <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal visible={selectedDate !== null} transparent animationType="fade" onRequestClose={() => setSelectedDate(null)}>
        <Pressable style={styles.overlay} onPress={() => setSelectedDate(null)}>
          <Pressable style={[styles.dialog, { backgroundColor: theme.colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <Text variant="titleMedium" style={[styles.dialogTitle, { color: theme.colors.onSurface }]}>
              {selectedDate ? format(selectedDate, 'M月d日 EEEE') : ''}
            </Text>
            <ScrollView style={styles.dialogBody}>
              {selectedCourses.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>当天无课程</Text>
              ) : (
                selectedCourses.map((c) => (
                  <View key={c.id} style={styles.courseItem}>
                    <View style={[styles.courseDot, { backgroundColor: c.color ?? '#3498db' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.courseName, { color: theme.colors.onSurface }]}>{c.name}</Text>
                      {c.location ? <Text style={[styles.courseLoc, { color: theme.colors.onSurfaceVariant }]}>{c.location}</Text> : null}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
            <View style={styles.dialogActions}>
              <TouchableOpacity onPress={() => setSelectedDate(null)}>
                <Text style={{ color: theme.colors.primary }}>关闭</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
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
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 14,
    
  },
  dayTextMuted: {
    
  },
  dayTextToday: {
    color: 'white',
    fontWeight: 'bold',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialog: {
    width: '80%',
    maxHeight: '60%',
    
    borderRadius: 12,
    overflow: 'hidden',
    padding: 16,
  },
  dialogTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  dialogBody: {
    maxHeight: 300,
  },
  emptyText: {
    
    textAlign: 'center',
    paddingVertical: 16,
  },
  courseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  courseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  courseName: {
    fontSize: 14,
    
    fontWeight: '500',
  },
  courseLoc: {
    fontSize: 12,
    
  },
  dialogActions: {
    alignItems: 'flex-end',
    marginTop: 12,
  },
});

export default CalendarView;
