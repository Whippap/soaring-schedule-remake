import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Course, Semester } from '@/types';
import {
  findSemesterForDate,
  getWeekNumberForDate,
  isWeekInRange,
  matchesRepeatRule,
  formatSections,
} from './scheduleDate';

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
  semesterName: string;
  items: WidgetCourseItem[];
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function buildWidgetCourseData(
  courses: Course[],
  semesters: Semester[],
  now: Date = new Date(),
): WidgetDataSnapshot {
  const dow = ((now.getDay() + 6) % 7) + 1;
  const semester = findSemesterForDate(now, semesters);
  const weekNumber = getWeekNumberForDate(now, semester);
  const isDefault = semesters.length === 0 || semester.id === 'default';
  const inRange = !isDefault && weekNumber >= 1 && weekNumber <= semester.weekCount;

  const items: WidgetCourseItem[] = [];
  if (inRange) {
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
          location: course.location,
          color: course.color,
          sectionRange: formatSections(sorted),
          startTime,
          endTime,
        });
      }
    }
  }

  items.sort((a, b) => a.startTime.localeCompare(b.startTime));

  return {
    date: toISODate(now),
    semesterName: semester.name,
    items: items.slice(0, 2),
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
