import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { CourseWidget } from './CourseWidget';
import {
  saveWidgetData,
  buildWidgetCourseData,
} from '@/utils/widgetData';
import { useCourseStore } from '@/stores/courseStore';
import { useSettingsStore } from '@/stores/settingsStore';

registerWidgetTaskHandler(async function ({ widgetAction, renderWidget }) {
  if (widgetAction === 'WIDGET_DELETED') {
    return;
  }

  const courses = useCourseStore.getState()?.courses ?? [];
  const semesters = useSettingsStore.getState()?.semesters ?? [];

  if (widgetAction === 'WIDGET_CLICK' || widgetAction === 'WIDGET_UPDATE' || widgetAction === 'WIDGET_ADDED') {
    const snapshot = buildWidgetCourseData(courses, semesters);
    await saveWidgetData(snapshot);
    renderWidget({
      light: CourseWidget({ snapshot, isDark: false }),
      dark: CourseWidget({ snapshot, isDark: true }),
    });
  }
});
