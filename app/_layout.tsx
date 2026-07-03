import { useMemo } from 'react';
import { Tabs } from 'expo-router';
import { useSettingsStore } from '@/stores/settingsStore';
import { useWidgetDataSync } from '@/hooks/useWidgetDataSync';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Icon } from '@/components/Icon';
import { darkColors, lightColors, fontWeight, fontSize } from '@/design';

export default function RootLayout() {
  const darkMode = useSettingsStore((s) => s.darkMode);
  const themeColor = useSettingsStore((s) => s.themeColor);
  useWidgetDataSync();

  const screenOptions = useMemo(() => {
    const c = darkMode ? darkColors : lightColors;
    return {
      headerShown: false,
      headerTitleStyle: {
        fontWeight: fontWeight.heading as '800',
        fontSize: fontSize.subheading,
      },
      tabBarActiveTintColor: themeColor,
      tabBarInactiveTintColor: c.textMuted,
      tabBarLabelStyle: {
        fontSize: fontSize.label,
        fontWeight: fontWeight.label,
        marginTop: -2,
        marginBottom: 4,
      },
      tabBarStyle: {
        backgroundColor: c.surface,
        borderTopColor: c.border,
        borderTopWidth: 0,
        height: 60,
        paddingTop: 6,
        elevation: 0,
        shadowOpacity: 0,
      },
    };
  }, [darkMode, themeColor]);

  return (
    <ThemeProvider>
      <Tabs screenOptions={screenOptions}>
        <Tabs.Screen
          name="index"
          options={{
            title: '课表',
            tabBarIcon: ({ color, size }) => (
              <Icon name="calendar-month" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="schedule"
          options={{
            title: '管理',
            tabBarIcon: ({ color, size }) => (
              <Icon name="view-list" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: '设置',
            tabBarIcon: ({ color, size }) => (
              <Icon name="cog" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </ThemeProvider>
  );
}
