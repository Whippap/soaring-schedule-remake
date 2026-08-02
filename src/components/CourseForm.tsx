import { useState } from 'react';
import {
  Modal,
  Portal,
  TextInput,
  Text,
  HelperText,
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
import { useDesignTokens } from '@/hooks/useDesignTokens';
import { Icon } from '@/components/Icon';

interface Props {
  visible: boolean;
  semesters: Semester[];
  defaultSemesterId: string;
  editing?: Course | null;
  onDismiss: () => void;
  onSaved: () => void;
}

const DAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const ASSESSMENT_OPTIONS: { value: AssessmentMethod; label: string }[] = [
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
  if (weeks.length === 0) return '';
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
  const dt = useDesignTokens();
  const showSnackbar = useSnackbar();

  function emptySlot(): TimeSlot {
    return { weekRange: '1-16', repeatRule: RepeatRule.ALL, dayOfWeek: 1, classSections: [1, 2] };
  }

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

  const updateSlot = (index: number, updates: Partial<TimeSlot>) => {
    setTimeSlots((slots) =>
      slots.map((slot, i) => (i === index ? { ...slot, ...updates } : slot)),
    );
  };

  const toggleWeek = (index: number, week: number) => {
    setTimeSlots((slots) =>
      slots.map((slot, i) => {
        if (i !== index) return slot;
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
      if (s <= maxSection) sections.push(s);
    }
    updateSlot(index, { classSections: sections });
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) { showSnackbar('请输入课程名称'); return; }
    if (timeSlots.length === 0) { showSnackbar('至少需要一个时间段'); return; }
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
    if (conflict) { showSnackbar(conflict); return; }
    if (editing) { updateCourse(editing.id, draft); }
    else { addCourse(draft); }
    onSaved();
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modal,
          { backgroundColor: dt.colors.surface, borderRadius: dt.borderRadius.xl },
        ]}
      >
        {/* Fixed Header */}
        <View style={[styles.modalHeader, { borderBottomColor: dt.colors.border }]}>
          <Text
            style={{
              fontSize: dt.fontSize.subheading,
              fontWeight: dt.fontWeight.subheading,
              color: dt.colors.text,
            }}
          >
            {editing ? '编辑课程' : '新建课程'}
          </Text>
          <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="close" size={22} color={dt.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.modalBody}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {/* Section: Basic Info */}
          <SectionLabel dt={dt} title="基本信息" />
          <TextInput
            label="课程名称 *"
            value={name}
            onChangeText={setName}
            style={styles.input}
          />
          <Text style={[styles.sectionSub, { color: dt.colors.textSecondary, fontSize: dt.fontSize.caption }]}>
            所属学期 <Text style={{ color: dt.colors.destructive, fontSize: dt.fontSize.caption }}>*</Text>
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {semesters.map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => setSemesterId(s.id)}
                style={[
                  styles.chip,
                  {
                    borderRadius: dt.borderRadius.pill,
                    borderColor: s.id === semesterId ? dt.colors.primary : dt.colors.border,
                    backgroundColor: s.id === semesterId ? `${dt.colors.primary}14` : dt.colors.surfaceAlt,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: dt.fontSize.caption,
                    fontWeight: s.id === semesterId ? dt.fontWeight.subheading : dt.fontWeight.body,
                    color: s.id === semesterId ? dt.colors.primary : dt.colors.textSecondary,
                  }}
                >
                  {s.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.row}>
            <TextInput label="课程代码" value={code} onChangeText={setCode} style={styles.halfInput} />
            <TextInput label="学分" value={credits} onChangeText={setCredits} style={styles.halfInput} keyboardType="numeric" />
          </View>
          <View style={styles.row}>
            <TextInput label="地点" value={location} onChangeText={setLocation} style={styles.halfInput} />
            <TextInput label="教师" value={teacher} onChangeText={setTeacher} style={styles.halfInput} />
          </View>

          {/* Section: Details */}
          <SectionLabel dt={dt} title="详细信息" />
          <Text style={[styles.sectionSub, { color: dt.colors.textSecondary, fontSize: dt.fontSize.caption }]}>
            考核方式
          </Text>
          <View style={styles.assessmentRow}>
            {ASSESSMENT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setAssessmentMethod(opt.value)}
                style={[
                  styles.assessBtn,
                  {
                    borderRadius: dt.borderRadius.pill,
                    borderColor: assessmentMethod === opt.value ? dt.colors.primary : dt.colors.border,
                    backgroundColor: assessmentMethod === opt.value ? `${dt.colors.primary}14` : dt.colors.surfaceAlt,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: dt.fontSize.caption,
                    fontWeight: assessmentMethod === opt.value ? dt.fontWeight.subheading : dt.fontWeight.body,
                    color: assessmentMethod === opt.value ? dt.colors.primary : dt.colors.textSecondary,
                  }}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionSub, { color: dt.colors.textSecondary, fontSize: dt.fontSize.caption }]}>
            颜色
          </Text>
          <View style={styles.colorRow}>
            {PRESET_COLORS.map((c) => {
              const isSelected = color === c;
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => setColor(c)}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    isSelected && { borderColor: dt.colors.text, borderWidth: 3 },
                  ]}
                >
                  {isSelected ? (
                    <Icon name="check" size={14} color={dt.colors.onPrimary} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            label="备注"
            value={notes}
            onChangeText={setNotes}
            style={styles.input}
            multiline
          />

          {/* Section: Time Slots */}
          <SectionLabel dt={dt} title="时间段 *" />
          {timeSlots.map((slot, index) => (
            <View
              key={index}
              style={[
                styles.slotCard,
                {
                  borderColor: dt.colors.border,
                  borderRadius: dt.borderRadius.lg,
                },
              ]}
            >
              <View style={styles.slotHeader}>
                <Text
                  style={{
                    fontSize: dt.fontSize.caption,
                    fontWeight: dt.fontWeight.subheading,
                    color: dt.colors.text,
                  }}
                >
                  时间段 {index + 1}
                </Text>
                {timeSlots.length > 1 && (
                  <TouchableOpacity
                    onPress={() => setTimeSlots((slots) => slots.filter((_, i) => i !== index))}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon name="delete" size={18} color={dt.colors.destructive} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={{ fontSize: dt.fontSize.caption, color: dt.colors.textSecondary, marginBottom: 8 }}>
                {formatTimeSlot(slot)}
              </Text>

              <Text style={[styles.sectionSub, { color: dt.colors.textSecondary, fontSize: dt.fontSize.caption }]}>
                星期
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {DAY_NAMES.slice(1).map((dayName, i) => {
                  const selected = slot.dayOfWeek === i + 1;
                  return (
                    <TouchableOpacity
                      key={dayName}
                      onPress={() => updateSlot(index, { dayOfWeek: i + 1 })}
                      style={[
                        styles.chip,
                        {
                          borderRadius: dt.borderRadius.pill,
                          borderColor: selected ? dt.colors.primary : dt.colors.border,
                          backgroundColor: selected ? `${dt.colors.primary}14` : dt.colors.surfaceAlt,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: dt.fontSize.caption,
                          fontWeight: selected ? dt.fontWeight.subheading : dt.fontWeight.body,
                          color: selected ? dt.colors.primary : dt.colors.textSecondary,
                        }}
                      >
                        {dayName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={[styles.sectionSub, { color: dt.colors.textSecondary, fontSize: dt.fontSize.caption }]}>
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

              <Text style={[styles.sectionSub, { color: dt.colors.textSecondary, fontSize: dt.fontSize.caption }]}>
                重复规则
              </Text>
              <View style={styles.repeatRow}>
                {REPEAT_OPTIONS.map((opt) => {
                  const selected = slot.repeatRule === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => updateSlot(index, { repeatRule: opt.value as RepeatRule })}
                      style={[
                        styles.chip,
                        {
                          borderRadius: dt.borderRadius.pill,
                          borderColor: selected ? dt.colors.primary : dt.colors.border,
                          backgroundColor: selected ? `${dt.colors.primary}14` : dt.colors.surfaceAlt,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: dt.fontSize.caption,
                          fontWeight: selected ? dt.fontWeight.subheading : dt.fontWeight.body,
                          color: selected ? dt.colors.primary : dt.colors.textSecondary,
                        }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.sectionSub, { color: dt.colors.textSecondary, fontSize: dt.fontSize.caption }]}>
                周数 (1-{maxWeek})
              </Text>
              <View style={styles.weekGrid}>
                {Array.from({ length: maxWeek }, (_, i) => i + 1).map((w) => {
                  const selected = parseWeeksForToggling(slot.weekRange).includes(w);
                  return (
                    <TouchableOpacity
                      key={w}
                      onPress={() => toggleWeek(index, w)}
                      style={[
                        styles.weekCell,
                        {
                          borderColor: selected ? dt.colors.primary : dt.colors.border,
                          backgroundColor: selected ? dt.colors.primary : 'transparent',
                          borderRadius: dt.borderRadius.sm,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.weekText,
                          {
                            color: selected ? dt.colors.onPrimary : dt.colors.textSecondary,
                            fontSize: dt.fontSize.caption,
                            fontWeight: selected ? dt.fontWeight.subheading : dt.fontWeight.body,
                          },
                        ]}
                      >
                        {w}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <HelperText type="info" style={{ color: dt.colors.textSecondary, fontSize: dt.fontSize.label }}>
                已选节次：{formatSections(slot.classSections)}
              </HelperText>
            </View>
          ))}

          <TouchableOpacity
            onPress={() => setTimeSlots((slots) => [...slots, emptySlot()])}
            style={[
              styles.addSlotBtn,
              {
                borderColor: dt.colors.border,
                borderRadius: dt.borderRadius.md,
              },
            ]}
          >
            <Icon name="plus" size={16} color={dt.colors.primary} />
            <Text style={{ color: dt.colors.primary, fontSize: dt.fontSize.caption, marginLeft: 4 }}>
              添加时间段
            </Text>
          </TouchableOpacity>

          <View style={{ height: 80 }} />
        </ScrollView>

        {/* Fixed Bottom Actions */}
        <View style={[styles.footer, { borderTopColor: dt.colors.border, backgroundColor: dt.colors.surface }]}>
          <TouchableOpacity
            onPress={onDismiss}
            style={{ paddingHorizontal: 16, paddingVertical: 10 }}
          >
            <Text style={{ color: dt.colors.textSecondary, fontSize: dt.fontSize.body }}>取消</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            style={{
              paddingHorizontal: 24,
              paddingVertical: 10,
              backgroundColor: dt.colors.primary,
              borderRadius: dt.borderRadius.md,
            }}
          >
            <Text style={{ color: dt.colors.onPrimary, fontSize: dt.fontSize.body, fontWeight: dt.fontWeight.subheading }}>
              保存
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </Portal>
  );
}

function SectionLabel({ dt, title }: { dt: ReturnType<typeof useDesignTokens>; title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 8 }}>
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: dt.colors.border }} />
      <Text
        style={{
          fontSize: dt.fontSize.label,
          fontWeight: dt.fontWeight.subheading,
          color: dt.colors.textMuted,
          marginHorizontal: 12,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        {title}
      </Text>
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: dt.colors.border }} />
    </View>
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
        for (let w = start; w <= end; w++) weeks.push(w);
      }
    } else {
      const n = parseInt(trimmed, 10);
      if (!Number.isNaN(n)) weeks.push(n);
    }
  }
  return weeks;
}

const styles = StyleSheet.create({
  modal: { margin: 8, maxHeight: '92%', overflow: 'hidden' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalBody: { paddingHorizontal: 20 },
  input: { marginBottom: 8 },
  halfInput: { flex: 1, marginHorizontal: 4 },
  row: { flexDirection: 'row', marginHorizontal: -4 },
  sectionSub: { marginTop: 8, marginBottom: 6 },
  chipScroll: { marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1.5, marginRight: 8 },
  assessmentRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  assessBtn: { paddingHorizontal: 18, paddingVertical: 9, borderWidth: 1.5 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 12 },
  colorDot: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 2, borderColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  slotCard: { borderWidth: 1, padding: 14, marginBottom: 10 },
  slotHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  repeatRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  weekGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  weekCell: {
    width: 34, height: 34,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  weekText: {},
  addSlotBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderWidth: 1.5, borderStyle: 'dashed',
    marginTop: 4, marginBottom: 8,
  },
  footer: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
    padding: 12, gap: 4, borderTopWidth: StyleSheet.hairlineWidth,
  },
});
