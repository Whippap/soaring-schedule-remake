import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { CourseWidget } from './CourseWidget';
import {
  saveWidgetData,
  loadWidgetData,
  buildWidgetCourseData,
} from '@/utils/widgetData';
import { useCourseStore } from '@/stores/courseStore';
import { useSettingsStore } from '@/stores/settingsStore';

registerWidgetTaskHandler(async function ({ widgetInfo, widgetAction, renderWidget }) {
  if (widgetAction === 'WIDGET_DELETED') {
    return;
  }

  if (widgetAction === 'WIDGET_CLICK' || widgetAction === 'WIDGET_UPDATE' || widgetAction === 'WIDGET_ADDED') {
    const courses = useCourseStore.getState()?.courses ?? [];
    const semesters = useSettingsStore.getState()?.semesters ?? [];

    let snapshot;
    if (courses.length > 0) {
      // 主应用上下文中 store 已水合，构建最新快照并持久化
      snapshot = buildWidgetCourseData(courses, semesters);
      await saveWidgetData(snapshot);
    } else {
      // headless 上下文中 store 可能未水合，从 AsyncStorage 读取备用数据
      snapshot = await loadWidgetData();
      if (!snapshot) {
        // 完全没有数据时用空快照兜底
        snapshot = buildWidgetCourseData([], []);
      }
    }

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
