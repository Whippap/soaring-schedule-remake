import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Course, TimeSlot } from '@/types';
import { parseWeeks } from '@/utils/scheduleDate';
import { isCourseConflict } from '@/utils/timeConflict';

interface CourseState {
  hydrated: boolean;
  courses: Course[];
  setHydrated: (hydrated: boolean) => void;
  addCourse: (course: Course) => void;
  updateCourse: (id: string, updates: Partial<Course>) => void;
  deleteCourse: (id: string) => void;
  getCoursesBySemester: (semesterId: string) => Course[];
  deleteCoursesBySemester: (semesterId: string) => void;
  adjustCoursesForSemester: (semesterId: string, maxWeek: number, maxSection: number) => void;
  clearAllCourses: () => void;
  isCourseConflict: (course: Course, excludeId?: string) => boolean;
}

export const useCourseStore = create<CourseState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      courses: [],
      setHydrated: (hydrated) => set({ hydrated }),
      addCourse: (course) => set((s) => ({ courses: [...s.courses, course] })),
      updateCourse: (id, updates) =>
        set((s) => ({
          courses: s.courses.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        })),
      deleteCourse: (id) => set((s) => ({ courses: s.courses.filter((c) => c.id !== id) })),
      getCoursesBySemester: (semesterId) =>
        get().courses.filter((c) => c.semesterId === semesterId),
      deleteCoursesBySemester: (semesterId) =>
        set((s) => ({ courses: s.courses.filter((c) => c.semesterId !== semesterId) })),
      adjustCoursesForSemester: (semesterId, maxWeek, maxSection) =>
        set((s) => ({
          courses: s.courses.map((c) => {
            if (c.semesterId !== semesterId) {
              return c;
            }
            const trimmedSlots = c.timeSlots
              .map((slot) => {
                const weeks = parseWeeks(slot.weekRange).filter((w) => w <= maxWeek);
                if (weeks.length === 0) {
                  return null;
                }
                const sections = slot.classSections.filter((sec) => sec <= maxSection);
                if (sections.length === 0) {
                  return null;
                }
                const minW = Math.min(...weeks);
                const maxW = Math.max(...weeks);
                return {
                  ...slot,
                  weekRange: minW === maxW ? `${minW}` : `${minW}-${maxW}`,
                  classSections: sections,
                };
              })
              .filter((slot): slot is TimeSlot => slot !== null);
            return { ...c, timeSlots: trimmedSlots };
          }),
        })),
      clearAllCourses: () => set({ courses: [] }),
      isCourseConflict: (course, excludeId) =>
        isCourseConflict(course, get().courses, excludeId),
    }),
    {
      name: 'soaring-schedule-courses',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ courses: state.courses }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
