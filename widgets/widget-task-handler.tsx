import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { CourseWidget } from './CourseWidget';
import {
  saveWidgetData,
  buildWidgetCourseData,
} from '@/utils/widgetData';
import { useCourseStore } from '@/stores/courseStore';
import { useSettingsStore } from '@/stores/settingsStore';

registerWidgetTaskHandler(async function ({ widgetInfo, widgetAction, renderWidget }) {
  if (widgetAction === 'WIDGET_DELETED') {
    return;
  }

  const courses = useCourseStore.getState()?.courses ?? [];
  const semesters = useSettingsStore.getState()?.semesters ?? [];

  if (widgetAction === 'WIDGET_CLICK' || widgetAction === 'WIDGET_UPDATE' || widgetAction === 'WIDGET_ADDED') {
    const snapshot = buildWidgetCourseData(courses, semesters);
    await saveWidgetData(snapshot);

    const isSmall = widgetInfo.widgetName === 'SmallCourseWidget';
    const widgetElement = CourseWidget({
      snapshot,
      isDark: false,
      variant: isSmall ? 'small' : 'large',
    });
    const darkElement = CourseWidget({
      snapshot,
      isDark: true,
      variant: isSmall ? 'small' : 'large',
    });

    renderWidget({
      light: widgetElement,
      dark: darkElement,
    });
  }
});
