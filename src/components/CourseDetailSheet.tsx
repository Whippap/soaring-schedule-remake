import { useMemo, useEffect } from 'react';
import { ScrollView, StyleSheet, Pressable, View, TouchableOpacity, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import type { Course } from '@/types';
import { formatTimeSlot } from '@/utils/scheduleDate';
import { formatLocationForDisplay } from '@/utils/locationFormat';
import { getOnColor } from '@/utils/color';
import { useDesignTokens } from '@/hooks/useDesignTokens';

interface Props {
  course: Course | null;
  onDismiss: () => void;
  onEdit?: (course: Course) => void;
  onDelete?: (course: Course) => void;
}

export function CourseDetailSheet({ course, onDismiss, onEdit, onDelete }: Props) {
  const dt = useDesignTokens();
  const opacity = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    if (course) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [course, opacity]);

  const handleClose = () => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
    });
  };

  if (!course) return null;

  return (
    <View style={styles.overlay}>
      <Pressable style={[styles.scrim, { backgroundColor: dt.colors.overlay }]} onPress={handleClose} />
      <Animated.View
        style={[
          styles.dialog,
          {
            backgroundColor: dt.colors.surface,
            borderRadius: dt.borderRadius.xl,
            opacity,
          },
        ]}
      >
        <View style={[styles.titleBar, { backgroundColor: course.color ?? dt.colors.primary }]}>
          <Text
            style={{
              fontSize: dt.fontSize.subheading,
              fontWeight: dt.fontWeight.subheading,
              color: getOnColor(course.color ?? dt.colors.primary),
            }}
            numberOfLines={2}
          >
            {course.name}
          </Text>
        </View>
        <ScrollView
          style={styles.body}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <DetailRow dt={dt} label="课程代码" value={course.code} />
          <DetailRow dt={dt} label="地点" value={formatLocationForDisplay(course.location)} />
          <DetailRow dt={dt} label="教师" value={course.teacher} />
          <DetailRow dt={dt} label="学分" value={course.credits != null ? String(course.credits) : undefined} />
          <DetailRow dt={dt} label="考核方式" value={course.assessmentMethod} />
          <Text
            style={{
              fontSize: dt.fontSize.caption,
              fontWeight: dt.fontWeight.subheading,
              color: dt.colors.text,
              marginTop: dt.spacing.md,
              marginBottom: 4,
            }}
          >
            时间段
          </Text>
          {course.timeSlots.map((slot, i) => (
            <Text
              key={i}
              style={{ fontSize: dt.fontSize.caption, color: dt.colors.textSecondary, marginVertical: 2 }}
            >
              {formatTimeSlot(slot)}
            </Text>
          ))}
          {course.notes ? (
            <>
              <Text
                style={{
                  fontSize: dt.fontSize.caption,
                  fontWeight: dt.fontWeight.subheading,
                  color: dt.colors.text,
                  marginTop: dt.spacing.md,
                  marginBottom: 4,
                }}
              >
                备注
              </Text>
              <Text style={{ fontSize: dt.fontSize.caption, color: dt.colors.textSecondary }}>
                {course.notes}
              </Text>
            </>
          ) : null}
        </ScrollView>
        <View style={[styles.actions, { borderTopColor: dt.colors.border }]}>
          <TouchableOpacity onPress={handleClose} style={styles.actionBtn}>
            <Text style={{ color: dt.colors.textSecondary, fontSize: dt.fontSize.body }}>关闭</Text>
          </TouchableOpacity>
          {onDelete ? (
            <TouchableOpacity onPress={() => onDelete(course)} style={styles.actionBtn}>
              <Text
                style={{ color: dt.colors.destructive, fontSize: dt.fontSize.body, fontWeight: dt.fontWeight.subheading }}
              >
                删除
              </Text>
            </TouchableOpacity>
          ) : null}
          {onEdit ? (
            <TouchableOpacity
              onPress={() => {
                handleClose();
                // Wait for close animation before opening edit
                setTimeout(() => onEdit(course), 200);
              }}
              style={[
                styles.actionPrimary,
                { backgroundColor: dt.colors.primary, borderRadius: dt.borderRadius.md },
              ]}
            >
              <Text style={{ color: dt.colors.onPrimary, fontSize: dt.fontSize.body, fontWeight: dt.fontWeight.subheading }}>
                编辑
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

function DetailRow({ dt, label, value }: { dt: ReturnType<typeof useDesignTokens>; label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', marginVertical: 2 }}>
      <Text style={{ width: 72, fontSize: dt.fontSize.caption, color: dt.colors.textMuted }}>
        {label}
      </Text>
      <Text style={{ flex: 1, fontSize: dt.fontSize.caption, color: dt.colors.text }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    // backgroundColor set inline via dt.colors.overlay
  },
  dialog: {
    width: '88%',
    maxHeight: '75%',
    overflow: 'hidden',
  },
  titleBar: { padding: 16 },
  body: { padding: 16, maxHeight: 300 },
  actions: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
    padding: 12, gap: 12, borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  actionPrimary: { paddingHorizontal: 16, paddingVertical: 8 },
});
