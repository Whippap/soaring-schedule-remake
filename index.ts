// 自定义 bundle 入口(替代 expo-router/entry,见 package.json main)。
// widget-task-handler 必须在此注册:widget 事件在 headless 冷启动时(如 App 被杀后、
// 重启后系统刷新)会拉起独立 JS 上下文,Expo Router 的路由模块(_layout 等)不会被
// 加载,仅在 _layout 中 import 会导致后台任务找不到 handler 而不渲染。
// 模板取自 node_modules/expo-router/entry-classic.js。
import '@expo/metro-runtime';
import { App } from 'expo-router/build/qualified-entry';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';
import '@/widgets/widget-task-handler';
import { configureReminderHandler } from '@/utils/reminderNotifications';

configureReminderHandler();

renderRootComponent(App);
