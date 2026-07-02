import { useState, useCallback } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Button, Text, Chip, Switch, Modal, Portal, useTheme, Snackbar } from 'react-native-paper';
import { useSettingsStore } from '@/stores/settingsStore';
import { useCourseStore } from '@/stores/courseStore';
import { enhanceExtractedData, convertToCourses, parseScheduleText } from '@/utils/jwxtParser';
import { formatTimeSlot } from '@/utils/scheduleDate';
import { JwxtWebView } from './JwxtWebView';
import type { ParsedData } from '@/utils/jwxtParser';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

type Step = 'webview' | 'select-semester';

export function CourseImportWizard({ visible, onDismiss }: Props) {
  const theme = useTheme();
  const semesters = useSettingsStore((s) => s.semesters);
  const addCourse = useCourseStore((s) => s.addCourse);
  const deleteCoursesBySemester = useCourseStore((s) => s.deleteCoursesBySemester);

  const [step, setStep] = useState<Step>('webview');
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string | null>(null);
  const [selectedDataSemester, setSelectedDataSemester] = useState<string | null>(null);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep('webview');
    setParsedData(null);
    setSelectedSemesterId(null);
    setSelectedDataSemester(null);
    setOverwriteExisting(false);
    setImporting(false);
  }, []);

  const handleDismiss = () => {
    reset();
    onDismiss();
  };

  const handleDataExtracted = (data: ParsedData) => {
    const enhanced = enhanceExtractedData(data);
    setParsedData(enhanced);
    if (enhanced.semesters.length > 0) {
      setSelectedDataSemester(enhanced.semesters[0].dataSemester);
    }
    setStep('select-semester');
  };

  const handleError = (message: string) => {
    setSnackbar(message);
  };

  const handleImport = () => {
    if (!parsedData || !selectedSemesterId) {
      setSnackbar('请先选择目标学期');
      return;
    }

    const coursesToImport = convertToCourses(
      parsedData.courses,
      selectedSemesterId,
      selectedDataSemester ?? undefined,
    );

    if (coursesToImport.length === 0) {
      setSnackbar('没有找到可导入的课程');
      return;
    }

    setImporting(true);

    if (overwriteExisting) {
      deleteCoursesBySemester(selectedSemesterId);
    }

    for (const course of coursesToImport) {
      addCourse(course);
    }

    setImporting(false);
    setSnackbar(`成功导入 ${coursesToImport.length} 门课程，请核对`);
    setTimeout(() => handleDismiss(), 1500);
  };

  const filteredPreview = parsedData
    ? parsedData.courses.filter((c) => !selectedDataSemester || c.dataSemester === selectedDataSemester)
    : [];

  return (
    <Portal>
      <Modal visible={visible} onDismiss={handleDismiss} contentContainerStyle={styles.modal}>
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.header, { borderBottomColor: theme.colors.outline }]}>
            <Text variant="titleLarge">{step === 'webview' ? '导入课表 - 登录教务系统' : '导入课表 - 选择学期'}</Text>
            <Button onPress={handleDismiss}>取消</Button>
          </View>

          {step === 'webview' ? (
            <JwxtWebView onDataExtracted={handleDataExtracted} onError={handleError} />
          ) : (
            <ScrollView style={styles.body}>
              <Text variant="labelLarge" style={styles.sectionTitle}>
                检测到的学期（共提取 {parsedData?.courses.length ?? 0} 门课程）
              </Text>
              <View style={styles.chipRow}>
                {parsedData?.semesters.map((sem) => (
                  <Chip
                    key={sem.dataSemester}
                    selected={selectedDataSemester === sem.dataSemester}
                    onPress={() => setSelectedDataSemester(sem.dataSemester)}
                    style={styles.chip}
                  >
                    {sem.name}
                  </Chip>
                ))}
              </View>

              <Text variant="labelLarge" style={styles.sectionTitle}>
                选择目标学期
              </Text>
              <View style={styles.chipRow}>
                {semesters.length === 0 ? (
                  <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>暂无学期，请先在课表管理中创建</Text>
                ) : (
                  semesters.map((sem) => (
                    <Chip
                      key={sem.id}
                      selected={selectedSemesterId === sem.id}
                      onPress={() => setSelectedSemesterId(sem.id)}
                      style={styles.chip}
                    >
                      {sem.name}
                    </Chip>
                  ))
                )}
              </View>

              {selectedSemesterId ? (
                <View style={styles.overwriteRow}>
                  <Text>覆盖该学期现有课程</Text>
                  <Switch
                    value={overwriteExisting}
                    onValueChange={setOverwriteExisting}
                  />
                </View>
              ) : null}

              <Text variant="labelLarge" style={styles.sectionTitle}>
                预览（{filteredPreview.length} 门）
              </Text>
              {filteredPreview.slice(0, 5).map((c, i) => (
                <View key={i} style={[styles.previewItem, { borderBottomColor: theme.colors.surfaceVariant }]}>
                  <Text style={[styles.previewName, { color: theme.colors.onSurface }]}>{c.name}</Text>
                  {c.scheduleText ? (
                    <Text style={[styles.previewSlot, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                      {formatTimeSlot(parseScheduleText(c.scheduleText)[0])}
                    </Text>
                  ) : null}
                </View>
              ))}
              {filteredPreview.length > 5 ? (
                <Text style={[styles.moreText, { color: theme.colors.onSurfaceVariant }]}>...还有 {filteredPreview.length - 5} 门课程</Text>
              ) : null}

              <View style={styles.actions}>
                <Button mode="outlined" onPress={() => setStep('webview')}>
                  返回
                </Button>
                <Button
                  mode="contained"
                  onPress={handleImport}
                  disabled={!selectedSemesterId || importing}
                  loading={importing}
                >
                  导入课程
                </Button>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
      <Snackbar visible={snackbar !== null} onDismiss={() => setSnackbar(null)} duration={3000}>
        {snackbar}
      </Snackbar>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    margin: 0,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    
  },
  body: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    marginTop: 12,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    marginBottom: 4,
  },
  hint: {
    
    fontStyle: 'italic',
  },
  overwriteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  previewItem: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    
  },
  previewName: {
    fontSize: 14,
    fontWeight: '500',
  },
  previewSlot: {
    fontSize: 12,
    
    marginTop: 2,
  },
  moreText: {
    
    marginTop: 8,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
    marginBottom: 32,
  },
});

export default CourseImportWizard;
