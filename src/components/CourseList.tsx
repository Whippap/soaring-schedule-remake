import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import type { Course, Semester } from '@/types';
import { formatTimeSlot } from '@/utils/scheduleDate';
import { useCourseStore } from '@/stores/courseStore';
import { useDesignTokens } from '@/hooks/useDesignTokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/EmptyState';

interface Props {
  semesters: Semester[];
  currentSemesterId: string;
  onEdit: (course: Course) => void;
}

function AnimatedCard({
  course,
  index,
  onEdit,
  onDelete,
  dt,
  reduced,
}: {
  course: Course;
  index: number;
  onEdit: (c: Course) => void;
  onDelete: (c: Course) => void;
  dt: ReturnType<typeof useDesignTokens>;
  reduced: boolean;
}) {
  const opacity = useSharedValue(reduced ? 1 : 0);
  const translateY = useSharedValue(reduced ? 0 : 12);
  const [showMenu, setShowMenu] = useState(false);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // Trigger entrance animation
  useEffect(() => {
    if (reduced) return;
    const delay = index * 50;
    // eslint-disable-next-line react-hooks/immutability
    opacity.value = withDelay(delay, withSpring(1, { damping: 20, stiffness: 150 }));
    // eslint-disable-next-line react-hooks/immutability
    translateY.value = withDelay(delay, withSpring(0, { damping: 20, stiffness: 150 }));
  }, [index, opacity, translateY, reduced]);

  const handleLongPress = useCallback(() => {
    setShowMenu(true);
  }, []);

  const closeMenu = useCallback(() => {
    setShowMenu(false);
  }, []);

  const courseColor = course.color ?? dt.colors.primary;

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: dt.colors.surface,
          borderColor: dt.colors.border,
          borderRadius: dt.borderRadius.lg,
          borderWidth: 1,
        },
        animStyle,
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onLongPress={handleLongPress}
        onPress={() => {
          if (showMenu) {
            closeMenu();
          }
        }}
        delayLongPress={400}
      >
        <View style={{ flexDirection: 'row', minHeight: 72 }}>
          <View
            style={[
              styles.colorBar,
              {
                backgroundColor: courseColor,
                borderTopLeftRadius: dt.borderRadius.lg,
                borderBottomLeftRadius: dt.borderRadius.lg,
              },
            ]}
          />
          <View style={styles.cardBody}>
            <View style={styles.cardHeader}>
              <Text
                style={{
                  fontSize: dt.fontSize.body,
                  fontWeight: dt.fontWeight.subheading,
                  color: dt.colors.text,
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {course.name}
              </Text>
              <TouchableOpacity
                onPress={() => setShowMenu(!showMenu)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="dots-vertical" size={18} color={dt.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.metaRow}>
              {course.code ? (
                <View style={[styles.metaPill, { backgroundColor: dt.colors.surfaceAlt }]}>
                  <Icon name="course" size={11} color={dt.colors.textSecondary} />
                  <Text style={[styles.metaText, { color: dt.colors.textSecondary }]}>
                    {course.code}
                  </Text>
                </View>
              ) : null}
              {course.credits != null ? (
                <View style={[styles.metaPill, { backgroundColor: dt.colors.surfaceAlt }]}>
                  <Icon name="semester" size={11} color={dt.colors.textSecondary} />
                  <Text style={[styles.metaText, { color: dt.colors.textSecondary }]}>
                    {course.credits} 学分
                  </Text>
                </View>
              ) : null}
              {course.location ? (
                <View style={[styles.metaPill, { backgroundColor: dt.colors.surfaceAlt }]}>
                  <Icon name="location" size={11} color={dt.colors.textSecondary} />
                  <Text style={[styles.metaText, { color: dt.colors.textSecondary }]}>
                    {course.location}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.slotRow}>
              {course.timeSlots.map((slot, i) => (
                <Text
                  key={i}
                  style={{ fontSize: dt.fontSize.caption, color: dt.colors.textMuted }}
                  numberOfLines={1}
                >
                  {formatTimeSlot(slot)}
                </Text>
              ))}
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {showMenu ? (
        <View style={[styles.menuBar, { borderTopColor: dt.colors.border }]}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              closeMenu();
              onEdit(course);
            }}
          >
            <Icon name="pencil" size={16} color={dt.colors.primary} />
            <Text style={{ fontSize: dt.fontSize.caption, color: dt.colors.primary, marginLeft: 4 }}>
              编辑
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              closeMenu();
              onDelete(course);
            }}
          >
            <Icon name="delete" size={16} color={dt.colors.destructive} />
            <Text style={{ fontSize: dt.fontSize.caption, color: dt.colors.destructive, marginLeft: 4 }}>
              删除
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </Animated.View>
  );
}

export function CourseList({ semesters, currentSemesterId, onEdit }: Props) {
  const dt = useDesignTokens();
  const reduced = useReducedMotion();
  const courses = useCourseStore((s) => s.courses);
  const deleteCourse = useCourseStore((s) => s.deleteCourse);
  const [manualFilterId, setManualFilterId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const filterSemesterId = manualFilterId ?? currentSemesterId;

  const filtered = useMemo(
    () => courses.filter((c) => c.semesterId === filterSemesterId),
    [courses, filterSemesterId],
  );

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 300);
  };

  const handleDelete = useCallback(
    (course: Course) => {
      Alert.alert('删除课程', `确定删除「${course.name}」吗？`, [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => deleteCourse(course.id),
        },
      ]);
    },
    [deleteCourse],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Course; index: number }) => (
      <AnimatedCard
        course={item}
        index={index}
        onEdit={onEdit}
        onDelete={handleDelete}
        dt={dt}
        reduced={reduced}
      />
    ),
    [onEdit, dt, handleDelete, reduced],
  );

  return (
    <View style={[styles.container, { backgroundColor: dt.colors.bg }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.semesterScroll}
        contentContainerStyle={styles.semesterContent}
      >
        {semesters.map((s) => (
          <TouchableOpacity
            key={s.id}
            onPress={() => setManualFilterId(s.id)}
            style={[
              styles.chip,
              {
                borderRadius: dt.borderRadius.pill,
                borderColor: s.id === filterSemesterId ? dt.colors.primary : dt.colors.border,
                borderWidth: 1.5,
                backgroundColor: s.id === filterSemesterId ? `${dt.colors.primary}14` : dt.colors.surface,
              },
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={{
                fontSize: dt.fontSize.caption,
                fontWeight: s.id === filterSemesterId ? dt.fontWeight.subheading : dt.fontWeight.body,
                color: s.id === filterSemesterId ? dt.colors.primary : dt.colors.textSecondary,
              }}
            >
              {s.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={dt.colors.primary} />
        }
        contentContainerStyle={filtered.length === 0 ? styles.empty : styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="calendar-check"
            title="该学期暂无课程"
            description="点击下方 + 按钮添加课程"
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        removeClippedSubviews={false}
        maxToRenderPerBatch={10}
        windowSize={7}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  semesterScroll: { flexGrow: 0 },
  semesterContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 80,
  },
  empty: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    marginHorizontal: 0,
    overflow: 'hidden',
  },
  colorBar: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    padding: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 6,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  metaText: {
    fontSize: 11,
  },
  slotRow: {
    marginTop: 6,
  },
  menuBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
});

export default CourseList;
