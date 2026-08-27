# 友谊校区双时间表 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 合并友谊夏/冬预设为单一"友谊校区"预设，课表与 Widget 按日期（5月1日–9月30日为夏，其余为冬）自动选择时间表，边界周提供切换按钮与加粗分隔竖线。

**架构：** 新建 `src/utils/campusTimes.ts` 集中管理预设常量、季节判定、边界查找与旧数据迁移；`Semester` 增加 `campus` / `altSectionTimes` 字段（旧数据在 settingsStore rehydrate 与备份导入时自动迁移）；`CourseSchedule` 增加边界周 UI（时间列顶部切换按钮 + 竖线）；`widgetData` 与表单改用新工具函数。

**技术栈：** React Native + Expo SDK 57、TypeScript 6、Zustand 5 persist。**本项目无测试套件**（CLAUDE.md 明示），每步验证为 `npm run typecheck`（预期无输出、退出码 0）；最终运行 `npm run lint` 与手动验证清单。

**规格：** `docs/superpowers/specs/2026-08-28-youyi-timetable-design.md`（已批准）

---

### 任务 1：类型扩展 — `Campus` 与 `Semester` 新字段

**文件：**
- 修改：`src/types/index.ts:39-47`

- [ ] **步骤 1：在 `SectionTime` 定义后新增 `Campus` 类型，并扩展 `Semester` 接口**

将 `src/types/index.ts` 中：

```ts
export interface Semester {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  weekCount: number;
  sectionCount: number;
  sectionTimes: SectionTime[];
}
```

替换为：

```ts
export type Campus = '长安' | '友谊';

export interface Semester {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  weekCount: number;
  sectionCount: number;
  sectionTimes: SectionTime[]; // 友谊：夏季 12 节；长安/假期：默认一套
  campus?: Campus; // 缺省视为长安，兼容旧数据与导入数据
  altSectionTimes?: SectionTime[]; // 仅友谊：冬季 12 节
}
```

- [ ] **步骤 2：运行类型检查**

运行：`npm run typecheck`
预期：无输出，退出码 0（新字段均为可选，现有代码不受影响）

- [ ] **步骤 3：Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): Semester 增加 campus 与 altSectionTimes 字段

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### 任务 2：新模块 — 预设、季节判定、边界查找、迁移

**文件：**
- 创建：`src/utils/campusTimes.ts`

- [ ] **步骤 1：创建 `src/utils/campusTimes.ts`**（完整文件内容）

```ts
import type { Campus, SectionTime, Semester } from '@/types';

export type YouyiSeason = 'summer' | 'winter';

// 长安校区 13 节（原 SemesterForm.tsx 中「长安校区」预设）
export const CHANGAN_SECTION_TIMES: SectionTime[] = [
  { start: '08:30', end: '09:15' },
  { start: '09:25', end: '10:10' },
  { start: '10:30', end: '11:15' },
  { start: '11:25', end: '12:10' },
  { start: '12:20', end: '13:05' },
  { start: '13:05', end: '13:50' },
  { start: '14:00', end: '14:45' },
  { start: '14:55', end: '15:40' },
  { start: '16:00', end: '16:45' },
  { start: '16:55', end: '17:40' },
  { start: '19:00', end: '19:45' },
  { start: '19:55', end: '20:40' },
  { start: '20:40', end: '21:25' },
];

// 友谊校区夏季 12 节（原「友谊校区夏季」预设，5月1日–9月30日使用）
export const YOUYI_SUMMER_TIMES: SectionTime[] = [
  { start: '08:00', end: '08:50' },
  { start: '09:00', end: '09:50' },
  { start: '10:10', end: '11:00' },
  { start: '11:10', end: '12:00' },
  { start: '12:20', end: '13:05' },
  { start: '13:05', end: '13:50' },
  { start: '14:30', end: '15:20' },
  { start: '15:30', end: '16:20' },
  { start: '16:40', end: '17:30' },
  { start: '17:40', end: '18:30' },
  { start: '19:30', end: '20:20' },
  { start: '20:30', end: '21:20' },
];

// 友谊校区冬季 12 节（原「友谊校区冬季」预设，10月1日–4月30日使用）
export const YOUYI_WINTER_TIMES: SectionTime[] = [
  { start: '08:00', end: '08:50' },
  { start: '09:00', end: '09:50' },
  { start: '10:10', end: '11:00' },
  { start: '11:10', end: '12:00' },
  { start: '12:20', end: '13:05' },
  { start: '13:05', end: '13:50' },
  { start: '14:00', end: '14:50' },
  { start: '15:00', end: '15:50' },
  { start: '16:10', end: '17:00' },
  { start: '17:10', end: '18:00' },
  { start: '19:00', end: '19:50' },
  { start: '20:00', end: '20:50' },
];

/** 按校区返回预设：友谊 → 夏主冬辅；长安 → 仅一套 */
export function applyCampusPreset(campus: Campus): {
  sectionTimes: SectionTime[];
  altSectionTimes?: SectionTime[];
} {
  if (campus === '友谊') {
    return { sectionTimes: YOUYI_SUMMER_TIMES, altSectionTimes: YOUYI_WINTER_TIMES };
  }
  return { sectionTimes: CHANGAN_SECTION_TIMES };
}

export function sectionTimesEqual(a: SectionTime[], b: SectionTime[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((t, i) => t.start === b[i].start && t.end === b[i].end);
}

/** 5月1日–9月30日（含端点）→ summer；其余（10月1日–4月30日）→ winter */
export function getYouyiSeasonForDate(date: Date): YouyiSeason {
  const md = (date.getMonth() + 1) * 100 + date.getDate();
  return md >= 501 && md <= 930 ? 'summer' : 'winter';
}

/** 统一入口：非友谊/无辅套 → sectionTimes；友谊 → 按日期选夏或冬 */
export function getSectionTimesForDate(semester: Semester, date: Date): SectionTime[] {
  if (semester.campus !== '友谊' || !semester.altSectionTimes) {
    return semester.sectionTimes;
  }
  return getYouyiSeasonForDate(date) === 'summer'
    ? semester.sectionTimes
    : semester.altSectionTimes;
}

/**
 * 查找显示的连续日期序列中时间表更替的位置。
 * 返回 i：更替发生在 days[i-1] 与 days[i] 之间；
 * i === 0：更替发生在 days[0] 前一天与 days[0] 之间（竖线画在首列左缘）；
 * 无更替 → null。
 */
export function findSeasonBoundary(days: Date[]): number | null {
  if (days.length === 0) return null;
  const before = new Date(days[0].getTime() - 24 * 60 * 60 * 1000);
  if (getYouyiSeasonForDate(before) !== getYouyiSeasonForDate(days[0])) {
    return 0;
  }
  for (let i = 1; i < days.length; i++) {
    if (getYouyiSeasonForDate(days[i - 1]) !== getYouyiSeasonForDate(days[i])) {
      return i;
    }
  }
  return null;
}

/**
 * 旧数据迁移（幂等）：识别旧「友谊校区夏季/冬季」预设并补全两套时间。
 * 无变化时返回原引用，调用方可用 `migrated !== semesters` 判断是否需要写回。
 */
export function migrateSemesters(semesters: Semester[]): Semester[] {
  let changed = false;
  const migrated = semesters.map((s): Semester => {
    if (s.campus === '友谊') return s;
    if (
      sectionTimesEqual(s.sectionTimes, YOUYI_SUMMER_TIMES) ||
      sectionTimesEqual(s.sectionTimes, YOUYI_WINTER_TIMES)
    ) {
      changed = true;
      return {
        ...s,
        campus: '友谊',
        sectionTimes: YOUYI_SUMMER_TIMES,
        altSectionTimes: YOUYI_WINTER_TIMES,
      };
    }
    return s;
  });
  return changed ? migrated : semesters;
}
```

- [ ] **步骤 2：运行类型检查**

运行：`npm run typecheck`
预期：无输出，退出码 0（新模块尚未被引用，不产生错误）

- [ ] **步骤 3：Commit**

```bash
git add src/utils/campusTimes.ts
git commit -m "feat(utils): 新增 campusTimes 模块 — 预设/季节判定/边界查找/旧数据迁移

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### 任务 3：启动时迁移旧学期数据

**文件：**
- 修改：`src/stores/settingsStore.ts:1-3, 79-81`

- [ ] **步骤 1：加入 import 并在 `onRehydrateStorage` 中执行迁移**

修改 `src/stores/settingsStore.ts` 顶部 import 区，在 `import type { Semester } from '@/types';` 之后加一行：

```ts
import { migrateSemesters } from '@/utils/campusTimes';
```

将：

```ts
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
```

替换为：

```ts
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.semesters)) {
          const migrated = migrateSemesters(state.semesters);
          if (migrated !== state.semesters) {
            useSettingsStore.setState({ semesters: migrated });
          }
        }
        state?.setHydrated(true);
      },
```

说明：`migrateSemesters` 无变化时返回原引用；有变化时 `setState` 写回，zustand persist 会自动持久化到 AsyncStorage。

- [ ] **步骤 2：运行类型检查**

运行：`npm run typecheck`
预期：无输出，退出码 0

- [ ] **步骤 3：Commit**

```bash
git add src/stores/settingsStore.ts
git commit -m "feat(store): rehydrate 时自动迁移旧友谊夏/冬学期数据

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### 任务 4：备份导入时迁移

**文件：**
- 修改：`src/utils/dataBackup.ts:1-8, 103-118`

- [ ] **步骤 1：加入 import，并在 `importData` 中对导入的学期执行迁移**

修改 `src/utils/dataBackup.ts` 顶部 import 区，在 `import { useSettingsStore } from '@/stores/settingsStore';` 之后加一行：

```ts
import { migrateSemesters } from './campusTimes';
```

将 `importData` 中的：

```ts
    await AsyncStorage.setItem(
      COURSES_KEY,
      JSON.stringify({ state: { courses: parsed.courses }, version: 0 }),
    );
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ state: parsed.settings, version: 0 }),
    );

    // 直接更新 Zustand store 内存状态，避免必须重启应用
    useCourseStore.setState({ courses: parsed.courses });
    useSettingsStore.setState({
      semesters: parsed.settings.semesters,
      themeColor: parsed.settings.themeColor,
      darkMode: parsed.settings.darkMode,
    });
```

替换为：

```ts
    const migratedSemesters = migrateSemesters(parsed.settings.semesters);

    await AsyncStorage.setItem(
      COURSES_KEY,
      JSON.stringify({ state: { courses: parsed.courses }, version: 0 }),
    );
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ state: { ...parsed.settings, semesters: migratedSemesters }, version: 0 }),
    );

    // 直接更新 Zustand store 内存状态，避免必须重启应用
    useCourseStore.setState({ courses: parsed.courses });
    useSettingsStore.setState({
      semesters: migratedSemesters,
      themeColor: parsed.settings.themeColor,
      darkMode: parsed.settings.darkMode,
    });
```

- [ ] **步骤 2：运行类型检查**

运行：`npm run typecheck`
预期：无输出，退出码 0

- [ ] **步骤 3：Commit**

```bash
git add src/utils/dataBackup.ts
git commit -m "feat(backup): 导入旧格式备份时自动迁移友谊学期时间表

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### 任务 5：Widget 按日期选择时间表

**文件：**
- 修改：`src/utils/widgetData.ts:1-10, 67-71`

- [ ] **步骤 1：`buildDayCourses` 改用 `getSectionTimesForDate`**

修改 `src/utils/widgetData.ts`，在 import 区（`import { formatLocationForDisplay } from './locationFormat';` 之后）加一行：

```ts
import { getSectionTimesForDate } from './campusTimes';
```

将：

```ts
      const sorted = [...slot.classSections].sort((a, b) => a - b);
      const firstSec = sorted[0];
      const lastSec = sorted[sorted.length - 1];
      const startTime = semester.sectionTimes[firstSec - 1]?.start ?? '';
      const endTime = semester.sectionTimes[lastSec - 1]?.end ?? '';
```

替换为：

```ts
      const sorted = [...slot.classSections].sort((a, b) => a - b);
      const firstSec = sorted[0];
      const lastSec = sorted[sorted.length - 1];
      const startTime = times[firstSec - 1]?.start ?? '';
      const endTime = times[lastSec - 1]?.end ?? '';
```

并在 `const items: WidgetCourseItem[] = [];` 之后、`for (const course of courses) {` 之前加：

```ts
  const times = getSectionTimesForDate(semester, date);
```

（times 与 slot 无关，提升出循环，每日期只计算一次）

说明：`buildDayCourses(date, ...)` 每次调用已带具体日期，今天/明天各自按各自日期判定（如 4/30 冬、5/1 夏）。

- [ ] **步骤 2：运行类型检查**

运行：`npm run typecheck`
预期：无输出，退出码 0

- [ ] **步骤 3：Commit**

```bash
git add src/utils/widgetData.ts
git commit -m "feat(widget): 友谊学期按当天日期选择时间表

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### 任务 6：表单 — 三预设合并为两个

**文件：**
- 修改：`src/components/SemesterForm.tsx`

- [ ] **步骤 1：替换 import、预设常量与状态**

修改 `src/components/SemesterForm.tsx` 顶部，import 区改为：

```ts
import { useState, useLayoutEffect, useRef } from 'react';
import { Platform, StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import { Text, HelperText } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO, isValid } from 'date-fns';
import type { Semester, SectionTime, Campus } from '@/types';
import { createDefaultSemester } from '@/types';
import { computeSemesterEndDate } from '@/utils/scheduleDate';
import { applyCampusPreset } from '@/utils/campusTimes';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useDesignTokens } from '@/hooks/useDesignTokens';
import { Icon } from '@/components/Icon';
import { FormModal } from '@/components/FormModal';
import { AppTextField } from '@/components/AppTextField';
```

删除整个 `CAMPUS_PRESETS` 常量块（原 23-67 行），将 `PRESET_LABELS` 替换为：

```ts
const PRESET_LABELS: { value: Campus; label: string }[] = [
  { value: '长安', label: '长安' },
  { value: '友谊', label: '友谊' },
];
```

状态区，将：

```ts
  const [sectionTimes, setSectionTimes] = useState<SectionTime[]>(
    editing?.sectionTimes ?? createDefaultSemester().sectionTimes,
  );
  const [selectedPreset, setSelectedPreset] = useState('长安校区');
```

替换为：

```ts
  const [sectionTimes, setSectionTimes] = useState<SectionTime[]>(
    editing?.sectionTimes ?? createDefaultSemester().sectionTimes,
  );
  const [altSectionTimes, setAltSectionTimes] = useState<SectionTime[] | undefined>(
    editing?.altSectionTimes,
  );
  const [selectedPreset, setSelectedPreset] = useState<Campus>('长安');
```

- [ ] **步骤 2：更新重置逻辑**

`useLayoutEffect` 内重置块，在 `setSectionTimes(editing?.sectionTimes ?? createDefaultSemester().sectionTimes);` 之后加两行：

```ts
      setAltSectionTimes(editing?.altSectionTimes);
      setSelectedPreset(editing?.campus ?? '长安');
```

（同时修复了旧实现中"编辑友谊学期时预设选中态不还原"的问题）

- [ ] **步骤 3：替换 `handlePreset` 与 `handleSectionCountChange`**

将：

```ts
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
```

替换为：

```ts
  const handlePreset = (campus: Campus) => {
    setSelectedPreset(campus);
    const preset = applyCampusPreset(campus);
    setSectionTimes(preset.sectionTimes);
    setAltSectionTimes(preset.altSectionTimes);
    setSectionCount(String(preset.sectionTimes.length));
  };

  // 按目标节数裁剪/追加；两套时间（主/辅）需同步保持长度一致
  const resizeTimes = (times: SectionTime[], n: number): SectionTime[] => {
    if (n <= times.length) {
      return times.slice(0, n);
    }
    const last = times[times.length - 1] ?? { start: '08:30', end: '09:15' };
    const [lh, lm] = last.end.split(':').map(Number);
    let cursor = (lh ?? 8) * 60 + (lm ?? 30) + 10;
    const appended = [...times];
    for (let i = appended.length; i < n; i++) {
      const start = cursor;
      const end = start + 45;
      appended.push({ start: formatTime(start), end: formatTime(end) });
      cursor = end + 10;
    }
    return appended;
  };

  const handleSectionCountChange = (value: string) => {
    setSectionCount(value);
    const n = parseInt(value, 10) || 0;
    setSectionTimes(resizeTimes(sectionTimes, n));
    if (altSectionTimes) {
      setAltSectionTimes(resizeTimes(altSectionTimes, n));
    }
  };
```

说明：`resizeTimes` 同时修复了旧实现中"追加多节时 cursor 不推进、追加的节时间全部相同"的既有 bug。

- [ ] **步骤 4：更新校验与保存**

将：

```ts
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
```

替换为：

```ts
    if (hasOverlap(sectionTimes) || (altSectionTimes && hasOverlap(altSectionTimes))) {
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
      campus: selectedPreset,
      altSectionTimes,
    };
```

- [ ] **步骤 5：预设行下方加说明文字**

在预设按钮 `</View>` 结束（`styles.presetRow` 的 View）之后、`<View style={[styles.actions, ...]}>` 之前插入：

```tsx
          {selectedPreset === '友谊' ? (
            <HelperText type="info" style={{ color: dt.colors.textSecondary }}>
              含夏、冬两套时间，5月1日、10月1日自动切换
            </HelperText>
          ) : null}
```

- [ ] **步骤 6：运行类型检查**

运行：`npm run typecheck`
预期：无输出，退出码 0

- [ ] **步骤 7：Commit**

```bash
git add src/components/SemesterForm.tsx
git commit -m "feat(form): 友谊夏/冬预设合并为单一友谊预设，节数调整同步两套时间

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### 任务 7：课表 — 按日期显示时间 + 边界周切换按钮与竖线

**文件：**
- 修改：`src/components/CourseSchedule.tsx`

- [ ] **步骤 1：更新 import 与常量**

修改 `src/components/CourseSchedule.tsx`，在 `import { formatLocationForDisplay } from '@/utils/locationFormat';` 之后加：

```ts
import {
  findSeasonBoundary,
  getSectionTimesForDate,
  getYouyiSeasonForDate,
  type YouyiSeason,
} from '@/utils/campusTimes';
```

常量区（`const DAY_NAMES = ...` 之后）加：

```ts
const TOGGLE_ROW_HEIGHT = 30;
const BOUNDARY_LINE_WIDTH = 3;
```

- [ ] **步骤 2：添加切换状态与派生值**

在组件内 `const [detailCourse, setDetailCourse] = useState<Course | null>(null);` 之后加：

```ts
  // 友谊双时间表切换：override 以 `${weekOffset}-${dayMode}` 为 key，
  // 滑到其他周或切换 7天/3天 时 key 变化自动失效（回到按选中日期判定）
  const [override, setOverride] = useState<{ key: string; season: YouyiSeason } | null>(null);
```

在 `const columnWidth = (SCREEN_WIDTH - TIME_COLUMN_WIDTH) / days.length;` 之后加：

```ts
  const isYouyi = semester.campus === '友谊' && !isDefault;
  const boundary = isYouyi ? findSeasonBoundary(days) : null;
  const currentKey = `${weekOffset}-${dayMode}`;
  const autoSeason = getYouyiSeasonForDate(anchor);
  const activeSeason = override?.key === currentKey ? override.season : autoSeason;
  // 边界周：时间列跟随 activeSeason（可切换）；其余情况按日期显示（假期/长安/不跨更替周）
  let activeTimes = getSectionTimesForDate(semester, anchor);
  if (boundary !== null) {
    const summer = semester.sectionTimes;
    const winter = semester.altSectionTimes ?? semester.sectionTimes;
    activeTimes = activeSeason === 'summer' ? summer : winter;
  }

  const toggleSeason = () => {
    const next: YouyiSeason = activeSeason === 'summer' ? 'winter' : 'summer';
    setOverride({ key: currentKey, season: next });
  };
```

- [ ] **步骤 3：时间列 — 顶部切换按钮 + 使用 activeTimes**

将网格体中的时间列整块（原 266-276 行）：

```tsx
          {/* Time Column */}
          <View style={{ width: TIME_COLUMN_WIDTH }}>
            {Array.from({ length: semester.sectionCount }, (_, i) => i + 1).map((sec) => (
              <View key={sec} style={[styles.timeCell, { height: ROW_HEIGHT, borderRightColor: dt.colors.border }]}>
                <Text style={[styles.timeText, { color: dt.colors.textMuted }]}>{sec}</Text>
                <Text style={[styles.timeSubText, { color: dt.colors.textMuted }]}>
                  {semester.sectionTimes[sec - 1]?.start ?? ''}
                </Text>
              </View>
            ))}
          </View>
```

替换为：

```tsx
          {/* Time Column */}
          <View style={{ width: TIME_COLUMN_WIDTH }}>
            {boundary !== null ? (
              <TouchableOpacity
                onPress={toggleSeason}
                activeOpacity={0.7}
                style={[styles.seasonToggle, { borderRightColor: dt.colors.border }]}
              >
                <Text style={[styles.seasonToggleText, { color: dt.colors.primary }]}>
                  {activeSeason === 'winter' ? '◀冬' : '夏▶'}
                </Text>
              </TouchableOpacity>
            ) : null}
            {Array.from({ length: semester.sectionCount }, (_, i) => i + 1).map((sec) => (
              <View key={sec} style={[styles.timeCell, { height: ROW_HEIGHT, borderRightColor: dt.colors.border }]}>
                <Text style={[styles.timeText, { color: dt.colors.textMuted }]}>{sec}</Text>
                <Text style={[styles.timeSubText, { color: dt.colors.textMuted }]}>
                  {activeTimes[sec - 1]?.start ?? ''}
                </Text>
              </View>
            ))}
          </View>
```

- [ ] **步骤 4：天列 — 顶部对齐垫行 + 高度调整**

将每个天列的渲染块（原 280-294 行中的 style 数组部分）：

```tsx
              <View
                key={date.toISOString()}
                style={[
                  styles.dayColumn,
                  {
                    width: columnWidth,
                    height: semester.sectionCount * ROW_HEIGHT,
                    borderRightColor: dt.colors.border,
                  },
                  isToday(date) && { backgroundColor: `${dt.colors.primary}0D` },
                ]}
              >
                {Array.from({ length: semester.sectionCount }, (_, i) => i + 1).map((sec) => (
```

替换为：

```tsx
              <View
                key={date.toISOString()}
                style={[
                  styles.dayColumn,
                  {
                    width: columnWidth,
                    height:
                      semester.sectionCount * ROW_HEIGHT + (boundary !== null ? TOGGLE_ROW_HEIGHT : 0),
                    borderRightColor: dt.colors.border,
                  },
                  isToday(date) && { backgroundColor: `${dt.colors.primary}0D` },
                ]}
              >
                {boundary !== null ? (
                  <View
                    style={[
                      styles.seasonToggleSpacer,
                      { borderBottomColor: dt.colors.border },
                    ]}
                  />
                ) : null}
                {Array.from({ length: semester.sectionCount }, (_, i) => i + 1).map((sec) => (
```

- [ ] **步骤 5：课程块 top 补偿切换行高度（否则边界周课程块与节次行错位 30px）**

将课程块 style 中的：

```tsx
                          top: (block.firstSection - 1) * ROW_HEIGHT + 2,
```

替换为：

```tsx
                          top:
                            (block.firstSection - 1) * ROW_HEIGHT +
                            2 +
                            (boundary !== null ? TOGGLE_ROW_HEIGHT : 0),
```

- [ ] **步骤 6：加粗竖线（gridBody 内，天列之后）**

在天列 `.map()` 结束的 `)}` 之后、`</View>`（gridBody 闭合）之前插入：

```tsx
          {boundary !== null ? (
            <View
              pointerEvents="none"
              style={[
                styles.seasonBoundaryLine,
                {
                  left: Math.max(
                    TIME_COLUMN_WIDTH,
                    TIME_COLUMN_WIDTH + boundary * columnWidth - BOUNDARY_LINE_WIDTH / 2,
                  ),
                  backgroundColor: dt.colors.primary,
                },
              ]}
            />
          ) : null}
```

- [ ] **步骤 7：StyleSheet 追加静态样式**

在 `StyleSheet.create({...})` 的 `timeSubText` 定义之后加：

```ts
  seasonToggle: {
    height: TOGGLE_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  seasonToggleText: { fontSize: 10, fontWeight: 'bold' },
  seasonToggleSpacer: {
    height: TOGGLE_ROW_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  seasonBoundaryLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: BOUNDARY_LINE_WIDTH,
  },
```

- [ ] **步骤 8：override 每周重置（与"按选中日期、每周重置"决策一致）**

PanResponder 的 `onPanResponderRelease` 两个分支，在调用 `onWeekChangeRef.current(...)` 之前各加 `setOverride(null);`：

```ts
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > swipeThreshold) {
          setOverride(null);
          onWeekChangeRef.current(weekOffsetRef.current - 1);
        } else if (gs.dx < -swipeThreshold) {
          setOverride(null);
          onWeekChangeRef.current(weekOffsetRef.current + 1);
        }
      },
```

7天/3天 两个切换按钮的 onPress 同样先 `setOverride(null);`：

```tsx
          <TouchableOpacity
            onPress={() => {
              setOverride(null);
              setDayMode(7);
            }}
```

```tsx
          <TouchableOpacity
            onPress={() => {
              setOverride(null);
              setDayMode(3);
            }}
```

（PanResponder 在 useLayoutEffect([]) 中创建，`setOverride` 是 useState 的稳定 setter，引用安全，无需改 deps）

- [ ] **步骤 9：运行类型检查**

运行：`npm run typecheck`
预期：无输出，退出码 0

- [ ] **步骤 10：Commit**

```bash
git add src/components/CourseSchedule.tsx
git commit -m "feat(schedule): 友谊边界周时间切换按钮与加粗分隔竖线

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### 任务 8：更新 CLAUDE.md 项目文档

**文件：**
- 修改：`CLAUDE.md`

- [ ] **步骤 1：更新「Data Model」与「Known Code Smells」两处**

「Data Model」一节中 `Semester` 一行改为：

```markdown
- **`Semester`** — id, name, startDate, endDate, weekCount, sectionCount, sectionTimes (array of {start, end}), `campus?` ('长安' | '友谊', 缺省为长安), `altSectionTimes?` (友谊冬季时间表)
```

「Key Utilities」一节中 `scheduleDate.ts` 行之后加一行：

```markdown
- **`campusTimes.ts`** — 校区时间预设 (长安 13 节 / 友谊夏冬各 12 节)、`getYouyiSeasonForDate` (5月1日–9月30日为夏)、`getSectionTimesForDate`、`findSeasonBoundary`、`migrateSemesters` (旧数据迁移)
```

「Known Code Smells」中：

```markdown
- Campus time presets are **duplicated** in `SemesterForm.tsx` and `TimeTableEditor.tsx` (the latter is currently unused).
```

改为：

```markdown
- Campus time presets now live in `src/utils/campusTimes.ts`; `TimeTableEditor.tsx` (unused) still holds its own copy.
```

- [ ] **步骤 2：Commit（本仓库将 CLAUDE.md 列入 .gitignore，执行时验证：`git check-ignore CLAUDE.md` 有输出则跳过提交，仅保留落盘修改）**

```bash
git add CLAUDE.md
git commit -m "docs: 更新 CLAUDE.md 反映 campusTimes 模块与 Semester 新字段

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### 任务 9：Lint 与手动验证

- [ ] **步骤 1：运行 lint**

运行：`npm run lint`
预期：无 error 输出（如出现与本改动无关的历史 warning，记录但不阻塞）

- [ ] **步骤 2：运行最终 typecheck**

运行：`npm run typecheck`
预期：无输出，退出码 0

- [ ] **步骤 3：手动验证清单（需真机/模拟器，逐项打勾）**

按规格「验证」一节执行：

1. 新建友谊学期（跨 5/1，如 2/20–7/10）：3 月周显示冬季时间、6 月周显示夏季时间
2. 边界周：按钮出现、默认按选中日期、点击切换时间列文字、竖线位于更替的两天之间
3. 滑走再滑回：按钮消失/重置；7天/3天 切换：重置
4. 假期（无学期或日期落在假期）：默认时间
5. 长安学期：无按钮无竖线，时间不变
6. Widget：友谊学期下今天/明天时间各自按日期正确；跨更替日（如 4/30 与 5/1）各自正确
7. 迁移：预置旧友谊夏/冬格式数据 → 启动后 campus='友谊' 且两套时间齐全
8. 备份：导出→导入后语义不变；导入旧格式备份后正确迁移
9. 编辑旧友谊学期：表单自动选中友谊预设

- [ ] **步骤 4：如有 lint/typecheck 修复，commit**

```bash
git add -A
git commit -m "chore: lint 修复

Co-Authored-By: Claude <noreply@anthropic.com>"
```

（仅当步骤 1-2 产生了修复改动时执行；注意不要误提交 `.idea/`）
