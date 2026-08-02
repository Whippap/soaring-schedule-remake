import { differenceInCalendarDays, parseISO } from 'date-fns';
import { createDefaultSemester, RepeatRule } from '@/types';
import type { Semester } from '@/types';

export function findSemesterForDate(date: Date, semesters: Semester[]): Semester {
  const iso = toISODate(date);
  return (
    semesters.find((s) => s.startDate <= iso && iso <= s.endDate) ?? createDefaultSemester()
  );
}

const semesterStartCache = new Map<string, Date>();

function getSemesterStart(startDate: string): Date {
  const cached = semesterStartCache.get(startDate);
  if (cached) return cached;
  const parsed = parseISO(startDate);
  semesterStartCache.set(startDate, parsed);
  return parsed;
}

export function getWeekNumberForDate(date: Date, semester: Semester): number {
  const start = getSemesterStart(semester.startDate);
  const diff = differenceInCalendarDays(date, start);
  return diff < 0 ? 0 : Math.floor(diff / 7) + 1;
}

export function isWeekInRange(weekNumber: number, weekRange: string): boolean {
  return parseWeeks(weekRange).includes(weekNumber);
}

export function matchesRepeatRule(weekNumber: number, repeatRule: RepeatRule): boolean {
  if (repeatRule === RepeatRule.ODD) {
    return weekNumber % 2 === 1;
  }
  if (repeatRule === RepeatRule.EVEN) {
    return weekNumber % 2 === 0;
  }
  return true;
}

const parseWeeksCache = new Map<string, number[]>();

export function parseWeeks(weekRange: string): number[] {
  const cached = parseWeeksCache.get(weekRange);
  if (cached) return cached;

  const weeks: number[] = [];
  for (const part of weekRange.split(',')) {
    const trimmed = part.trim();
    const dashIndex = trimmed.indexOf('-');
    if (dashIndex >= 0) {
      const start = parseInt(trimmed.slice(0, dashIndex), 10);
      const end = parseInt(trimmed.slice(dashIndex + 1), 10);
      if (!Number.isNaN(start) && !Number.isNaN(end)) {
        for (let w = start; w <= end; w++) {
          weeks.push(w);
        }
      }
    } else {
      const n = parseInt(trimmed, 10);
      if (!Number.isNaN(n)) {
        weeks.push(n);
      }
    }
  }
  parseWeeksCache.set(weekRange, weeks);
  return weeks;
}

export function clearParseWeeksCache(): void {
  parseWeeksCache.clear();
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function computeSemesterEndDate(startDate: string, weekCount: number): string {
  const start = parseISO(startDate);
  return toISODate(new Date(start.getTime() + weekCount * 7 * 24 * 60 * 60 * 1000 - 86400000));
}

export function formatTimeSlot(slot: {
  weekRange: string;
  repeatRule: RepeatRule;
  dayOfWeek: number;
  classSections: number[];
}): string {
  const dayNames = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const sectionsText = formatSections(slot.classSections);
  const repeatText =
    slot.repeatRule === RepeatRule.ODD
      ? '(单)'
      : slot.repeatRule === RepeatRule.EVEN
        ? '(双)'
        : '';
  return `${slot.weekRange}周${repeatText} ${dayNames[slot.dayOfWeek]} ${sectionsText}`;
}

export function formatSections(sections: number[]): string {
  if (sections.length === 0) {
    return '';
  }
  const sorted = [...sections].sort((a, b) => a - b);
  const parts: string[] = [];
  let rangeStart = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    if (cur === prev + 1) {
      prev = cur;
    } else {
      parts.push(rangeStart === prev ? `第${rangeStart}节` : `第${rangeStart}-${prev}节`);
      rangeStart = cur;
      prev = cur;
    }
  }
  parts.push(rangeStart === prev ? `第${rangeStart}节` : `第${rangeStart}-${prev}节`);
  return parts.join(',');
}
