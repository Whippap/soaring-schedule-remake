import { useState } from 'react';
import { FAB, SegmentedButtons, Text, useTheme } from 'react-native-paper';
import { StyleSheet, View, Alert } from 'react-native';
import type { Course, Semester } from '@/types';
import { createDefaultSemester } from '@/types';
import { useSettingsStore } from '@/stores/settingsStore';
import { findSemesterForDate } from '@/utils/scheduleDate';
import { SemesterForm } from '@/components/SemesterForm';
import { CourseForm } from '@/components/CourseForm';
import { CourseList } from '@/components/CourseList';

type Mode = 'courses' | 'semesters';

export default function ScheduleScreen() {
  const theme = useTheme();
  const semesters = useSettingsStore((s) => s.semesters);
  const addSemester = useSettingsStore((s) => s.addSemester);
  const updateSemester = useSettingsStore((s) => s.updateSemester);
  const deleteSemester = useSettingsStore((s) => s.deleteSemester);

  const [mode, setMode] = useState<Mode>('courses');
  const [semesterFormVisible, setSemesterFormVisible] = useState(false);
  const [editingSemester, setEditingSemester] = useState<Semester | null>(null);
  const [courseFormVisible, setCourseFormVisible] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const effectiveSemesters =
    semesters.length > 0 ? semesters : [createDefaultSemester()];
  const currentSemester = findSemesterForDate(new Date(), semesters);

  const openNewSemester = () => {
    setEditingSemester(null);
    setSemesterFormVisible(true);
  };

  const openEditSemester = (s: Semester) => {
    setEditingSemester(s);
    setSemesterFormVisible(true);
  };

  const handleSaveSemester = (s: Semester) => {
    if (editingSemester) {
      updateSemester(s.id, s);
    } else {
      addSemester(s);
    }
    setSemesterFormVisible(false);
  };

  const handleSaveCourse = () => {
    setCourseFormVisible(false);
    setEditingCourse(null);
  };

  const openNewCourse = () => {
    setEditingCourse(null);
    setCourseFormVisible(true);
  };

  const openEditCourse = (c: Course) => {
    setEditingCourse(c);
    setCourseFormVisible(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SegmentedButtons
        value={mode}
        onValueChange={(v) => setMode(v as Mode)}
        buttons={[
          { value: 'courses', label: '课程' },
          { value: 'semesters', label: '学期' },
        ]}
        style={styles.segmented}
      />
      {mode === 'courses' ? (
        <CourseList
          semesters={effectiveSemesters}
          currentSemesterId={currentSemester.id}
          onEdit={openEditCourse}
        />
      ) : (
        <SemesterList
          semesters={effectiveSemesters}
          currentId={currentSemester.id}
          onEdit={openEditSemester}
          onDelete={(s) => {
            Alert.alert('删除学期', `确定删除「${s.name}」吗？该学期下所有课程将被删除。`, [
              { text: '取消', style: 'cancel' },
              { text: '删除', style: 'destructive', onPress: () => deleteSemester(s.id) },
            ]);
          }}
        />
      )}

      {mode === 'semesters' ? (
        <FAB icon="plus" style={styles.fab} onPress={openNewSemester} label="新建学期" />
      ) : (
        <FAB icon="plus" style={styles.fab} onPress={openNewCourse} label="新建课程" />
      )}

      <SemesterForm
        visible={semesterFormVisible}
        existing={semesters}
        editing={editingSemester}
        onDismiss={() => setSemesterFormVisible(false)}
        onSave={handleSaveSemester}
      />
      <CourseForm
        visible={courseFormVisible}
        semesters={effectiveSemesters}
        defaultSemesterId={currentSemester.id}
        editing={editingCourse}
        onDismiss={() => setCourseFormVisible(false)}
        onSaved={handleSaveCourse}
      />
    </View>
  );
}

interface SemesterListProps {
  semesters: Semester[];
  currentId: string;
  onEdit: (s: Semester) => void;
  onDelete: (s: Semester) => void;
}

function SemesterList({ semesters, currentId, onEdit, onDelete }: SemesterListProps) {
  const theme = useTheme();
  const handleDelete = (s: Semester) => {
    onDelete(s);
  };
  return (
    <View style={styles.semesterList}>
      {semesters.map((s) => (
        <View key={s.id} style={[styles.semesterCard, { borderBottomColor: theme.colors.outline }]}>
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
              {s.name}
              {s.id === currentId ? '  (当前)' : ''}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {s.startDate} ~ {s.endDate} · {s.weekCount}周 · {s.sectionCount}节/天
            </Text>
          </View>
          <Text style={[styles.editLink, { color: theme.colors.primary }]} onPress={() => onEdit(s)}>
            编辑
          </Text>
          <Text style={[styles.deleteLink, { color: '#e74c3c' }]} onPress={() => handleDelete(s)}>
            删除
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmented: {
    margin: 12,
  },
  semesterList: {
    paddingHorizontal: 12,
  },
  semesterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 16,
  },
  editLink: {},
  deleteLink: {
    color: '#e74c3c',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
