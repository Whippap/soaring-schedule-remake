import { useState, useLayoutEffect, useRef } from 'react';
import { Platform, StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import { Text, HelperText } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO, isValid } from 'date-fns';
import type { Semester, SectionTime } from '@/types';
import { createDefaultSemester } from '@/types';
import { computeSemesterEndDate } from '@/utils/scheduleDate';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useDesignTokens } from '@/hooks/useDesignTokens';
import { Icon } from '@/components/Icon';
import { FormModal } from '@/components/FormModal';
import { AppTextField } from '@/components/AppTextField';

interface Props {
  visible: boolean;
  existing: Semester[];
  editing?: Semester | null;
  onDismiss: () => void;
  onSave: (semester: Semester) => void;
}

const CAMPUS_PRESETS: Record<string, SectionTime[]> = {
  长安校区: [
    { start: '08:30', end: '09:15' },
    { start: '09:25', end: '10:10' },
    { start: '10:30', end: '11:15' },
    { start: '11:25', end: '12:10' },
    { start: '12:20', end: '13:05' },
    { start: '13:05', end: '13:50' },
    { start: '14:00', end: '14:45' },
    { start: '14:55', end: '15:40' },
    { start: '15:55', end: '16:40' },
    { start: '16:55', end: '17:40' },
    { start: '19:00', end: '19:45' },
    { start: '19:55', end: '20:40' },
    { start: '20:40', end: '21:25' },
  ],
  友谊校区夏季: [
    { start: '08:30', end: '09:15' },
    { start: '09:25', end: '10:10' },
    { start: '10:30', end: '11:15' },
    { start: '11:25', end: '12:10' },
    { start: '12:20', end: '13:05' },
    { start: '13:05', end: '13:50' },
    { start: '14:30', end: '15:15' },
    { start: '15:30', end: '16:15' },
    { start: '16:30', end: '17:15' },
    { start: '19:00', end: '19:45' },
    { start: '19:55', end: '20:40' },
    { start: '20:40', end: '21:25' },
  ],
  友谊校区冬季: [
    { start: '08:30', end: '09:15' },
    { start: '09:25', end: '10:10' },
    { start: '10:30', end: '11:15' },
    { start: '11:25', end: '12:10' },
    { start: '12:20', end: '13:05' },
    { start: '13:05', end: '13:50' },
    { start: '14:00', end: '14:45' },
    { start: '15:00', end: '15:45' },
    { start: '16:00', end: '16:45' },
    { start: '19:00', end: '19:45' },
    { start: '19:55', end: '20:40' },
    { start: '20:40', end: '21:25' },
  ],
};

const PRESET_LABELS = [
  { value: '长安校区', label: '长安' },
  { value: '友谊校区夏季', label: '友谊夏' },
  { value: '友谊校区冬季', label: '友谊冬' },
];

export function SemesterForm({ visible, existing, editing, onDismiss, onSave }: Props) {
  const dt = useDesignTokens();
  const showSnackbar = useSnackbar();
  const [name, setName] = useState(editing?.name ?? '');
  const [startDate, setStartDate] = useState(editing?.startDate ?? '');
  const [weekCount, setWeekCount] = useState(String(editing?.weekCount ?? 20));
  const [sectionCount, setSectionCount] = useState(String(editing?.sectionCount ?? 13));
  const [sectionTimes, setSectionTimes] = useState<SectionTime[]>(
    editing?.sectionTimes ?? createDefaultSemester().sectionTimes,
  );
  const [selectedPreset, setSelectedPreset] = useState('长安校区');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // 当弹窗打开或编辑对象变化时，同步重置表单
  const editingId = editing?.id ?? '__new__';
  const prevVisibleRef = useRef(visible);
  const lastResetIdRef = useRef(editingId);

  // ref 手动检测变化，无需 deps 数组；setState 函数稳定，不会导致无限循环
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const justOpened = visible && !prevVisibleRef.current;
    prevVisibleRef.current = visible;

    if (justOpened || editingId !== lastResetIdRef.current) {
      lastResetIdRef.current = editingId;
      setName(editing?.name ?? '');
      setStartDate(editing?.startDate ?? '');
      setWeekCount(String(editing?.weekCount ?? 20));
      setSectionCount(String(editing?.sectionCount ?? 13));
      setSectionTimes(editing?.sectionTimes ?? createDefaultSemester().sectionTimes);
    }
  });

  const parsedDate = (() => {
    if (!startDate) return new Date();
    const d = parseISO(startDate);
    return isValid(d) ? d : new Date();
  })();

  const handleDateChange = (_: unknown, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setStartDate(format(date, 'yyyy-MM-dd'));
    }
  };

  const endDate = startDate
    ? computeSemesterEndDate(startDate, parseInt(weekCount, 10) || 0)
    : '';

  const handlePreset = (preset: string) => {
    setSelectedPreset(preset);
    setSectionTimes(CAMPUS_PRESETS[preset]);
    setSectionCount(String(CAMPUS_PRESETS[preset].length));
  };

  const handleSectionCountChange = (value: string) => {
    setSectionCount(value);
    const n = parseInt(value, 10) || 0;
    if (n > sectionTimes.length) {
      const last = sectionTimes[sectionTimes.length - 1] ?? { start: '08:30', end: '09:15' };
      const [lh, lm] = last.end.split(':').map(Number);
      const cursor = (lh ?? 8) * 60 + (lm ?? 30) + 10;
      const appended = [...sectionTimes];
      for (let i = appended.length; i < n; i++) {
        const start = cursor;
        const end = start + 45;
        appended.push({ start: formatTime(start), end: formatTime(end) });
      }
      setSectionTimes(appended);
    } else if (n < sectionTimes.length) {
      setSectionTimes(sectionTimes.slice(0, n));
    }
  };

  const hasOverlap = (times: SectionTime[]): boolean => {
    for (let i = 1; i < times.length; i++) {
      if (times[i].start < times[i - 1].end) return true;
    }
    return false;
  };

  const handleSave = () => {
    const trimmed = name.trim();
    const weeks = parseInt(weekCount, 10);
    const sections = parseInt(sectionCount, 10);
    if (!trimmed) return;
    if (!startDate || Number.isNaN(weeks) || weeks <= 0 || Number.isNaN(sections) || sections <= 0) return;
    if (hasOverlap(sectionTimes)) {
      showSnackbar('课节时间存在重叠或倒置');
      return;
    }
    const draft: Omit<Semester, 'id'> = {
      name: trimmed,
      startDate,
      endDate,
      weekCount: weeks,
      sectionCount: sections,
      sectionTimes,
    };
    const overlap = existing.some(
      (s) =>
        s.id !== editing?.id &&
        s.startDate <= draft.endDate &&
        draft.startDate <= s.endDate,
    );
    if (overlap) {
      showSnackbar('该学期日期范围与已有学期重叠');
      return;
    }
    onSave({ id: editing?.id ?? String(Date.now()), ...draft });
  };

  return (
    <FormModal
      visible={visible}
      onDismiss={onDismiss}
      contentContainerStyle={[
        styles.modal,
        {
          backgroundColor: dt.colors.surface,
          borderRadius: dt.borderRadius.xl,
        },
      ]}
    >
        <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
          <Text
            style={{
              fontSize: dt.fontSize.subheading,
              fontWeight: dt.fontWeight.subheading,
              color: dt.colors.text,
              marginBottom: dt.spacing.md,
            }}
          >
            {editing ? '编辑学期' : '新建学期'}
          </Text>

          <AppTextField
            label="学期名称 *"
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholder="如 2025-2026春"
          />
          <Text style={{ fontSize: dt.fontSize.caption, color: dt.colors.textSecondary, marginTop: 8, marginBottom: 6 }}>
            开始日期 <Text style={{ color: dt.colors.destructive }}>*</Text>
          </Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            style={[
              styles.dateInput,
              {
                borderColor: dt.colors.border,
                borderRadius: dt.borderRadius.md,
                backgroundColor: dt.colors.surface,
              },
            ]}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: dt.fontSize.body, color: startDate ? dt.colors.text : dt.colors.textMuted }}>
              {startDate || '选择开始日期'}
            </Text>
            <Icon name="calendar-month" size={20} color={dt.colors.textSecondary} />
          </TouchableOpacity>
          {showDatePicker ? (
            <DateTimePicker
              value={parsedDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
            />
          ) : null}
          <View style={styles.row}>
            <AppTextField
              label="周数 *"
              value={weekCount}
              onChangeText={setWeekCount}
              style={styles.halfInput}
              keyboardType="numeric"
            />
            <AppTextField
              label="每天节数 *"
              value={sectionCount}
              onChangeText={handleSectionCountChange}
              style={styles.halfInput}
              keyboardType="numeric"
            />
          </View>
          {endDate ? (
            <HelperText type="info" style={{ color: dt.colors.textSecondary }}>
              结束日期：{endDate}
            </HelperText>
          ) : null}

          <Text
            style={{
              fontSize: dt.fontSize.caption,
              fontWeight: dt.fontWeight.subheading,
              color: dt.colors.text,
              marginTop: dt.spacing.md,
              marginBottom: dt.spacing.sm,
            }}
          >
            课节时间预设
          </Text>
          <View style={styles.presetRow}>
            {PRESET_LABELS.map((p) => (
              <TouchableOpacity
                key={p.value}
                onPress={() => handlePreset(p.value)}
                style={[
                  styles.presetBtn,
                  {
                    borderRadius: dt.borderRadius.md,
                    borderColor: selectedPreset === p.value ? dt.colors.primary : dt.colors.border,
                    backgroundColor: selectedPreset === p.value ? `${dt.colors.primary}14` : dt.colors.surfaceAlt,
                  },
                ]}
              >
                <Icon
                  name={selectedPreset === p.value ? 'check' : 'course'}
                  size={14}
                  color={selectedPreset === p.value ? dt.colors.primary : dt.colors.textMuted}
                />
                <Text
                  style={{
                    fontSize: dt.fontSize.caption,
                    fontWeight: selectedPreset === p.value ? dt.fontWeight.subheading : dt.fontWeight.body,
                    color: selectedPreset === p.value ? dt.colors.primary : dt.colors.textSecondary,
                    marginLeft: 4,
                  }}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.actions, { marginTop: dt.spacing.xl }]}>
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
        </ScrollView>
    </FormModal>
  );
}

function formatTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const m = (totalMinutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

const styles = StyleSheet.create({
  modal: { margin: 16, padding: 20, maxHeight: '85%' },
  input: { marginBottom: 8 },
  dateInput: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 14, marginBottom: 8,
    borderWidth: 1,
  },
  halfInput: { flex: 1, marginHorizontal: 4 },
  row: { flexDirection: 'row', marginHorizontal: -4 },
  presetRow: { flexDirection: 'row', gap: 8 },
  presetBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4 },
});
