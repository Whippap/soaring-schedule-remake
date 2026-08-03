import { useCourseStore } from '@/stores/courseStore';
import { useSettingsStore } from '@/stores/settingsStore';

export function useAppHydrated(): boolean {
  const coursesHydrated = useCourseStore((s) => s.hydrated);
  const settingsHydrated = useSettingsStore((s) => s.hydrated);

  return coursesHydrated && settingsHydrated;
}
