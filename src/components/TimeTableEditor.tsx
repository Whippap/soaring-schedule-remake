import { useState } from 'react';
import { StyleSheet, View, ScrollView, Alert } from 'react-native';
import {
  Modal,
  Portal,
  TextInput,
  Button,
  Text,
  SegmentedButtons,
  Switch,
  useTheme,
} from 'react-native-paper';
import type { SectionTime } from '@/types';

interface Props {
  visible: boolean;
  sectionTimes: SectionTime[];
  onDismiss: () => void;
  onSave: (times: SectionTime[]) => void;
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

const SECTION_DURATION = 45;

export function TimeTableEditor({ visible, sectionTimes, onDismiss, onSave }: Props) {
  const theme = useTheme();
  const [times, setTimes] = useState<SectionTime[]>(sectionTimes);
  const [uniform, setUniform] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('长安校区');

  const updateTime = (index: number, field: keyof SectionTime, value: string) => {
    setTimes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (uniform && field === 'start') {
        const end = addMinutes(value, SECTION_DURATION);
        next[index].end = end;
      }
      return next;
    });
  };

  const applyPreset = (preset: string) => {
    setSelectedPreset(preset);
    setTimes(CAMPUS_PRESETS[preset]);
  };

  const hasOverlap = (list: SectionTime[]): boolean => {
    for (let i = 1; i < list.length; i++) {
      if (list[i].start < list[i - 1].end) {
        return true;
      }
    }
    return false;
  };

  const handleSave = () => {
    if (hasOverlap(times)) {
      Alert.alert('时间错误', '课节时间存在重叠或倒置，请检查');
      return;
    }
    onSave(times);
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.modal}>
        <View style={{ backgroundColor: theme.colors.surface }}>
          <Text variant="titleLarge" style={styles.title}>
            课节时间表
          </Text>
          <View style={styles.uniformRow}>
            <Text>统一时长（45分钟）</Text>
            <Switch value={uniform} onValueChange={setUniform} />
          </View>
          <Text variant="labelLarge" style={styles.label}>
            快速填充预设
          </Text>
          <SegmentedButtons
            value={selectedPreset}
            onValueChange={applyPreset}
            buttons={[
              { value: '长安校区', label: '长安' },
              { value: '友谊校区夏季', label: '友谊夏' },
              { value: '友谊校区冬季', label: '友谊冬' },
            ]}
          />
          <ScrollView style={styles.list}>
            {times.map((st, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.sectionLabel}>第{i + 1}节</Text>
                <TextInput
                  value={st.start}
                  onChangeText={(v) => updateTime(i, 'start', v)}
                  style={styles.timeInput}
                  placeholder="08:30"
                />
                <Text style={styles.dash}>-</Text>
                <TextInput
                  value={st.end}
                  onChangeText={(v) => updateTime(i, 'end', v)}
                  style={styles.timeInput}
                  placeholder="09:15"
                />
              </View>
            ))}
          </ScrollView>
          <View style={styles.actions}>
            <Button onPress={onDismiss}>取消</Button>
            <Button mode="contained" onPress={handleSave}>
              保存
            </Button>
          </View>
        </View>
      </Modal>
    </Portal>
  );
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60).toString().padStart(2, '0');
  const nm = (total % 60).toString().padStart(2, '0');
  return `${nh}:${nm}`;
}

const styles = StyleSheet.create({
  modal: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    maxHeight: '85%',
  },
  title: {
    marginBottom: 12,
    fontWeight: 'bold',
  },
  uniformRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    marginBottom: 8,
  },
  list: {
    marginVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    gap: 8,
  },
  sectionLabel: {
    width: 60,
    fontSize: 14,
  },
  timeInput: {
    flex: 1,
  },
  dash: {
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
});

export default TimeTableEditor;
