import { useState } from 'react';
import { FAB, useTheme } from 'react-native-paper';
import { StyleSheet, View } from 'react-native';
import type { Course } from '@/types';
import { createDefaultSemester } from '@/types';
import { useSettingsStore } from '@/stores/settingsStore';
import { useCourseStore } from '@/stores/courseStore';
import { findSemesterForDate } from '@/utils/scheduleDate';
import { CourseSchedule } from '@/components/CourseSchedule';
import { CalendarView } from '@/components/CalendarView';
import { CourseForm } from '@/components/CourseForm';

export default function HomeScreen() {
  const theme = useTheme();
  const semesters = useSettingsStore((s) => s.semesters);
  const courses = useCourseStore((s) => s.courses);
  const [view, setView] = useState<'schedule' | 'calendar'>('schedule');
  const [courseFormVisible, setCourseFormVisible] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const effectiveSemesters = semesters.length > 0 ? semesters : [createDefaultSemester()];
  const currentSemester = findSemesterForDate(new Date(), semesters);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {view === 'schedule' ? (
        <CourseSchedule
          semesters={effectiveSemesters}
          onEdit={(c) => {
            setEditingCourse(c);
            setCourseFormVisible(true);
          }}
        />
      ) : (
        <CalendarView courses={courses} semesters={effectiveSemesters} />
      )}
      <View style={styles.viewToggle}>
        <FAB
          icon={view === 'schedule' ? 'calendar-month' : 'view-week'}
          size="small"
          style={styles.toggleFab}
          onPress={() => setView(view === 'schedule' ? 'calendar' : 'schedule')}
        />
      </View>
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => {
          setEditingCourse(null);
          setCourseFormVisible(true);
        }}
      />
      <CourseForm
        visible={courseFormVisible}
        semesters={effectiveSemesters}
        defaultSemesterId={currentSemester.id}
        editing={editingCourse}
        onDismiss={() => setCourseFormVisible(false)}
        onSaved={() => setCourseFormVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  viewToggle: {
    position: 'absolute',
    bottom: 16,
    left: 16,
  },
  toggleFab: {
    backgroundColor: '#3498db',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
