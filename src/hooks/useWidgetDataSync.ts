import { useEffect } from 'react';
import { useCourseStore } from '@/stores/courseStore';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  buildWidgetCourseData,
  saveWidgetData,
  saveWidgetDarkMode,
} from '@/utils/widgetData';

const WIDGET_NAME = 'CourseWidget';

export function useWidgetDataSync() {
  const courses = useCourseStore((s) => s.courses);
  const semesters = useSettingsStore((s) => s.semesters);
  const darkMode = useSettingsStore((s) => s.darkMode);

  useEffect(() => {
    const snapshot = buildWidgetCourseData(courses, semesters);
    saveWidgetData(snapshot).catch(() => {});
    updateWidget();
  }, [courses, semesters]);

  useEffect(() => {
    saveWidgetDarkMode(darkMode).catch(() => {});
  }, [darkMode]);

  return null;
}

async function updateWidget(): Promise<void> {
  try {
    const { requestWidgetUpdate } = await import('react-native-android-widget');
    await requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: async () => {
        const { CourseWidget } = await import('@/widgets/CourseWidget');
        const { loadWidgetData } = await import('@/utils/widgetData');
        const data = await loadWidgetData();
        const snapshot = data ?? { date: '', semesterName: '假期', items: [] };
        return {
          light: CourseWidget({ snapshot, isDark: false }),
          dark: CourseWidget({ snapshot, isDark: true }),
        };
      },
      widgetNotFound: () => {},
    });
  } catch {
    // Widget module not available (e.g. Expo Go) — skip silently
  }
}
