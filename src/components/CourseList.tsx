import { useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  Text,
  Alert,
} from 'react-native';
import { Chip, IconButton, Menu, useTheme } from 'react-native-paper';
import type { Course, Semester } from '@/types';
import { formatTimeSlot } from '@/utils/scheduleDate';
import { useCourseStore } from '@/stores/courseStore';

interface Props {
  semesters: Semester[];
  currentSemesterId: string;
  onEdit: (course: Course) => void;
}

export function CourseList({ semesters, currentSemesterId, onEdit }: Props) {
  const theme = useTheme();
  const courses = useCourseStore((s) => s.courses);
  const deleteCourse = useCourseStore((s) => s.deleteCourse);
  const [manualFilterId, setManualFilterId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const filterSemesterId = manualFilterId ?? currentSemesterId;

  const filtered = useMemo(
    () => courses.filter((c) => c.semesterId === filterSemesterId),
    [courses, filterSemesterId],
  );

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 300);
  };

  const handleDelete = (course: Course) => {
    Alert.alert('删除课程', `确定删除「${course.name}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => deleteCourse(course.id),
      },
    ]);
  };

  const renderItem = ({ item }: { item: Course }) => (
    <View style={styles.card}>
      <View style={[styles.colorBar, { backgroundColor: item.color ?? '#3498db' }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={[styles.name, { color: theme.colors.onSurface }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Menu
            visible={menuFor === item.id}
            onDismiss={() => setMenuFor(null)}
            anchor={
              <IconButton icon="dots-vertical" size={20} onPress={() => setMenuFor(item.id)} />
            }
          >
            <Menu.Item
              leadingIcon="pencil"
              title="编辑"
              onPress={() => {
                setMenuFor(null);
                onEdit(item);
              }}
            />
            <Menu.Item
              leadingIcon="delete"
              title="删除"
              onPress={() => {
                setMenuFor(null);
                handleDelete(item);
              }}
            />
          </Menu>
        </View>
        <View style={styles.metaRow}>
          {item.code ? <Text style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}>代码：{item.code}</Text> : null}
          {item.location ? <Text style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}>地点：{item.location}</Text> : null}
          {item.teacher ? <Text style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}>教师：{item.teacher}</Text> : null}
          {item.credits != null ? <Text style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}>{item.credits} 学分</Text> : null}
        </View>
        {item.timeSlots.map((slot, i) => (
          <Text key={i} style={[styles.slotText, { color: theme.colors.onSurfaceVariant }]}>
            {formatTimeSlot(slot)}
          </Text>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView horizontal style={styles.semesterScroll} contentContainerStyle={styles.semesterContent}>
        {semesters.map((s) => (
          <Chip
            key={s.id}
            selected={s.id === filterSemesterId}
            onPress={() => setManualFilterId(s.id)}
            style={styles.chip}
          >
            {s.name}
          </Chip>
        ))}
      </ScrollView>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={filtered.length === 0 ? styles.empty : styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>该学期暂无课程</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  semesterScroll: {
    flexGrow: 0,
  },
  semesterContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  chip: {
    marginRight: 6,
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
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
  },
  card: {
    flexDirection: 'row',
    
    borderRadius: 8,
    marginVertical: 4,
    minHeight: 72,
    overflow: 'hidden',
    elevation: 1,
  },
  colorBar: {
    width: 6,
  },
  cardBody: {
    flex: 1,
    padding: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
    gap: 8,
  },
  meta: {
    fontSize: 12,
    color: '#666',
  },
  slotText: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  separator: {
    height: 4,
  },
});

export default CourseList;
