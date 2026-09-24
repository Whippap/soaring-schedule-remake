import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { CourseWidget } from './CourseWidget';
import {
  saveWidgetData,
  loadWidgetData,
  buildWidgetCourseData,
  buildWidgetDataFromStorage,
} from '@/utils/widgetData';

registerWidgetTaskHandler(async function ({ widgetInfo, widgetAction, renderWidget }) {
  if (widgetAction === 'WIDGET_DELETED') {
    return;
  }
  if (
    widgetAction !== 'WIDGET_ADDED' &&
    widgetAction !== 'WIDGET_UPDATE' &&
    widgetAction !== 'WIDGET_CLICK'
  ) {
    return; // WIDGET_RESIZED 等无需渲染
  }

  // headless 上下文中 store 未水合:统一从 AsyncStorage 原始数据以当前日期重建,
  // 不再复用旧快照(修复跨天后数据过期)。
  let snapshot = await buildWidgetDataFromStorage();
  if (snapshot) {
    await saveWidgetData(snapshot); // 写回最新快照,供 app 内 requestWidgetUpdate 读取
  } else {
    snapshot = await loadWidgetData(); // 存储损坏/不可读 → 回退旧快照
  }
  if (!snapshot) {
    snapshot = buildWidgetCourseData([], []); // 空快照兜底
  }

  const isSmall = widgetInfo.widgetName === 'SmallCourseWidget';
  renderWidget({
    light: CourseWidget({ snapshot, isDark: false, variant: isSmall ? 'small' : 'large' }),
    dark: CourseWidget({ snapshot, isDark: true, variant: isSmall ? 'small' : 'large' }),
  });
});
