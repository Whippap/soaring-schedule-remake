import { useSettingsStore } from '@/stores/settingsStore';
import { useTokens } from '@/design/tokens';
import type { DesignTokens } from '@/design/tokens';

export function useDesignTokens(): DesignTokens {
  const darkMode = useSettingsStore((s) => s.darkMode);
  return useTokens(darkMode);
}
