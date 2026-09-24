import { addDays, parseISO } from 'date-fns';
import type { Course, Semester } from '@/types';
import {
  getWeekNumberForDate,
  isWeekInRange,
  matchesRepeatRule,
  toISODate,
} from './scheduleDate';
import { getSectionTimesForDate } from './campusTimes';
import { formatLocationForDisplay } from './locationFormat';

export const REMINDER_CHANNEL_ID = 'class-reminders';
export const REMINDER_LEAD_OPTIONS = [5, 10, 15, 30, 60, 120] as const;
export const DEFAULT_REMINDER_LEAD_MINUTES = 10;

/** 档位显示文案:不满 1 小时显示「N 分钟」,整小时显示「N 小时」 */
export function formatReminderLeadMinutes(minutes: number): string {
  return minutes >= 60 ? `${minutes / 60} 小时` : `${minutes} 分钟`;
}
/** Android 闹钟上限 500,留余量 */
export const MAX_REMINDERS = 400;
/** 为覆盖学期切换,对「今天起 90 天内开始」的未来学期也排程 */
const FUTURE_SEMESTER_WINDOW_DAYS = 90;

export interface ReminderOccurrence {
  identifier: string;
  triggerDate: Date;
  title: string;
  body: string;
  courseName: string;
  location?: string;
}

export function formatReminderBody(
  courseName: string,
  leadMinutes: number,
  location?: string,
): string {
  const locationPart = location ? `,上课地点为${location}` : '';
  return `${courseName}将在${leadMinutes}分钟后开始${locationPart},请做好准备`;
}

/**
 * 展开所有课程的未来上课时刻,生成提醒清单(按触发时间升序,超出 MAX_REMINDERS 截断)。
 * 纯函数:依赖课程/学期数据与当前时间,不产生副作用。
 */
export function computeReminderOccurrences(
  courses: Course[],
  semesters: Semester[],
  leadMinutes: number,
  now: Date = new Date(),
): ReminderOccurrence[] {
  const occurrences: ReminderOccurrence[] = [];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const horizon = addDays(today, FUTURE_SEMESTER_WINDOW_DAYS);

  for (const course of courses) {
    const semester = semesters.find((s) => s.id === course.semesterId);
    if (!semester || semester.id === 'default') continue;
    const semesterStart = parseISO(semester.startDate);
    const semesterEnd = parseISO(semester.endDate);
    if (semesterEnd < today || semesterStart > horizon) continue;

    const rangeStart = semesterStart > today ? semesterStart : today;
    const rangeEnd = semesterEnd < horizon ? semesterEnd : horizon;

    for (let d = new Date(rangeStart); d <= rangeEnd; d = addDays(d, 1)) {
      const dow = ((d.getDay() + 6) % 7) + 1;
      const weekNumber = getWeekNumberForDate(d, semester);
      if (weekNumber < 1 || weekNumber > semester.weekCount) continue;
      const times = getSectionTimesForDate(semester, d);

      for (let si = 0; si < course.timeSlots.length; si++) {
        const slot = course.timeSlots[si];
        if (slot.dayOfWeek !== dow) continue;
        if (!isWeekInRange(weekNumber, slot.weekRange)) continue;
        if (!matchesRepeatRule(weekNumber, slot.repeatRule)) continue;

        const sorted = [...slot.classSections].sort((a, b) => a - b);
        const start = times[sorted[0] - 1]?.start;
        if (!start) continue;
        const [h, m] = start.split(':').map(Number);
        const classStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
        const triggerDate = new Date(classStart.getTime() - leadMinutes * 60_000);
        if (triggerDate <= now) continue;

        const location = formatLocationForDisplay(course.location) || undefined;
        occurrences.push({
          identifier: `reminder-${course.id}-${si}-${toISODate(d)}`,
          triggerDate,
          title: '上课提醒',
          body: formatReminderBody(course.name, leadMinutes, location),
          courseName: course.name,
          location,
        });
      }
    }
  }

  occurrences.sort((a, b) => a.triggerDate.getTime() - b.triggerDate.getTime());
  return occurrences.slice(0, MAX_REMINDERS);
}
