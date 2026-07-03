import { useState } from 'react';
import { FAB, Text } from 'react-native-paper';
import { View, TouchableOpacity } from 'react-native';
import type { Course } from '@/types';
import { createDefaultSemester } from '@/types';
import { useSettingsStore } from '@/stores/settingsStore';
import { useCourseStore } from '@/stores/courseStore';
import { findSemesterForDate } from '@/utils/scheduleDate';
import { CourseSchedule } from '@/components/CourseSchedule';
import { CalendarView } from '@/components/CalendarView';
import { CourseForm } from '@/components/CourseForm';
import { ScreenContainer } from '@/components/ScreenContainer';
import { useDesignTokens } from '@/hooks/useDesignTokens';

export default function HomeScreen() {
  const dt = useDesignTokens();
  const semesters = useSettingsStore((s) => s.semesters);
  const courses = useCourseStore((s) => s.courses);
  const [view, setView] = useState<'schedule' | 'calendar'>('schedule');
  const [courseFormVisible, setCourseFormVisible] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const effectiveSemesters = semesters.length > 0 ? semesters : [createDefaultSemester()];
  const currentSemester = findSemesterForDate(new Date(), semesters);

  return (
    <ScreenContainer padded={false}>
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

      {/* View Toggle */}
      <View style={{
        position: 'absolute',
        bottom: 16,
        left: 0,
        right: 0,
        alignItems: 'center',
        pointerEvents: 'box-none',
      }}>
        <View style={{
          flexDirection: 'row',
          backgroundColor: dt.colors.surface,
          borderRadius: dt.borderRadius.pill,
          borderWidth: 1,
          borderColor: dt.colors.border,
          padding: 3,
        }}>
          <TouchableOpacity
            onPress={() => setView('schedule')}
            style={{
              paddingHorizontal: 20,
              paddingVertical: 8,
              borderRadius: dt.borderRadius.pill,
              backgroundColor: view === 'schedule' ? dt.colors.primary : 'transparent',
            }}
            activeOpacity={0.7}
          >
            <Text style={{
              fontSize: dt.fontSize.caption,
              fontWeight: dt.fontWeight.subheading,
              color: view === 'schedule' ? dt.colors.onPrimary : dt.colors.textSecondary,
            }}>
              周视图
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setView('calendar')}
            style={{
              paddingHorizontal: 20,
              paddingVertical: 8,
              borderRadius: dt.borderRadius.pill,
              backgroundColor: view === 'calendar' ? dt.colors.primary : 'transparent',
            }}
            activeOpacity={0.7}
          >
            <Text style={{
              fontSize: dt.fontSize.caption,
              fontWeight: dt.fontWeight.subheading,
              color: view === 'calendar' ? dt.colors.onPrimary : dt.colors.textSecondary,
            }}>
              月视图
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* + FAB — offset to accommodate bottom bar + view toggle */}
      <FAB
        icon="plus"
        style={{
          position: 'absolute',
          right: 16,
          bottom: 80,
        }}
        onPress={() => {
          setEditingCourse(null);
          setCourseFormVisible(true);
        }}
      />

      <CourseForm
        key={editingCourse?.id ?? 'new-course'}
        visible={courseFormVisible}
        semesters={effectiveSemesters}
        defaultSemesterId={currentSemester.id}
        editing={editingCourse}
        onDismiss={() => setCourseFormVisible(false)}
        onSaved={() => setCourseFormVisible(false)}
      />
    </ScreenContainer>
  );
}
