import { useState, useCallback, useEffect } from 'react';
import { View, Alert, TouchableOpacity } from 'react-native';
import { Switch, SegmentedButtons, Text } from 'react-native-paper';
import * as Notifications from 'expo-notifications';
import { useSettingsStore } from '@/stores/settingsStore';
import { CourseImportWizard } from '@/components/CourseImportWizard';
import { exportData, importData } from '@/utils/dataBackup';
import { REMINDER_LEAD_OPTIONS } from '@/utils/reminderScheduler';
import { sendTestReminderNotification } from '@/utils/reminderNotifications';
import { PRESET_COLORS } from '@/types';
import { ScreenContainer } from '@/components/ScreenContainer';
import { useDesignTokens } from '@/hooks/useDesignTokens';
import { useSnackbar } from '@/hooks/useSnackbar';
import { Icon } from '@/components/Icon';

export default function SettingsScreen() {
  const dt = useDesignTokens();
  const showSnackbar = useSnackbar();
  const darkMode = useSettingsStore((s) => s.darkMode);
  const setDarkMode = useSettingsStore((s) => s.setDarkMode);
  const themeColor = useSettingsStore((s) => s.themeColor);
  const setThemeColor = useSettingsStore((s) => s.setThemeColor);
  const reminderEnabled = useSettingsStore((s) => s.reminderEnabled);
  const setReminderEnabled = useSettingsStore((s) => s.setReminderEnabled);
  const reminderLeadMinutes = useSettingsStore((s) => s.reminderLeadMinutes);
  const setReminderLeadMinutes = useSettingsStore((s) => s.setReminderLeadMinutes);
  const formatData = useSettingsStore((s) => s.formatData);
  const [importVisible, setImportVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    Notifications.getPermissionsAsync().then((p) => setPermissionDenied(!p.granted));
  }, []);

  const handleReminderToggle = useCallback(
    async (value: boolean) => {
      if (!value) {
        setReminderEnabled(false);
        return;
      }
      const perms = await Notifications.getPermissionsAsync();
      const granted = perms.granted || (await Notifications.requestPermissionsAsync()).granted;
      if (!granted) {
        setPermissionDenied(true);
        showSnackbar('未授予通知权限,无法开启上课提醒');
        return;
      }
      setPermissionDenied(false);
      setReminderEnabled(true);
    },
    [setReminderEnabled, showSnackbar],
  );

  const handleSendTestNotification = useCallback(async () => {
    const perms = await Notifications.getPermissionsAsync();
    if (!perms.granted) {
      showSnackbar('通知权限已关闭,无法发送测试通知');
      return;
    }
    try {
      await sendTestReminderNotification();
      showSnackbar('测试通知已发送');
    } catch {
      showSnackbar('测试通知发送失败');
    }
  }, [showSnackbar]);

  const handleExport = useCallback(async () => {
    setBusy(true);
    try {
      const ok = await exportData(() => showSnackbar('无数据可导出'));
      if (ok) showSnackbar('导出成功');
    } catch {
      showSnackbar('导出失败');
    } finally {
      setBusy(false);
    }
  }, [showSnackbar]);

  const handleImport = useCallback(async () => {
    setBusy(true);
    try {
      const result = await importData();
      showSnackbar(result.message);
    } catch {
      showSnackbar('导入失败');
    } finally {
      setBusy(false);
    }
  }, [showSnackbar]);

  const handleFormat = () => {
    Alert.alert('格式化数据', '确定要清空所有数据吗？此操作不可恢复。', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        style: 'destructive',
        onPress: () => {
          formatData();
          showSnackbar('已清空所有数据');
        },
      },
    ]);
  };

  const cardStyle = {
    backgroundColor: dt.colors.surface,
    borderRadius: dt.borderRadius.lg,
    borderWidth: 1,
    borderColor: dt.colors.border,
    padding: 16,
    marginBottom: 12,
  };

  return (
    <ScreenContainer scrollable>
      {/* Import Card */}
      <TouchableOpacity
        onPress={() => setImportVisible(true)}
        style={[cardStyle, { backgroundColor: `${dt.colors.primary}0A`, borderColor: `${dt.colors.primary}30` }]}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{
            width: 44, height: 44, borderRadius: 12,
            backgroundColor: `${dt.colors.primary}18`,
            alignItems: 'center', justifyContent: 'center',
            marginRight: 14,
          }}>
            <Icon name="import-course" size={22} color={dt.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: dt.fontSize.body, fontWeight: dt.fontWeight.subheading, color: dt.colors.text }}>
              导入课表
            </Text>
            <Text style={{ fontSize: dt.fontSize.caption, color: dt.colors.textSecondary, marginTop: 2 }}>
              从 NWPU 教务系统导入课程
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Appearance Card */}
      <View style={cardStyle}>
        <Text style={{
          fontSize: dt.fontSize.label,
          fontWeight: dt.fontWeight.subheading,
          color: dt.colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: 12,
        }}>
          外观
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name="moon-stars" size={20} color={dt.colors.textSecondary} />
            <Text style={{ fontSize: dt.fontSize.body, color: dt.colors.text, marginLeft: 12 }}>
              深色模式
            </Text>
          </View>
          <Switch value={darkMode} onValueChange={setDarkMode} color={dt.colors.primary} />
        </View>
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: dt.fontSize.caption, color: dt.colors.textSecondary, marginBottom: 8 }}>
            主题色
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {PRESET_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setThemeColor(c)}
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: c,
                  borderWidth: themeColor === c ? 3 : 0,
                  borderColor: dt.colors.text,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                {themeColor === c ? (
                  <Icon name="check" size={14} color={dt.colors.onPrimary} />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Reminder Card */}
      <View style={cardStyle}>
        <Text style={{
          fontSize: dt.fontSize.label,
          fontWeight: dt.fontWeight.subheading,
          color: dt.colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: 12,
        }}>
          上课提醒
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name="alert" size={20} color={dt.colors.textSecondary} />
            <Text style={{ fontSize: dt.fontSize.body, color: dt.colors.text, marginLeft: 12 }}>
              开启提醒
            </Text>
          </View>
          <Switch value={reminderEnabled} onValueChange={handleReminderToggle} color={dt.colors.primary} />
        </View>
        {reminderEnabled ? (
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontSize: dt.fontSize.caption, color: dt.colors.textSecondary, marginBottom: 8 }}>
              提前多久提醒
            </Text>
            <SegmentedButtons
              value={String(reminderLeadMinutes)}
              onValueChange={(v) => setReminderLeadMinutes(Number(v))}
              buttons={REMINDER_LEAD_OPTIONS.map((m) => ({ value: String(m), label: `${m} 分钟` }))}
            />
          </View>
        ) : null}
        {permissionDenied ? (
          <Text style={{ fontSize: dt.fontSize.caption, color: dt.colors.destructive, marginTop: 12 }}>
            通知权限已关闭,无法发送提醒,请在系统设置中开启
          </Text>
        ) : null}
        <Text style={{ fontSize: dt.fontSize.caption, color: dt.colors.textMuted, marginTop: 12 }}>
          在课程开始前发送通知提醒您上课,如果还是害怕错过课程的话,就去定个闹钟吧~
        </Text>
        <View style={{ height: 1, backgroundColor: dt.colors.border, marginVertical: 12 }} />
        <SettingsRow
          dt={dt}
          icon="alert"
          label="发送测试通知"
          sub="立即发送一条通知,验证通知与铃声效果"
          onPress={handleSendTestNotification}
        />
      </View>

      {/* Data Card */}
      <View style={cardStyle}>
        <Text style={{
          fontSize: dt.fontSize.label,
          fontWeight: dt.fontWeight.subheading,
          color: dt.colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: 12,
        }}>
          数据管理
        </Text>
        <SettingsRow dt={dt} icon="export" label="导出数据" sub="导出为 JSON 文件" onPress={handleExport} disabled={busy} />
        <View style={{ height: 1, backgroundColor: dt.colors.border, marginVertical: 4 }} />
        <SettingsRow dt={dt} icon="import" label="导入数据" sub="从 JSON 文件恢复" onPress={handleImport} disabled={busy} />
      </View>

      {/* Danger Zone */}
      <TouchableOpacity
        onPress={handleFormat}
        style={[cardStyle, { borderColor: `${dt.colors.destructive}30`, backgroundColor: `${dt.colors.destructive}05` }]}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="alert" size={20} color={dt.colors.destructive} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ fontSize: dt.fontSize.body, fontWeight: dt.fontWeight.subheading, color: dt.colors.destructive }}>
              格式化数据
            </Text>
            <Text style={{ fontSize: dt.fontSize.caption, color: dt.colors.textSecondary, marginTop: 2 }}>
              清空所有数据并重置
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      <CourseImportWizard visible={importVisible} onDismiss={() => setImportVisible(false)} />
    </ScreenContainer>
  );
}

function SettingsRow({
  dt,
  icon,
  label,
  sub,
  onPress,
  disabled,
}: {
  dt: ReturnType<typeof useDesignTokens>;
  icon: string;
  label: string;
  sub: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        opacity: disabled ? 0.5 : 1,
      }}
      activeOpacity={0.6}
    >
      <Icon name={icon as 'export' | 'import'} size={20} color={dt.colors.textSecondary} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: dt.fontSize.body, color: dt.colors.text }}>
          {label}
        </Text>
        <Text style={{ fontSize: dt.fontSize.caption, color: dt.colors.textSecondary, marginTop: 2 }}>
          {sub}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
