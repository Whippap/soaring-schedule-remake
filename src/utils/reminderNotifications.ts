import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { REMINDER_CHANNEL_ID, type ReminderOccurrence } from './reminderScheduler';

/** 创建「上课提醒」通知渠道(高重要性 + 响铃),幂等可重复调用 */
export async function ensureReminderChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: '上课提醒',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });
}

/** 前台收到通知时显示横幅(必须在 bundle 入口注册,保证所有 JS 上下文生效) */
export function configureReminderHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** 全量替换排程:取消全部 + 逐条排程(顺序执行,避免并发触发闹钟上限) */
export async function scheduleReminders(occurrences: ReminderOccurrence[]): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const occ of occurrences) {
    await Notifications.scheduleNotificationAsync({
      identifier: occ.identifier,
      content: { title: occ.title, body: occ.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: occ.triggerDate,
        channelId: REMINDER_CHANNEL_ID,
      },
    });
  }
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** 立即发送一条测试通知(trigger 为 null),供设置页验证通知与铃声效果 */
export async function sendTestReminderNotification(): Promise<void> {
  await ensureReminderChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '上课提醒',
      body: '这是一条测试通知,上课提醒功能正常~',
    },
    trigger: null,
  });
}
