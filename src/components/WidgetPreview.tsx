import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import type { WidgetDataSnapshot } from '@/utils/widgetData';
import { buildWidgetCourseData, loadWidgetData } from '@/utils/widgetData';
import { useCourseStore } from '@/stores/courseStore';
import { useSettingsStore } from '@/stores/settingsStore';

export function WidgetPreview() {
  const theme = useTheme();
  const courses = useCourseStore((s) => s.courses);
  const semesters = useSettingsStore((s) => s.semesters);
  const darkMode = useSettingsStore((s) => s.darkMode);
  const [snapshot, setSnapshot] = useState<WidgetDataSnapshot | null>(null);

  useEffect(() => {
    const built = buildWidgetCourseData(courses, semesters);
    setSnapshot(built);
    loadWidgetData().then((saved) => {
      if (saved) setSnapshot(saved);
    });
  }, [courses, semesters]);

  const bgColor = darkMode ? '#1a1a1a' : '#ffffff';
  const textColor = darkMode ? '#ffffff' : '#333333';
  const subColor = darkMode ? '#bbbbbb' : '#888888';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <Text variant="labelLarge" style={styles.title}>
        Widget 预览
      </Text>
      <View style={[styles.widget, { backgroundColor: bgColor }]}>
        {snapshot && snapshot.items.length > 0 ? (
          snapshot.items.map((item) => (
            <View key={item.id} style={styles.widgetRow}>
              <View style={[styles.dot, { backgroundColor: item.color ?? '#3498db' }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.widgetName, { color: textColor }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.widgetSub, { color: subColor }]} numberOfLines={1}>
                  {item.sectionRange} {item.startTime}-{item.endTime}
                </Text>
                {item.location ? (
                  <Text style={[styles.widgetSub, { color: subColor }]} numberOfLines={1}>
                    {item.location}
                  </Text>
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: subColor }]}>今天没有课了</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  title: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  widget: {
    width: 280,
    height: 180,
    borderRadius: 12,
    padding: 12,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  widgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  widgetName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  widgetSub: {
    fontSize: 11,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
});

export default WidgetPreview;
