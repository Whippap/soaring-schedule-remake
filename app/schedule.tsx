import { useState } from 'react';
import { FAB, SegmentedButtons, Text } from 'react-native-paper';
import { View, Alert, StyleSheet } from 'react-native';
import type { Course, Semester } from '@/types';
import { createDefaultSemester } from '@/types';
import { useSettingsStore } from '@/stores/settingsStore';
import { useCourseStore } from '@/stores/courseStore';
import { findSemesterForDate } from '@/utils/scheduleDate';
import { SemesterForm } from '@/components/SemesterForm';
import { CourseForm } from '@/components/CourseForm';
import { CourseList } from '@/components/CourseList';
import { CourseDetailSheet } from '@/components/CourseDetailSheet';
import { ScreenContainer } from '@/components/ScreenContainer';
import { useDesignTokens } from '@/hooks/useDesignTokens';

type Mode = 'courses' | 'semesters';

export default function ScheduleScreen() {
  const dt = useDesignTokens();
  const semesters = useSettingsStore((s) => s.semesters);
  const addSemester = useSettingsStore((s) => s.addSemester);
  const updateSemester = useSettingsStore((s) => s.updateSemester);
  const deleteSemester = useSettingsStore((s) => s.deleteSemester);
  const deleteCourse = useCourseStore((s) => s.deleteCourse);

  const [mode, setMode] = useState<Mode>('courses');
  const [semesterFormVisible, setSemesterFormVisible] = useState(false);
  const [editingSemester, setEditingSemester] = useState<Semester | null>(null);
  const [courseFormVisible, setCourseFormVisible] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [detailCourse, setDetailCourse] = useState<Course | null>(null);

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

  const handleDeleteCourse = (course: Course) => {
    Alert.alert('删除课程', `确定删除「${course.name}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          deleteCourse(course.id);
          setDetailCourse(null);
        },
      },
    ]);
  };

  return (
    <ScreenContainer padded={false}>
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
          onDetail={setDetailCourse}
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
          dt={dt}
        />
      )}

      {mode === 'semesters' ? (
        <FAB icon="plus" style={styles.fab} onPress={openNewSemester} label="新建学期" />
      ) : (
        <FAB icon="plus" style={styles.fab} onPress={openNewCourse} label="新建课程" />
      )}

      <SemesterForm
        key={editingSemester?.id ?? 'new-semester'}
        visible={semesterFormVisible}
        existing={semesters}
        editing={editingSemester}
        onDismiss={() => setSemesterFormVisible(false)}
        onSave={handleSaveSemester}
      />
      <CourseForm
        key={editingCourse?.id ?? 'new-course'}
        visible={courseFormVisible}
        semesters={effectiveSemesters}
        defaultSemesterId={currentSemester.id}
        editing={editingCourse}
        onDismiss={() => setCourseFormVisible(false)}
        onSaved={handleSaveCourse}
      />
      <CourseDetailSheet
        course={detailCourse}
        onDismiss={() => setDetailCourse(null)}
        onDelete={handleDeleteCourse}
      />
    </ScreenContainer>
  );
}

interface SemesterListProps {
  semesters: Semester[];
  currentId: string;
  onEdit: (s: Semester) => void;
  onDelete: (s: Semester) => void;
  dt: ReturnType<typeof useDesignTokens>;
}

function SemesterList({ semesters, currentId, onEdit, onDelete, dt }: SemesterListProps) {
  return (
    <View style={styles.semesterList}>
      {semesters.map((s) => {
        const isDefault = s.id === 'default';
        return (
        <View
          key={s.id}
          style={[
            styles.semesterCard,
            {
              borderColor: s.id === currentId && !isDefault ? dt.colors.primary : dt.colors.border,
              borderWidth: s.id === currentId && !isDefault ? 1.5 : 1,
              backgroundColor: dt.colors.surface,
              borderRadius: dt.borderRadius.lg,
              opacity: isDefault ? 0.5 : 1,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: dt.fontSize.body, fontWeight: dt.fontWeight.subheading, color: isDefault ? dt.colors.textMuted : dt.colors.text }}>
                {s.name}
              </Text>
              {s.id === currentId ? (
                <View style={{ backgroundColor: dt.colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: dt.borderRadius.sm }}>
                  <Text style={{ fontSize: dt.fontSize.label, fontWeight: dt.fontWeight.label, color: dt.colors.onPrimary }}>当前</Text>
                </View>
              ) : null}
              {isDefault ? (
                <View style={{ backgroundColor: dt.colors.surfaceAlt, paddingHorizontal: 8, paddingVertical: 2, borderRadius: dt.borderRadius.sm }}>
                  <Text style={{ fontSize: dt.fontSize.label, color: dt.colors.textMuted }}>默认</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ fontSize: dt.fontSize.caption, color: isDefault ? dt.colors.textMuted : dt.colors.textSecondary, marginTop: 4 }}>
              {s.startDate} ~ {s.endDate} · {s.weekCount}周 · {s.sectionCount}节/天
            </Text>
          </View>
          {!isDefault ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Text
              style={{ fontSize: dt.fontSize.caption, color: dt.colors.primary, fontWeight: dt.fontWeight.subheading }}
              onPress={() => onEdit(s)}
            >
              编辑
            </Text>
            <Text
              style={{ fontSize: dt.fontSize.caption, color: dt.colors.destructive, fontWeight: dt.fontWeight.subheading }}
              onPress={() => onDelete(s)}
            >
              删除
            </Text>
          </View>
          ) : null}
        </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: { margin: 12 },
  semesterList: { paddingHorizontal: 12, gap: 8 },
  semesterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
