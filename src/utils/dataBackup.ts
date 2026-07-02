import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import type { Course, Semester } from '@/types';

const COURSES_KEY = 'soaring-schedule-courses';
const SETTINGS_KEY = 'soaring-schedule-settings';

export interface BackupData {
  version: string;
  exportDate: string;
  courses: Course[];
  settings: {
    semesters: Semester[];
    themeColor: string;
    darkMode: boolean;
  };
}

export async function buildBackupData(): Promise<BackupData | null> {
  const coursesRaw = await AsyncStorage.getItem(COURSES_KEY);
  const settingsRaw = await AsyncStorage.getItem(SETTINGS_KEY);

  const courses = coursesRaw ? JSON.parse(coursesRaw)?.state?.courses ?? JSON.parse(coursesRaw)?.courses ?? [] : [];
  const settingsParsed = settingsRaw
    ? JSON.parse(settingsRaw)?.state ?? JSON.parse(settingsRaw) ?? {}
    : { semesters: [], themeColor: '#3498db', darkMode: false };

  if (courses.length === 0 && (settingsParsed.semesters?.length ?? 0) === 0) {
    return null;
  }

  return {
    version: '2.0',
    exportDate: new Date().toISOString(),
    courses,
    settings: {
      semesters: settingsParsed.semesters ?? [],
      themeColor: settingsParsed.themeColor ?? '#3498db',
      darkMode: settingsParsed.darkMode ?? false,
    },
  };
}

function validateBackup(data: unknown): data is BackupData {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.version !== 'string') return false;
  if (!Array.isArray(obj.courses)) return false;
  if (!obj.settings || typeof obj.settings !== 'object') return false;
  const settings = obj.settings as Record<string, unknown>;
  if (!Array.isArray(settings.semesters)) return false;
  if (typeof settings.themeColor !== 'string') return false;
  if (typeof settings.darkMode !== 'boolean') return false;
  return true;
}

export async function exportData(onEmpty?: () => void): Promise<boolean> {
  const backup = await buildBackupData();
  if (!backup) {
    onEmpty?.();
    return false;
  }

  const jsonStr = JSON.stringify(backup, null, 2);
  const fileName = `soaring-schedule-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File(Paths.cache, fileName);
  file.write(jsonStr);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: '导出课表数据',
    });
  }
  return true;
}

export async function importData(): Promise<{ success: boolean; message: string }> {
  try {
    const picked = await File.pickFileAsync(undefined, 'application/json');
    const pickedFile = Array.isArray(picked) ? picked[0] : picked;
    if (!pickedFile) {
      return { success: false, message: '未选择文件' };
    }

    const content = await pickedFile.text();

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { success: false, message: 'JSON 格式错误' };
    }

    if (!validateBackup(parsed)) {
      return { success: false, message: '文件结构不符合预期' };
    }

    await AsyncStorage.setItem(
      COURSES_KEY,
      JSON.stringify({ state: { courses: parsed.courses }, version: 0 }),
    );
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ state: parsed.settings, version: 0 }),
    );

    return {
      success: true,
      message: `导入成功：${parsed.courses.length} 门课程，${parsed.settings.semesters.length} 个学期`,
    };
  } catch (e) {
    return { success: false, message: `导入失败：${e instanceof Error ? e.message : '未知错误'}` };
  }
}
