import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { useCourseStore } from '@/stores/courseStore';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  buildWidgetCourseData,
  saveWidgetData,
  saveWidgetDarkMode,
} from '@/utils/widgetData';

const WIDGET_NAMES = ['CourseWidget', 'SmallCourseWidget'] as const;

export function useWidgetDataSync(enabled = true) {
  const courses = useCourseStore((s) => s.courses);
  const semesters = useSettingsStore((s) => s.semesters);
  const darkMode = useSettingsStore((s) => s.darkMode);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      const snapshot = buildWidgetCourseData(courses, semesters);
      saveWidgetData(snapshot).catch(() => {});
      WIDGET_NAMES.forEach((name) => updateWidget(name));
    });
    return () => {
      cancelled = true;
      task.cancel?.();
    };
  }, [enabled, courses, semesters]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (!cancelled) {
        saveWidgetDarkMode(darkMode).catch(() => {});
      }
    });
    return () => {
      cancelled = true;
      task.cancel?.();
    };
  }, [enabled, darkMode]);

  return null;
}

async function updateWidget(widgetName: string): Promise<void> {
  try {
    const { requestWidgetUpdate } = await import('react-native-android-widget');
    await requestWidgetUpdate({
      widgetName,
      renderWidget: async () => {
        const { CourseWidget } = await import('@/widgets/CourseWidget');
        const { loadWidgetData } = await import('@/utils/widgetData');
        const data = await loadWidgetData();
        const snapshot = data ?? {
          date: '',
          tomorrowDate: '',
          semesterName: '假期',
          today: [],
          tomorrow: [],
        };
        const isSmall = widgetName === 'SmallCourseWidget';
        return {
          light: CourseWidget({ snapshot, isDark: false, variant: isSmall ? 'small' : 'large' }),
          dark: CourseWidget({ snapshot, isDark: true, variant: isSmall ? 'small' : 'large' }),
        };
      },
      widgetNotFound: () => {},
    });
  } catch {
    // Widget module not available (e.g. Expo Go) — skip silently
  }
}
