import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import type { WidgetDataSnapshot } from '@/utils/widgetData';
import { buildWidgetCourseData } from '@/utils/widgetData';
import { useCourseStore } from '@/stores/courseStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useDesignTokens } from '@/hooks/useDesignTokens';
import { darkColors, lightColors } from '@/design';

export function WidgetPreview() {
  const dt = useDesignTokens();
  const courses = useCourseStore((s) => s.courses);
  const semesters = useSettingsStore((s) => s.semesters);
  const darkMode = useSettingsStore((s) => s.darkMode);

  const snapshot: WidgetDataSnapshot = useMemo(
    () => buildWidgetCourseData(courses, semesters),
    [courses, semesters],
  );

  const wc = darkMode ? darkColors : lightColors;
  const bgColor = wc.surface;
  const textColor = wc.text;
  const subColor = wc.textSecondary;

  return (
    <View style={[styles.container, { backgroundColor: dt.colors.surfaceAlt, borderRadius: dt.borderRadius.md }]}>
      <Text style={{ fontSize: dt.fontSize.caption, fontWeight: dt.fontWeight.subheading, color: dt.colors.textSecondary, marginBottom: 8 }}>
        Widget 预览
      </Text>
      <View style={[styles.widget, { backgroundColor: bgColor, borderRadius: dt.borderRadius.lg, borderWidth: 1, borderColor: dt.colors.border }]}>
        {snapshot.items.length > 0 ? (
          snapshot.items.map((item) => (
            <View key={item.id} style={styles.widgetRow}>
              <View style={[styles.dot, { backgroundColor: item.color ?? dt.colors.primary }]} />
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
  container: { padding: 12 },
  widget: {
    width: 280,
    height: 180,
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
  dot: { width: 10, height: 10, borderRadius: 5 },
  widgetName: { fontSize: 14, fontWeight: 'bold' },
  widgetSub: { fontSize: 11 },
  emptyState: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16 },
});

export default WidgetPreview;
