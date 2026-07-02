import { useState, useMemo } from 'react';
import {
  Modal,
  Portal,
  TextInput,
  Button,
  Text,
  Chip,
  SegmentedButtons,
  HelperText,
  IconButton,
  useTheme,
} from 'react-native-paper';
import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import type { Course, Semester, TimeSlot } from '@/types';
import { AssessmentMethod, PRESET_COLORS, RepeatRule } from '@/types';
import { formatSections, formatTimeSlot } from '@/utils/scheduleDate';
import { findConflictDescription } from '@/utils/timeConflict';
import { useCourseStore } from '@/stores/courseStore';
import { useSnackbar } from '@/hooks/useSnackbar';

interface Props {
  visible: boolean;
  semesters: Semester[];
  defaultSemesterId: string;
  editing?: Course | null;
  onDismiss: () => void;
  onSaved: () => void;
}

const DAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const ASSESSMENT_OPTIONS = [
  { value: AssessmentMethod.EXAM, label: '考试' },
  { value: AssessmentMethod.INSPECTION, label: '考察' },
  { value: AssessmentMethod.PNP, label: 'PnP' },
];
const REPEAT_OPTIONS = [
  { value: RepeatRule.ALL, label: '每周' },
  { value: RepeatRule.ODD, label: '单周' },
  { value: RepeatRule.EVEN, label: '双周' },
];

function weekRangeToText(weeks: number[]): string {
  if (weeks.length === 0) {
    return '';
  }
  const sorted = [...weeks].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const cur = sorted[i];
    if (cur === prev + 1) {
      prev = cur;
    } else {
      parts.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = cur;
      prev = cur;
    }
  }
  return parts.join(',');
}

export function CourseForm({
  visible,
  semesters,
  defaultSemesterId,
  editing,
  onDismiss,
  onSaved,
}: Props) {
  const theme = useTheme();
  const showSnackbar = useSnackbar();
  const ts = useMemo(() => createThemedStyles(theme), [theme]);
  const [name, setName] = useState(editing?.name ?? '');
  const [semesterId, setSemesterId] = useState(editing?.semesterId ?? defaultSemesterId);
  const [code, setCode] = useState(editing?.code ?? '');
  const [location, setLocation] = useState(editing?.location ?? '');
  const [teacher, setTeacher] = useState(editing?.teacher ?? '');
  const [credits, setCredits] = useState(editing?.credits ? String(editing.credits) : '');
  const [assessmentMethod, setAssessmentMethod] = useState<AssessmentMethod>(
    editing?.assessmentMethod ?? AssessmentMethod.EXAM,
  );
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [color, setColor] = useState(editing?.color ?? PRESET_COLORS[0]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(editing?.timeSlots ?? [emptySlot()]);
  const addCourse = useCourseStore((s) => s.addCourse);
  const updateCourse = useCourseStore((s) => s.updateCourse);
  const courses = useCourseStore((s) => s.courses);

  const selectedSemester = semesters.find((s) => s.id === semesterId);
  const maxWeek = selectedSemester?.weekCount ?? 20;
  const maxSection = selectedSemester?.sectionCount ?? 13;

  function emptySlot(): TimeSlot {
    return {
      weekRange: '1-16',
      repeatRule: RepeatRule.ALL,
      dayOfWeek: 1,
      classSections: [1, 2],
    };
  }

  const updateSlot = (index: number, updates: Partial<TimeSlot>) => {
    setTimeSlots((slots) =>
      slots.map((slot, i) => (i === index ? { ...slot, ...updates } : slot)),
    );
  };

  const toggleWeek = (index: number, week: number) => {
    setTimeSlots((slots) =>
      slots.map((slot, i) => {
        if (i !== index) {
          return slot;
        }
        const weeks = parseWeeksForToggling(slot.weekRange);
        const next = weeks.includes(week)
          ? weeks.filter((w) => w !== week)
          : [...weeks, week].sort((a, b) => a - b);
        return { ...slot, weekRange: weekRangeToText(next) };
      }),
    );
  };

  const setSectionRange = (index: number, start: number, end: number) => {
    const sections: number[] = [];
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    for (let s = lo; s <= hi; s++) {
      if (s <= maxSection) {
        sections.push(s);
      }
    }
    updateSlot(index, { classSections: sections });
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      showSnackbar('请输入课程名称');
      return;
    }
    if (timeSlots.length === 0) {
      showSnackbar('至少需要一个时间段');
      return;
    }
    const draft: Course = {
      id: editing?.id ?? uuidv4(),
      name: trimmed,
      semesterId,
      timeSlots,
      code: code.trim() || undefined,
      location: location.trim() || undefined,
      teacher: teacher.trim() || undefined,
      credits: credits ? parseFloat(credits) : undefined,
      assessmentMethod,
      notes: notes.trim() || undefined,
      color,
    };
    const conflict = findConflictDescription(draft, courses, editing?.id);
    if (conflict) {
      showSnackbar(conflict);
      return;
    }
    if (editing) {
      updateCourse(editing.id, draft);
    } else {
      addCourse(draft);
    }
    onSaved();
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
        <ScrollView>
          <Text variant="titleLarge" style={styles.title}>
            {editing ? '编辑课程' : '新建课程'}
          </Text>
          <TextInput
            label="课程名称 *"
            value={name}
            onChangeText={setName}
            style={styles.input}
          />
          <Text variant="labelLarge" style={styles.label}>
            所属学期
          </Text>
          <ScrollView horizontal style={styles.semesterScroll}>
            {semesters.map((s) => (
              <Chip
                key={s.id}
                selected={s.id === semesterId}
                onPress={() => setSemesterId(s.id)}
                style={styles.chip}
              >
                {s.name}
              </Chip>
            ))}
          </ScrollView>
          <View style={styles.row}>
            <TextInput
              label="课程代码"
              value={code}
              onChangeText={setCode}
              style={styles.halfInput}
            />
            <TextInput
              label="学分"
              value={credits}
              onChangeText={setCredits}
              style={styles.halfInput}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.row}>
            <TextInput
              label="地点"
              value={location}
              onChangeText={setLocation}
              style={styles.halfInput}
            />
            <TextInput
              label="教师"
              value={teacher}
              onChangeText={setTeacher}
              style={styles.halfInput}
            />
          </View>
          <Text variant="labelLarge" style={styles.label}>
            考核方式
          </Text>
          <SegmentedButtons
            value={assessmentMethod}
            onValueChange={(v) => setAssessmentMethod(v as AssessmentMethod)}
            buttons={ASSESSMENT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
          <TextInput
            label="备注"
            value={notes}
            onChangeText={setNotes}
            style={styles.input}
            multiline
          />
          <Text variant="labelLarge" style={styles.label}>
            颜色
          </Text>
          <View style={styles.colorRow}>
            {PRESET_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setColor(c)}
                style={[styles.colorDot, { backgroundColor: c }, color === c && ts.colorDotSelected]}
              />
            ))}
          </View>

          <Text variant="labelLarge" style={styles.label}>
            时间段
          </Text>
          {timeSlots.map((slot, index) => (
            <View key={index} style={ts.slotCard}>
              <View style={styles.slotHeader}>
                <Text variant="labelLarge">时间段 {index + 1}</Text>
                {timeSlots.length > 1 && (
                  <IconButton
                    icon="delete"
                    size={20}
                    onPress={() =>
                      setTimeSlots((slots) => slots.filter((_, i) => i !== index))
                    }
                  />
                )}
              </View>
              <Text variant="bodySmall" style={ts.preview}>
                {formatTimeSlot(slot)}
              </Text>
              <Text variant="labelMedium" style={styles.subLabel}>
                星期
              </Text>
              <ScrollView horizontal>
                {DAY_NAMES.slice(1).map((dayName, i) => (
                  <Chip
                    key={dayName}
                    selected={slot.dayOfWeek === i + 1}
                    onPress={() => updateSlot(index, { dayOfWeek: i + 1 })}
                    style={styles.chip}
                  >
                    {dayName}
                  </Chip>
                ))}
              </ScrollView>
              <Text variant="labelMedium" style={styles.subLabel}>
                课节 (1-{maxSection})
              </Text>
              <View style={styles.row}>
                <TextInput
                  label="开始节"
                  value={String(slot.classSections[0] ?? 1)}
                  onChangeText={(v) => {
                    const n = parseInt(v, 10) || 1;
                    setSectionRange(index, n, slot.classSections[slot.classSections.length - 1] ?? n);
                  }}
                  style={styles.halfInput}
                  keyboardType="numeric"
                />
                <TextInput
                  label="结束节"
                  value={String(slot.classSections[slot.classSections.length - 1] ?? 1)}
                  onChangeText={(v) => {
                    const n = parseInt(v, 10) || 1;
                    setSectionRange(index, slot.classSections[0] ?? n, n);
                  }}
                  style={styles.halfInput}
                  keyboardType="numeric"
                />
              </View>
              <Text variant="labelMedium" style={styles.subLabel}>
                重复规则
              </Text>
              <SegmentedButtons
                value={slot.repeatRule}
                onValueChange={(v) => updateSlot(index, { repeatRule: v as RepeatRule })}
                buttons={REPEAT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              />
              <Text variant="labelMedium" style={styles.subLabel}>
                周数 (1-{maxWeek})
              </Text>
              <View style={styles.weekGrid}>
                {Array.from({ length: maxWeek }, (_, i) => i + 1).map((w) => {
                  const selected = parseWeeksForToggling(slot.weekRange).includes(w);
                  return (
                    <TouchableOpacity
                      key={w}
                      onPress={() => toggleWeek(index, w)}
                      style={[ts.weekCell, selected && ts.weekCellSelected]}
                    >
                      <Text style={selected ? ts.weekTextSelected : ts.weekText}>
                        {w}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <HelperText type="info">已选：{formatSections(slot.classSections)}</HelperText>
            </View>
          ))}
          <Button
            mode="outlined"
            onPress={() => setTimeSlots((slots) => [...slots, emptySlot()])}
            style={styles.addSlot}
            icon="plus"
          >
            添加时间段
          </Button>

          <View style={styles.actions}>
            <Button onPress={onDismiss}>取消</Button>
            <Button mode="contained" onPress={handleSave}>
              保存
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

function parseWeeksForToggling(weekRange: string): number[] {
  const weeks: number[] = [];
  for (const part of weekRange.split(',')) {
    const trimmed = part.trim();
    const dashIndex = trimmed.indexOf('-');
    if (dashIndex >= 0) {
      const start = parseInt(trimmed.slice(0, dashIndex), 10);
      const end = parseInt(trimmed.slice(dashIndex + 1), 10);
      if (!Number.isNaN(start) && !Number.isNaN(end)) {
        for (let w = start; w <= end; w++) {
          weeks.push(w);
        }
      }
    } else {
      const n = parseInt(trimmed, 10);
      if (!Number.isNaN(n)) {
        weeks.push(n);
      }
    }
  }
  return weeks;
}

const styles = StyleSheet.create({
  modal: { margin: 8, padding: 16, borderRadius: 12, maxHeight: '90%' },
  title: { marginBottom: 12, fontWeight: 'bold' },
  input: { marginBottom: 8 },
  halfInput: { flex: 1, marginHorizontal: 4 },
  row: { flexDirection: 'row', marginHorizontal: -4 },
  label: { marginTop: 8, marginBottom: 4 },
  subLabel: { marginTop: 8, marginBottom: 4 },
  semesterScroll: { flexDirection: 'row', marginBottom: 8 },
  chip: { marginRight: 6 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginVertical: 8 },
  colorDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
  slotHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weekGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  addSlot: { marginVertical: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 8 },
});

function createThemedStyles(theme: Record<string, unknown>) {
  const c = theme.colors as Record<string, string>;
  return StyleSheet.create({
    colorDotSelected: { borderColor: c.primary },
    slotCard: { borderWidth: 1, borderColor: c.outline, borderRadius: 8, padding: 12, marginVertical: 8 },
    preview: { color: c.onSurfaceVariant, marginVertical: 4 },
    weekCell: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: c.outline, alignItems: 'center', justifyContent: 'center' },
    weekCellSelected: { backgroundColor: c.primary, borderColor: c.primary },
    weekText: { color: c.onSurface },
    weekTextSelected: { color: 'white', fontWeight: 'bold' },
  });
}
