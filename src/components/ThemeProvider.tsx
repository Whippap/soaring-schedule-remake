import { useMemo, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider, MD3DarkTheme, MD3LightTheme, Snackbar } from 'react-native-paper';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSnackbarStore } from '@/hooks/useSnackbar';
import { darkColors, lightColors } from '@/design';

interface Props {
  children: ReactNode;
}

export function ThemeProvider({ children }: Props) {
  const darkMode = useSettingsStore((s) => s.darkMode);
  const themeColor = useSettingsStore((s) => s.themeColor);
  const snackbarMessage = useSnackbarStore((s) => s.message);
  const dismissSnackbar = useSnackbarStore((s) => s.dismiss);

  const paperTheme = useMemo(() => {
    const base = darkMode ? MD3DarkTheme : MD3LightTheme;
    const c = darkMode ? darkColors : lightColors;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: themeColor,
        surfaceVariant: c.surfaceAlt,
        onSurfaceVariant: c.textSecondary,
        outline: c.border,
        outlineVariant: c.border,
      },
      fonts: base.fonts,
    };
  }, [darkMode, themeColor]);

  return (
    <PaperProvider theme={paperTheme}>
      <StatusBar style={darkMode ? 'light' : 'dark'} />
      {children}
      <Snackbar
        visible={snackbarMessage !== null}
        onDismiss={dismissSnackbar}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </PaperProvider>
  );
}
