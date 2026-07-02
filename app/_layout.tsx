import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PaperProvider, MD3DarkTheme, MD3LightTheme, adaptNavigationTheme, Snackbar } from 'react-native-paper';
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
} from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useSettingsStore } from '@/stores/settingsStore';
import { useWidgetDataSync } from '@/hooks/useWidgetDataSync';
import { useSnackbarStore } from '@/hooks/useSnackbar';

const { LightTheme, DarkTheme } = adaptNavigationTheme({
  reactNavigationLight: NavigationDefaultTheme,
  reactNavigationDark: NavigationDarkTheme,
});

export default function RootLayout() {
  const darkMode = useSettingsStore((s) => s.darkMode);
  const themeColor = useSettingsStore((s) => s.themeColor);
  const snackbarMessage = useSnackbarStore((s) => s.message);
  const dismissSnackbar = useSnackbarStore((s) => s.dismiss);
  useWidgetDataSync();

  const baseTheme = darkMode ? MD3DarkTheme : MD3LightTheme;
  const paperTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: themeColor,
    },
    fonts: baseTheme.fonts,
  };

  const navigationTheme = darkMode
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, primary: themeColor } }
    : { ...LightTheme, colors: { ...LightTheme.colors, primary: themeColor } };

  return (
    <PaperProvider theme={paperTheme}>
      <StatusBar style={darkMode ? 'light' : 'dark'} />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: themeColor,
          headerTitleStyle: { fontWeight: 'bold' },
          ...(darkMode
            ? {
                headerStyle: { backgroundColor: navigationTheme.colors.background },
                headerTintColor: navigationTheme.colors.text,
                tabBarStyle: { backgroundColor: navigationTheme.colors.background },
              }
            : {}),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: '课表',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="calendar-month" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="schedule"
          options={{
            title: '课表管理',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="view-list" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: '设置',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="cog" color={color} size={size} />
            ),
          }}
        />
      </Tabs>
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
