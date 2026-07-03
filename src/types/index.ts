export enum RepeatRule {
  ALL = '',
  ODD = '仅单周',
  EVEN = '仅双周',
}

export enum AssessmentMethod {
  EXAM = '考试',
  INSPECTION = '考察',
  PNP = 'PnP',
}

export interface TimeSlot {
  weekRange: string;
  repeatRule: RepeatRule;
  dayOfWeek: number;
  classSections: number[];
}

export interface Course {
  id: string;
  name: string;
  semesterId: string;
  timeSlots: TimeSlot[];
  code?: string;
  location?: string;
  credits?: number;
  teacher?: string;
  assessmentMethod?: AssessmentMethod;
  notes?: string;
  color?: string;
}

export interface SectionTime {
  start: string;
  end: string;
}

export interface Semester {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  weekCount: number;
  sectionCount: number;
  sectionTimes: SectionTime[];
}

export { courseColors as PRESET_COLORS, importColors as IMPORT_COLORS } from '@/design';

export const DEFAULT_THEME_COLOR = '#0D9488';

function formatTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (totalMinutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function buildDefaultSectionTimes(count: number): SectionTime[] {
  const times: SectionTime[] = [];
  let cursor = 8 * 60;
  for (let i = 0; i < count; i++) {
    const start = cursor;
    const end = start + 45;
    times.push({ start: formatTime(start), end: formatTime(end) });
    cursor = end + 10;
    if (i === 3) {
      cursor += 80;
    }
  }
  return times;
}

export function createDefaultSemester(): Semester {
  const year = new Date().getFullYear();
  return {
    id: 'default',
    name: '假期',
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    weekCount: 52,
    sectionCount: 13,
    sectionTimes: buildDefaultSectionTimes(13),
  };
}
