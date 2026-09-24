import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateSemesters } from '@/utils/campusTimes';
import { DEFAULT_REMINDER_LEAD_MINUTES } from '@/utils/reminderScheduler';
import { DEFAULT_THEME_COLOR, type Semester } from '@/types';
import { useCourseStore } from './courseStore';

interface SettingsState {
  hydrated: boolean;
  semesters: Semester[];
  themeColor: string;
  darkMode: boolean;
  reminderEnabled: boolean;
  reminderLeadMinutes: number;
  setHydrated: (hydrated: boolean) => void;
  addSemester: (semester: Semester) => void;
  updateSemester: (id: string, updates: Partial<Semester>) => void;
  deleteSemester: (id: string) => void;
  setThemeColor: (color: string) => void;
  setDarkMode: (enabled: boolean) => void;
  setReminderEnabled: (enabled: boolean) => void;
  setReminderLeadMinutes: (minutes: number) => void;
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
      reminderEnabled: false,
      reminderLeadMinutes: DEFAULT_REMINDER_LEAD_MINUTES,
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
      setReminderEnabled: (enabled) => set({ reminderEnabled: enabled }),
      setReminderLeadMinutes: (minutes) => set({ reminderLeadMinutes: minutes }),
      formatData: () => {
        useCourseStore.getState().clearAllCourses();
        set({
          semesters: [],
          themeColor: DEFAULT_THEME_COLOR,
          darkMode: false,
          reminderEnabled: false,
          reminderLeadMinutes: DEFAULT_REMINDER_LEAD_MINUTES,
        });
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
        reminderEnabled: state.reminderEnabled,
        reminderLeadMinutes: state.reminderLeadMinutes,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.semesters)) {
          const migrated = migrateSemesters(state.semesters);
          if (migrated !== state.semesters) {
            useSettingsStore.setState({ semesters: migrated });
          }
        }
        state?.setHydrated(true);
      },
    },
  ),
);
