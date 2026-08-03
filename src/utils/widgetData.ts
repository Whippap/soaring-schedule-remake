import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Course, Semester } from '@/types';
import {
  findSemesterForDate,
  getWeekNumberForDate,
  isWeekInRange,
  matchesRepeatRule,
  formatSections,
} from './scheduleDate';
import { formatLocationForDisplay } from './locationFormat';

const WIDGET_DATA_KEY = '@soaring_schedule:widget_data';
const DARK_MODE_KEY = '@soaring_schedule:dark_mode';

export interface WidgetCourseItem {
  id: string;
  name: string;
  location?: string;
  color?: string;
  sectionRange: string;
  startTime: string;
  endTime: string;
}

export interface WidgetDataSnapshot {
  date: string;
  tomorrowDate: string;
  semesterName: string;
  /** 当天前 2 门课（小 Widget 快速取用） */
  today: WidgetCourseItem[];
  /** 明天前 2 门课 */
  tomorrow: WidgetCourseItem[];
  /** 当天全部课程（大 Widget 滚动列表） */
  allToday: WidgetCourseItem[];
  /** 明天全部课程（大 Widget 滚动列表） */
  allTomorrow: WidgetCourseItem[];
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildDayCourses(
  date: Date,
  courses: Course[],
  semesters: Semester[],
): WidgetCourseItem[] {
  const dow = ((date.getDay() + 6) % 7) + 1;
  const semester = findSemesterForDate(date, semesters);
  const weekNumber = getWeekNumberForDate(date, semester);
  const isDefault = semesters.length === 0 || semester.id === 'default';
  const inRange = !isDefault && weekNumber >= 1 && weekNumber <= semester.weekCount;

  if (!inRange) return [];

  const items: WidgetCourseItem[] = [];
  for (const course of courses) {
    if (course.semesterId !== semester.id) continue;
    for (const slot of course.timeSlots) {
      if (slot.dayOfWeek !== dow) continue;
      if (!isWeekInRange(weekNumber, slot.weekRange)) continue;
      if (!matchesRepeatRule(weekNumber, slot.repeatRule)) continue;

      const sorted = [...slot.classSections].sort((a, b) => a - b);
      const firstSec = sorted[0];
      const lastSec = sorted[sorted.length - 1];
      const startTime = semester.sectionTimes[firstSec - 1]?.start ?? '';
      const endTime = semester.sectionTimes[lastSec - 1]?.end ?? '';

      items.push({
        id: `${course.id}-${slot.dayOfWeek}`,
        name: course.name,
        location: formatLocationForDisplay(course.location),
        color: course.color,
        sectionRange: formatSections(sorted),
        startTime,
        endTime,
      });
    }
  }

  items.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return items;
}

export function buildWidgetCourseData(
  courses: Course[],
  semesters: Semester[],
  now: Date = new Date(),
): WidgetDataSnapshot {
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);

  const semester = findSemesterForDate(now, semesters);

  const todayCourses = buildDayCourses(now, courses, semesters);
  const tomorrowCourses = buildDayCourses(tomorrowDate, courses, semesters);

  return {
    date: toISODate(now),
    tomorrowDate: toISODate(tomorrowDate),
    semesterName: semester.name,
    today: todayCourses.slice(0, 2),
    tomorrow: tomorrowCourses.slice(0, 2),
    allToday: todayCourses,
    allTomorrow: tomorrowCourses,
  };
}

export async function saveWidgetData(data: WidgetDataSnapshot): Promise<void> {
  await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(data));
}

export async function loadWidgetData(): Promise<WidgetDataSnapshot | null> {
  const raw = await AsyncStorage.getItem(WIDGET_DATA_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WidgetDataSnapshot;
  } catch {
    return null;
  }
}

export async function saveWidgetDarkMode(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(DARK_MODE_KEY, enabled ? 'true' : 'false');
}

export async function loadWidgetDarkMode(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(DARK_MODE_KEY);
  return raw === 'true';
}

export { WIDGET_DATA_KEY, DARK_MODE_KEY };

/**
 * 从当天课程中筛选当前时间之后尚未结束的课程。
 * 用于小 Widget「显示后续课程」模式。
 */
export function filterUpcomingCourses(items: WidgetCourseItem[], now: Date = new Date()): WidgetCourseItem[] {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return items.filter((item) => {
    if (!item.endTime) return true; // 无结束时间的课程始终保留
    const [h, m] = item.endTime.split(':').map(Number);
    const endMinutes = h * 60 + m;
    return endMinutes > currentMinutes;
  });
}
