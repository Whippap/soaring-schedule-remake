import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Course, Semester } from '@/types';
import { useCourseStore } from '@/stores/courseStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { computeReminderOccurrences } from '@/utils/reminderScheduler';
import {
  cancelAllReminders,
  ensureReminderChannel,
  scheduleReminders,
} from '@/utils/reminderNotifications';

/** 课程/学期/提醒设置变化时全量重排通知;仅在 app 水合后启用(防半水合数据排程) */
export function useReminderSync(enabled = true) {
  const courses = useCourseStore((s) => s.courses);
  const semesters = useSettingsStore((s) => s.semesters);
  const reminderEnabled = useSettingsStore((s) => s.reminderEnabled);
  const leadMinutes = useSettingsStore((s) => s.reminderLeadMinutes);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      void syncReminders(reminderEnabled, leadMinutes, courses, semesters);
    });
    return () => {
      cancelled = true;
      task.cancel?.();
    };
  }, [enabled, courses, semesters, reminderEnabled, leadMinutes]);

  return null;
}

async function syncReminders(
  reminderEnabled: boolean,
  leadMinutes: number,
  courses: Course[],
  semesters: Semester[],
): Promise<void> {
  try {
    if (!reminderEnabled) {
      await cancelAllReminders();
      return;
    }
    // 排程前复查通知权限:被系统撤销 → 清理排程(不弹请求框,设置页显示警告行)
    const perms = await Notifications.getPermissionsAsync();
    if (!perms.granted) {
      await cancelAllReminders();
      return;
    }
    await ensureReminderChannel();
    const occurrences = computeReminderOccurrences(courses, semesters, leadMinutes);
    await scheduleReminders(occurrences);
  } catch {
    // 排程失败静默:不阻塞 UI,下次数据变化会重试
  }
}
