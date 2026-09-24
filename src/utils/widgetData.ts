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
import { getSectionTimesForDate, migrateSemesters } from './campusTimes';

const WIDGET_DATA_KEY = '@soaring_schedule:widget_data';
// zustand persist 原始存储 key,与 courseStore/settingsStore 保持一致
const COURSES_STORE_KEY = 'soaring-schedule-courses';
const SETTINGS_STORE_KEY = 'soaring-schedule-settings';

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
  const times = getSectionTimesForDate(semester, date);
  for (const course of courses) {
    if (course.semesterId !== semester.id) continue;
    for (const slot of course.timeSlots) {
      if (slot.dayOfWeek !== dow) continue;
      if (!isWeekInRange(weekNumber, slot.weekRange)) continue;
      if (!matchesRepeatRule(weekNumber, slot.repeatRule)) continue;

      const sorted = [...slot.classSections].sort((a, b) => a - b);
      const firstSec = sorted[0];
      const lastSec = sorted[sorted.length - 1];
      const startTime = times[firstSec - 1]?.start ?? '';
      const endTime = times[lastSec - 1]?.end ?? '';

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

/** 解析 zustand persist 格式 {state, version} 或历史裸格式;缺失/损坏返回 null */
function parseStoredState(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const state = (parsed as { state?: unknown }).state ?? parsed;
      if (state && typeof state === 'object') return state as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * headless 上下文中从 AsyncStorage 原始持久化数据以当前日期重建 Widget 快照。
 * 绕开 Zustand store(headless 下未水合),数据以存储中的真实内容为准。
 * 旧格式 semesters 经 migrateSemesters 幂等迁移,但仅内存生效、不写回:
 * headless 写回与前台编辑存在竞态,持久化留给 App 水合时的 onRehydrateStorage 完成。
 * 任一 key 缺失/损坏/构建异常 → 返回 null,由调用方回退旧快照。
 */
export async function buildWidgetDataFromStorage(
  now: Date = new Date(),
): Promise<WidgetDataSnapshot | null> {
  const [coursesRaw, settingsRaw] = await Promise.all([
    AsyncStorage.getItem(COURSES_STORE_KEY),
    AsyncStorage.getItem(SETTINGS_STORE_KEY),
  ]);
  const coursesState = parseStoredState(coursesRaw);
  const settingsState = parseStoredState(settingsRaw);
  if (!coursesState || !settingsState) return null;
  const courses = Array.isArray(coursesState.courses) ? (coursesState.courses as Course[]) : [];
  const semesters = Array.isArray(settingsState.semesters)
    ? (settingsState.semesters as Semester[])
    : [];
  try {
    return buildWidgetCourseData(courses, migrateSemesters(semesters), now);
  } catch {
    return null;
  }
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

export { WIDGET_DATA_KEY };

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
