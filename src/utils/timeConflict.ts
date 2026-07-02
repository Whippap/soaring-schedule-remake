import type { Course, TimeSlot } from '@/types';
import { RepeatRule } from '@/types';
import { parseWeeks } from './scheduleDate';

function effectiveWeeks(slot: TimeSlot): Set<number> {
  const weeks = parseWeeks(slot.weekRange);
  if (slot.repeatRule === RepeatRule.ODD) {
    return new Set(weeks.filter((w) => w % 2 === 1));
  }
  if (slot.repeatRule === RepeatRule.EVEN) {
    return new Set(weeks.filter((w) => w % 2 === 0));
  }
  return new Set(weeks);
}

export function isTimeSlotConflict(slot1: TimeSlot, slot2: TimeSlot): boolean {
  if (slot1.dayOfWeek !== slot2.dayOfWeek) {
    return false;
  }
  const weeks1 = effectiveWeeks(slot1);
  const weeks2 = effectiveWeeks(slot2);
  let weekOverlap = false;
  for (const w of weeks1) {
    if (weeks2.has(w)) {
      weekOverlap = true;
      break;
    }
  }
  if (!weekOverlap) {
    return false;
  }
  const sections1 = new Set(slot1.classSections);
  return slot2.classSections.some((s) => sections1.has(s));
}

export function isCourseConflict(
  newCourse: Course,
  existingCourses: Course[],
  excludeId?: string,
): boolean {
  return existingCourses.some(
    (existing) =>
      existing.id !== excludeId &&
      existing.id !== newCourse.id &&
      existing.semesterId === newCourse.semesterId &&
      newCourse.timeSlots.some((slot) =>
        existing.timeSlots.some((existingSlot) => isTimeSlotConflict(slot, existingSlot)),
      ),
  );
}

export function findConflictDescription(
  newCourse: Course,
  existingCourses: Course[],
  excludeId?: string,
): string | null {
  for (const existing of existingCourses) {
    if (existing.id === excludeId || existing.id === newCourse.id) {
      continue;
    }
    if (existing.semesterId !== newCourse.semesterId) {
      continue;
    }
    for (const slot of newCourse.timeSlots) {
      for (const existingSlot of existing.timeSlots) {
        if (isTimeSlotConflict(slot, existingSlot)) {
          return `与「${existing.name}」时间冲突`;
        }
      }
    }
  }
  return null;
}
