import { useState, useCallback } from 'react';
import { StyleSheet, ScrollView, View, Alert } from 'react-native';
import { Button, List, Switch, Text, useTheme, Snackbar } from 'react-native-paper';
import { useSettingsStore } from '@/stores/settingsStore';
import { CourseImportWizard } from '@/components/CourseImportWizard';
import { WidgetPreview } from '@/components/WidgetPreview';
import { exportData, importData } from '@/utils/dataBackup';

const PRESET_COLORS = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];

export default function SettingsScreen() {
  const theme = useTheme();
  const darkMode = useSettingsStore((s) => s.darkMode);
  const setDarkMode = useSettingsStore((s) => s.setDarkMode);
  const themeColor = useSettingsStore((s) => s.themeColor);
  const setThemeColor = useSettingsStore((s) => s.setThemeColor);
  const formatData = useSettingsStore((s) => s.formatData);
  const [importVisible, setImportVisible] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleExport = useCallback(async () => {
    setBusy(true);
    try {
      const ok = await exportData(() => setSnackbar('无数据可导出'));
      if (ok) setSnackbar('导出成功');
    } catch {
      setSnackbar('导出失败');
    } finally {
      setBusy(false);
    }
  }, []);

  const handleImport = useCallback(async () => {
    setBusy(true);
    try {
      const result = await importData();
      setSnackbar(result.message);
    } catch {
      setSnackbar('导入失败');
    } finally {
      setBusy(false);
    }
  }, []);

  const handleFormat = () => {
    Alert.alert('格式化数据', '确定要清空所有数据吗？此操作不可恢复。', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        style: 'destructive',
        onPress: () => {
          formatData();
          setSnackbar('已清空所有数据');
        },
      },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <List.Section title="教务系统导入">
        <List.Item
          title="导入课表"
          description="从 NWPU 教务系统导入课程"
          left={(props) => <List.Icon {...props} icon="import" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => setImportVisible(true)}
        />
      </List.Section>

      <List.Section title="外观">
        <List.Item
          title="深色模式"
          left={(props) => <List.Icon {...props} icon="theme-light-dark" />}
          right={() => <Switch value={darkMode} onValueChange={setDarkMode} />}
        />
        <View style={styles.colorSection}>
          <Text variant="labelLarge" style={styles.colorTitle}>
            主题色
          </Text>
          <View style={styles.colorRow}>
            {PRESET_COLORS.map((c) => (
              <Button
                key={c}
                mode={themeColor === c ? 'contained' : 'outlined'}
                onPress={() => setThemeColor(c)}
                style={[styles.colorBtn, { backgroundColor: themeColor === c ? c : 'transparent' }]}
                textColor={themeColor === c ? 'white' : c}
                compact
              >
                {' '}
              </Button>
            ))}
          </View>
        </View>
        <WidgetPreview />
      </List.Section>

      <List.Section title="数据管理">
        <List.Item
          title="导出数据"
          description="导出为 JSON 文件"
          left={(props) => <List.Icon {...props} icon="export" />}
          onPress={handleExport}
          disabled={busy}
        />
        <List.Item
          title="导入数据"
          description="从 JSON 文件恢复"
          left={(props) => <List.Icon {...props} icon="import" />}
          onPress={handleImport}
          disabled={busy}
        />
      </List.Section>

      <List.Section title="调试工具">
        <List.Item
          title="格式化数据"
          description="清空所有数据并重置"
          left={(props) => <List.Icon {...props} icon="alert" />}
          onPress={handleFormat}
        />
      </List.Section>

      <CourseImportWizard visible={importVisible} onDismiss={() => setImportVisible(false)} />
      <Snackbar visible={snackbar !== null} onDismiss={() => setSnackbar(null)} duration={3000}>
        {snackbar}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  colorSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  colorTitle: {
    marginBottom: 8,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorBtn: {
    minWidth: 36,
    minHeight: 36,
    borderRadius: 18,
    borderWidth: 2,
  },
});
