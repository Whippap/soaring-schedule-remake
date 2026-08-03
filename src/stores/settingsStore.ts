import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Semester } from '@/types';
import { DEFAULT_THEME_COLOR } from '@/types';
import { useCourseStore } from './courseStore';

interface SettingsState {
  hydrated: boolean;
  semesters: Semester[];
  themeColor: string;
  darkMode: boolean;
  setHydrated: (hydrated: boolean) => void;
  addSemester: (semester: Semester) => void;
  updateSemester: (id: string, updates: Partial<Semester>) => void;
  deleteSemester: (id: string) => void;
  setThemeColor: (color: string) => void;
  setDarkMode: (enabled: boolean) => void;
  formatData: () => void;
  isSemesterOverlap: (semester: Omit<Semester, 'id'>, excludeId?: string) => boolean;
}

function dateRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      semesters: [],
      themeColor: DEFAULT_THEME_COLOR,
      darkMode: false,
      setHydrated: (hydrated) => set({ hydrated }),
      addSemester: (semester) => set((s) => ({ semesters: [...s.semesters, semester] })),
      updateSemester: (id, updates) => {
        const current = get().semesters.find((sm) => sm.id === id);
        set((s) => ({
          semesters: s.semesters.map((sm) => (sm.id === id ? { ...sm, ...updates } : sm)),
        }));
        if (current) {
          const newWeekCount = updates.weekCount ?? current.weekCount;
          const newSectionCount = updates.sectionCount ?? current.sectionCount;
          if (newWeekCount < current.weekCount || newSectionCount < current.sectionCount) {
            useCourseStore.getState().adjustCoursesForSemester(id, newWeekCount, newSectionCount);
          }
        }
      },
      deleteSemester: (id) => {
        useCourseStore.getState().deleteCoursesBySemester(id);
        set((s) => ({ semesters: s.semesters.filter((sm) => sm.id !== id) }));
      },
      setThemeColor: (color) => set({ themeColor: color }),
      setDarkMode: (enabled) => set({ darkMode: enabled }),
      formatData: () => {
        useCourseStore.getState().clearAllCourses();
        set({ semesters: [], themeColor: DEFAULT_THEME_COLOR, darkMode: false });
      },
      isSemesterOverlap: (semester, excludeId) =>
        get().semesters.some(
          (sm) =>
            sm.id !== excludeId &&
            dateRangesOverlap(semester.startDate, semester.endDate, sm.startDate, sm.endDate),
        ),
    }),
    {
      name: 'soaring-schedule-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        semesters: state.semesters,
        themeColor: state.themeColor,
        darkMode: state.darkMode,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
