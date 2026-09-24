# 上课提醒功能实现计划

> **面向 AI 代理的工作者:** 必需子技能:使用 superpowers:subagent-driven-development(推荐)或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框(`- [ ]`)语法来跟踪进度。

**目标:** 在设置界面新增「上课提醒」配置(开关 + 5/10/15/30 分钟档位),按课程时间段逐次排程本地精确闹钟通知。

**架构:** 纯逻辑排程模块(可 Node 测试)+ expo-notifications 薄集成层 + store 订阅 hook 自动全量重排。精确闹钟通过声明 `USE_EXACT_ALARM`(API 33+)+ `SCHEDULE_EXACT_ALARM`(API 31-32)自动授予,无需运行时跳转设置页。

**技术栈:** expo-notifications ~57.0.21(已安装)、react-native-paper SegmentedButtons、tsx(Node 验证脚本,仿 `scripts/verify-jwxt-parser.ts` 模式)。

**规格:** `docs/superpowers/specs/2026-09-24-class-reminder-design.md`

**与规格的偏差(已确认的技术性简化):** 规格中「精确闹钟权限未授予 → 警告行 + 跳系统设置」不再需要:`ExpoSchedulingDelegate.kt:106-107` 在 `canScheduleExactAlarms()` 为真时自动使用精确闹钟;声明 `USE_EXACT_ALARM`(API 33+ 安装即授予)+ `SCHEDULE_EXACT_ALARM`(API 31-32 声明即授予)后全版本自动满足,无运行时交互。通知权限(POST_NOTIFICATIONS)警告行保留。

---

## 文件结构

| 文件 | 职责 |
|---|---|
| 创建 `src/utils/reminderScheduler.ts` | **纯逻辑、不 import expo-notifications**:展开课程 → 未来上课日期 → 触发时间/文案/标识符。Node 可测 |
| 创建 `scripts/verify-reminder-scheduler.ts` | Node 验证脚本(tsx),覆盖排程逻辑 |
| 创建 `src/utils/reminderNotifications.ts` | expo-notifications 薄集成:渠道创建、前台 handler、排程/取消 |
| 创建 `src/hooks/useReminderSync.ts` | 订阅 courses/semesters/提醒设置,变化时全量重排 |
| 修改 `src/stores/settingsStore.ts` | 新增 `reminderEnabled`/`reminderLeadMinutes` 及持久化 |
| 修改 `app/settings.tsx` | 新增「上课提醒」卡片(开关/档位/提示文案/权限警告) |
| 修改 `index.ts` | 注册前台通知 handler |
| 修改 `app/_layout.tsx` | 挂载 `useReminderSync` |
| 修改 `app.json` | 注册 expo-notifications 插件 + 声明 3 个权限 |
| 修改 `package.json` | 新增 `verify:reminder` 脚本 |
| 修改 `README.md`、`CLAUDE.md` | 功能与架构文档 |

---

### 任务 1:排程纯逻辑(TDD)

**文件:**
- 创建:`src/utils/reminderScheduler.ts`
- 创建:`scripts/verify-reminder-scheduler.ts`
- 修改:`package.json`(scripts)

- [ ] **步骤 1:编写失败的验证脚本**

`scripts/verify-reminder-scheduler.ts`(仿 verify-jwxt-parser.ts:无 RN 依赖模块,tsx 解析 `@/` 别名):

```ts
// 上课提醒排程逻辑验证脚本(Node 环境运行,无需启动 App)
// 运行方式:npx tsx scripts/verify-reminder-scheduler.ts
/// <reference types="node" />

import {
  computeReminderOccurrences,
  formatReminderBody,
  MAX_REMINDERS,
} from '@/utils/reminderScheduler';
import { AssessmentMethod, RepeatRule, type Course, type Semester } from '@/types';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`PASS ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL ${label}\n  expected: ${e}\n  actual:   ${a}`);
  }
}

// 2026-09-21 是周一;学期覆盖 3 周(9/21–10/11)
const semester: Semester = {
  id: 's1',
  name: '2026 秋',
  startDate: '2026-09-21',
  endDate: '2026-10-11',
  weekCount: 3,
  sectionCount: 2,
  sectionTimes: [
    { start: '08:00', end: '08:45' },
    { start: '08:50', end: '09:35' },
  ],
  campus: '长安',
};

let courseId = 0;
function makeCourse(slot: Partial<Course['timeSlots'][number]> & { dayOfWeek: number }): Course {
  courseId += 1;
  return {
    id: `c${courseId}`,
    name: '测试课程',
    semesterId: 's1',
    timeSlots: [{ weekRange: '1-3', repeatRule: RepeatRule.ALL, classSections: [1], ...slot }],
    code: '',
    location: '',
    credits: 2,
    teacher: '',
    assessmentMethod: AssessmentMethod.EXAM,
    notes: '',
    color: '#4285f4',
  };
}

const NOW = new Date(2026, 8, 24, 8, 0); // 2026-09-24(周四)08:00

void (async () => {
  // 1. 文案:含/不含地点
  check(
    'body-with-location',
    formatReminderBody('高等数学', 10, '教西C1-203'),
    '高等数学将在10分钟后开始,上课地点为教西C1-203,请做好准备',
  );
  check('body-no-location', formatReminderBody('高等数学', 10), '高等数学将在10分钟后开始,请做好准备');

  // 2. 周五课程 → 触发时间为上课前 10 分钟
  const friday = makeCourse({ dayOfWeek: 5 });
  const occ = computeReminderOccurrences([friday], [semester], 10, NOW);
  check('friday-count', occ.length, 3);
  check('friday-first-trigger', occ[0]!.triggerDate.toISOString(), new Date(2026, 8, 25, 7, 50).toISOString());
  check('friday-first-id', occ[0]!.identifier, 'reminder-c1-0-2026-09-25');

  // 3. 已过时刻不排程
  const lateNow = new Date(2026, 8, 25, 8, 5);
  check('past-trigger-skipped', computeReminderOccurrences([friday], [semester], 10, lateNow).length, 2);

  // 4. 单双周:ODD 在 1/3 周出现
  const odd = makeCourse({ dayOfWeek: 6, repeatRule: RepeatRule.ODD });
  const oddOcc = computeReminderOccurrences([odd], [semester], 10, NOW);
  check('odd-count', oddOcc.length, 2);
  check('odd-dates', oddOcc.map((o) => o.triggerDate.getDate()), [26, 10]);

  // 5. 周次范围 2-3
  const range = makeCourse({ dayOfWeek: 6, weekRange: '2-3' });
  check('week-range-count', computeReminderOccurrences([range], [semester], 10, NOW).length, 2);

  // 6. 友谊校区:夏季 9/25 用主时间表、冬季 10/2 用辅时间表
  const youyi: Semester = {
    ...semester,
    id: 's2',
    campus: '友谊',
    sectionTimes: [{ start: '08:00', end: '08:45' }],
    altSectionTimes: [{ start: '14:00', end: '14:45' }],
  };
  const youyiCourse = makeCourse({ dayOfWeek: 5 });
  const youyiOcc = computeReminderOccurrences([{ ...youyiCourse, semesterId: 's2' }], [youyi], 10, NOW);
  check('youyi-summer-trigger', youyiOcc[0]!.triggerDate.getHours(), 7);
  check('youyi-winter-trigger', youyiOcc[1]!.triggerDate.getHours(), 13);

  // 7. 已结束学期不排程;90 天窗口内未来学期排程
  const pastSemester: Semester = { ...semester, id: 's3', startDate: '2026-01-05', endDate: '2026-01-31' };
  const pastCourse = { ...makeCourse({ dayOfWeek: 5 }), semesterId: 's3' };
  check('past-semester-skipped', computeReminderOccurrences([pastCourse], [pastSemester], 10, NOW).length, 0);

  // 8. 上限保护:返回值不超过 MAX_REMINDERS(逻辑常量自证)
  check('max-reminders-constant', MAX_REMINDERS, 400);

  if (failures > 0) {
    console.error(`\n${failures} 项失败`);
    process.exit(1);
  }
  console.log('\n全部通过');
})();
```

`package.json` scripts 增加:

```json
"verify:reminder": "npx tsx scripts/verify-reminder-scheduler.ts",
```

- [ ] **步骤 2:运行验证失败**

运行:`npm run verify:reminder`
预期:FAIL——`Cannot find module '@/utils/reminderScheduler'`

- [ ] **步骤 3:实现排程纯逻辑**

`src/utils/reminderScheduler.ts`(无任何 expo-notifications/RN import,可 Node 运行):

```ts
import { addDays, parseISO } from 'date-fns';
import type { Course, Semester } from '@/types';
import {
  getWeekNumberForDate,
  isWeekInRange,
  matchesRepeatRule,
  toISODate,
} from './scheduleDate';
import { getSectionTimesForDate } from './campusTimes';
import { formatLocationForDisplay } from './locationFormat';

export const REMINDER_CHANNEL_ID = 'class-reminders';
export const REMINDER_LEAD_OPTIONS = [5, 10, 15, 30] as const;
export const DEFAULT_REMINDER_LEAD_MINUTES = 10;
/** Android 闹钟上限 500,留余量 */
export const MAX_REMINDERS = 400;
/** 为覆盖学期切换,对「今天起 90 天内开始」的未来学期也排程 */
const FUTURE_SEMESTER_WINDOW_DAYS = 90;

export interface ReminderOccurrence {
  identifier: string;
  triggerDate: Date;
  title: string;
  body: string;
  courseName: string;
  location?: string;
}

export function formatReminderBody(
  courseName: string,
  leadMinutes: number,
  location?: string,
): string {
  const locationPart = location ? `,上课地点为${location}` : '';
  return `${courseName}将在${leadMinutes}分钟后开始${locationPart},请做好准备`;
}

/**
 * 展开所有课程的未来上课时刻,生成提醒清单(按触发时间升序,超出 MAX_REMINDERS 截断)。
 * 纯函数:依赖课程/学期数据与当前时间,不产生副作用。
 */
export function computeReminderOccurrences(
  courses: Course[],
  semesters: Semester[],
  leadMinutes: number,
  now: Date = new Date(),
): ReminderOccurrence[] {
  const occurrences: ReminderOccurrence[] = [];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const horizon = addDays(today, FUTURE_SEMESTER_WINDOW_DAYS);

  for (const course of courses) {
    const semester = semesters.find((s) => s.id === course.semesterId);
    if (!semester || semester.id === 'default') continue;
    const semesterStart = parseISO(semester.startDate);
    const semesterEnd = parseISO(semester.endDate);
    if (semesterEnd < today || semesterStart > horizon) continue;

    const rangeStart = semesterStart > today ? semesterStart : today;
    const rangeEnd = semesterEnd < horizon ? semesterEnd : horizon;

    for (let d = new Date(rangeStart); d <= rangeEnd; d = addDays(d, 1)) {
      const dow = ((d.getDay() + 6) % 7) + 1;
      const weekNumber = getWeekNumberForDate(d, semester);
      if (weekNumber < 1 || weekNumber > semester.weekCount) continue;
      const times = getSectionTimesForDate(semester, d);

      for (let si = 0; si < course.timeSlots.length; si++) {
        const slot = course.timeSlots[si];
        if (slot.dayOfWeek !== dow) continue;
        if (!isWeekInRange(weekNumber, slot.weekRange)) continue;
        if (!matchesRepeatRule(weekNumber, slot.repeatRule)) continue;

        const sorted = [...slot.classSections].sort((a, b) => a - b);
        const start = times[sorted[0] - 1]?.start;
        if (!start) continue;
        const [h, m] = start.split(':').map(Number);
        const classStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
        const triggerDate = new Date(classStart.getTime() - leadMinutes * 60_000);
        if (triggerDate <= now) continue;

        const location = formatLocationForDisplay(course.location) || undefined;
        occurrences.push({
          identifier: `reminder-${course.id}-${si}-${toISODate(d)}`,
          triggerDate,
          title: '上课提醒',
          body: formatReminderBody(course.name, leadMinutes, location),
          courseName: course.name,
          location,
        });
      }
    }
  }

  occurrences.sort((a, b) => a.triggerDate.getTime() - b.triggerDate.getTime());
  return occurrences.slice(0, MAX_REMINDERS);
}
```

- [ ] **步骤 4:运行验证通过**

运行:`npm run verify:reminder`
预期:全部 PASS、`全部通过`

- [ ] **步骤 5:Commit**

```bash
git add src/utils/reminderScheduler.ts scripts/verify-reminder-scheduler.ts package.json
git commit -m "feat(reminder): 排程纯逻辑 computeReminderOccurrences + Node 验证脚本"
```

---

### 任务 2:expo-notifications 集成层 + 前台 handler 注册

**文件:**
- 创建:`src/utils/reminderNotifications.ts`
- 修改:`index.ts`

- [ ] **步骤 1:实现集成层**

`src/utils/reminderNotifications.ts`:

```ts
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { REMINDER_CHANNEL_ID, type ReminderOccurrence } from './reminderScheduler';

/** 创建「上课提醒」通知渠道(高重要性 + 响铃),幂等可重复调用 */
export async function ensureReminderChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: '上课提醒',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });
}

/** 前台收到通知时显示横幅(必须在 bundle 入口注册,保证所有 JS 上下文生效) */
export function configureReminderHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** 全量替换排程:取消全部 + 逐条排程(顺序执行,避免并发触发闹钟上限) */
export async function scheduleReminders(occurrences: ReminderOccurrence[]): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const occ of occurrences) {
    await Notifications.scheduleNotificationAsync({
      identifier: occ.identifier,
      content: { title: occ.title, body: occ.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: occ.triggerDate,
        channelId: REMINDER_CHANNEL_ID,
      },
    });
  }
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
```

- [ ] **步骤 2:入口注册前台 handler**

`index.ts` 修改为:

```ts
// 自定义 bundle 入口(替代 expo-router/entry,见 package.json main)。
// widget-task-handler 必须在此注册:widget 事件在 headless 冷启动时(如 App 被杀后、
// 重启后系统刷新)会拉起独立 JS 上下文,Expo Router 的路由模块(_layout 等)不会被
// 加载,仅在 _layout 中 import 会导致后台任务找不到 handler 而不渲染。
// 模板取自 node_modules/expo-router/entry-classic.js。
import '@expo/metro-runtime';
import { App } from 'expo-router/build/qualified-entry';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';
import '@/widgets/widget-task-handler';
import { configureReminderHandler } from '@/utils/reminderNotifications';

configureReminderHandler();

renderRootComponent(App);
```

- [ ] **步骤 3:验证 + Commit**

运行:`npm run typecheck && npm run lint`
预期:通过

```bash
git add src/utils/reminderNotifications.ts index.ts
git commit -m "feat(reminder): expo-notifications 集成层与前台 handler 注册"
```

---

### 任务 3:settingsStore 扩展

**文件:**
- 修改:`src/stores/settingsStore.ts`

- [ ] **步骤 1:新增字段与 actions**

`SettingsState` 接口新增:

```ts
  reminderEnabled: boolean;
  reminderLeadMinutes: number;
```

store 初始值:`reminderEnabled: false, reminderLeadMinutes: DEFAULT_REMINDER_LEAD_MINUTES,`

actions:

```ts
      setReminderEnabled: (enabled) => set({ reminderEnabled: enabled }),
      setReminderLeadMinutes: (minutes) => set({ reminderLeadMinutes: minutes }),
```

`partialize` 增加两个字段:

```ts
      partialize: (state) => ({
        semesters: state.semesters,
        themeColor: state.themeColor,
        darkMode: state.darkMode,
        reminderEnabled: state.reminderEnabled,
        reminderLeadMinutes: state.reminderLeadMinutes,
      }),
```

`formatData` 重置:

```ts
        set({
          semesters: [],
          themeColor: DEFAULT_THEME_COLOR,
          darkMode: false,
          reminderEnabled: false,
          reminderLeadMinutes: DEFAULT_REMINDER_LEAD_MINUTES,
        });
```

顶部 import:`import { DEFAULT_REMINDER_LEAD_MINUTES } from '@/utils/reminderScheduler';`

- [ ] **步骤 2:验证 + Commit**

运行:`npm run typecheck`
预期:通过

```bash
git add src/stores/settingsStore.ts
git commit -m "feat(reminder): settingsStore 新增提醒开关与提前分钟数持久化"
```

---

### 任务 4:useReminderSync 自动重排 hook

**文件:**
- 创建:`src/hooks/useReminderSync.ts`
- 修改:`app/_layout.tsx`

- [ ] **步骤 1:实现 hook**

`src/hooks/useReminderSync.ts`(仿 useWidgetDataSync 模式):

```ts
import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Course, Semester } from '@/types';
import { useCourseStore } from '@/stores/courseStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { computeReminderOccurrences } from '@/utils/reminderScheduler';
import {
  cancelAllReminders,
  ensureReminderChannel,
  scheduleReminders,
} from '@/utils/reminderNotifications';

/** 课程/学期/提醒设置变化时全量重排通知;仅在 app 水合后启用(防半水合数据排程) */
export function useReminderSync(enabled = true) {
  const courses = useCourseStore((s) => s.courses);
  const semesters = useSettingsStore((s) => s.semesters);
  const reminderEnabled = useSettingsStore((s) => s.reminderEnabled);
  const leadMinutes = useSettingsStore((s) => s.reminderLeadMinutes);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      void syncReminders(reminderEnabled, leadMinutes, courses, semesters);
    });
    return () => {
      cancelled = true;
      task.cancel?.();
    };
  }, [enabled, courses, semesters, reminderEnabled, leadMinutes]);

  return null;
}

async function syncReminders(
  reminderEnabled: boolean,
  leadMinutes: number,
  courses: Course[],
  semesters: Semester[],
): Promise<void> {
  try {
    if (!reminderEnabled) {
      await cancelAllReminders();
      return;
    }
    // 排程前复查通知权限:被系统撤销 → 清理排程(不弹请求框,设置页显示警告行)
    const perms = await Notifications.getPermissionsAsync();
    if (!perms.granted) {
      await cancelAllReminders();
      return;
    }
    await ensureReminderChannel();
    const occurrences = computeReminderOccurrences(courses, semesters, leadMinutes);
    await scheduleReminders(occurrences);
  } catch {
    // 排程失败静默:不阻塞 UI,下次数据变化会重试
  }
}
```

- [ ] **步骤 2:挂载 hook**

`app/_layout.tsx` 修改(在 `useWidgetDataSync(appHydrated);` 之后):

```ts
  useReminderSync(appHydrated);
```

并新增 import:`import { useReminderSync } from '@/hooks/useReminderSync';`

- [ ] **步骤 3:验证 + Commit**

运行:`npm run typecheck && npm run lint`
预期:通过

```bash
git add src/hooks/useReminderSync.ts app/_layout.tsx
git commit -m "feat(reminder): useReminderSync 订阅 store 自动全量重排通知"
```

---

### 任务 5:设置界面「上课提醒」卡片

**文件:**
- 修改:`app/settings.tsx`

- [ ] **步骤 1:实现卡片**

新增 imports:

```ts
import { SegmentedButtons } from 'react-native-paper';
import * as Notifications from 'expo-notifications';
import { REMINDER_LEAD_OPTIONS } from '@/utils/reminderScheduler';
```

组件内新增 selectors 与状态:

```ts
  const reminderEnabled = useSettingsStore((s) => s.reminderEnabled);
  const setReminderEnabled = useSettingsStore((s) => s.setReminderEnabled);
  const reminderLeadMinutes = useSettingsStore((s) => s.reminderLeadMinutes);
  const setReminderLeadMinutes = useSettingsStore((s) => s.setReminderLeadMinutes);
  const [permissionDenied, setPermissionDenied] = useState(false);
```

开关处理(请求权限,拒绝则回弹 + 提示):

```ts
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

  useEffect(() => {
    Notifications.getPermissionsAsync().then((p) => setPermissionDenied(!p.granted));
  }, []);
```

卡片 JSX(插在「外观」卡片与「数据管理」卡片之间):

```tsx
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
      </View>
```

注意:Icon 名 `alert` 已在 Icon.tsx 映射中存在(settings.tsx 现有「格式化数据」行已使用)。

- [ ] **步骤 2:验证 + Commit**

运行:`npm run typecheck && npm run lint`
预期:通过

```bash
git add app/settings.tsx
git commit -m "feat(reminder): 设置界面新增上课提醒卡片"
```

---

### 任务 6:app.json 插件与权限声明

**文件:**
- 修改:`app.json`

- [ ] **步骤 1:注册插件与权限**

`plugins` 数组在 `"expo-sharing"` 之后追加 `"expo-notifications"`:

```json
      ],
      "expo-sharing",
      "expo-notifications"
    ],
```

`android` 段新增 `permissions`:

```json
    "android": {
      "package": "com.nwpu.soaringschedule",
      "permissions": [
        "POST_NOTIFICATIONS",
        "SCHEDULE_EXACT_ALARM",
        "USE_EXACT_ALARM"
      ],
```

说明:`USE_EXACT_ALARM`(API 33+,日历类应用安装即授予)与 `SCHEDULE_EXACT_ALARM`(API 31-32 声明即授予)使 expo-notifications 原生层 `canScheduleExactAlarms()` 恒为真 → 精确闹钟,无运行时跳转。POST_NOTIFICATIONS 由库 manifest 自带,此处显式声明以明确意图。

- [ ] **步骤 2:prebuild 验证权限合并**

运行:`npx expo prebuild --clean`(不破坏受版本控制的文件,android/ 已 gitignore)
核对:`grep -n "SCHEDULE_EXACT_ALARM\|USE_EXACT_ALARM\|POST_NOTIFICATIONS" android/app/src/main/AndroidManifest.xml` 三项均存在
核对:`grep -n "updatePeriodMillis" android/app/src/main/res/xml/widgetprovider_coursewidget.xml` 仍为 1800000(回归确认)

- [ ] **步骤 3:Commit**

```bash
git add app.json
git commit -m "feat(reminder): 声明精确闹钟与通知权限,注册 expo-notifications 插件"
```

---

### 任务 7:文档同步与全量验证

**文件:**
- 修改:`README.md`、`CLAUDE.md`

- [ ] **步骤 1:更新文档**

`README.md` 设置行(功能表「设置」一列)追加「上课提醒(开关 + 提前档位 + 本地精确通知)」;技术栈块追加 `expo-notifications`。

`CLAUDE.md` Key Utilities 节新增两条:

```md
- **`reminderScheduler.ts`** — 上课提醒排程纯逻辑:课程时间段展开为未来触发时刻(周次/单双周/友谊季节感知),Node 可测(`npm run verify:reminder`)
- **`reminderNotifications.ts`** — expo-notifications 集成:渠道、前台 handler(入口 index.ts 注册)、全量替换排程;`useReminderSync` 在课程/学期/设置变化时自动重排
```

- [ ] **步骤 2:全量静态验证**

运行:`npm run verify:reminder && npm run typecheck && npm run lint`
预期:全部通过

- [ ] **步骤 3:Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: 上课提醒功能文档同步"
```

---

## 真机验证清单(用户操作,preview APK)

构建:`eas build --profile preview` 后安装(权限与原生变更,必须重新构建)。

1. 设置页打开「开启提醒」→ 通知权限弹窗 → 授予 → 显示档位(默认 10 分钟)
2. 拒绝权限路径:卸载重装后点开关 → 拒绝 → 开关保持关闭 + Snackbar + 警告行
3. 将一门课节次改为当前时间 +11 分钟后(触发 = 现在 +1 分钟)→ 准点收到通知,文案含/不含地点两种格式正确
4. 切换档位 5 分钟 → 重排生效(通知提前量变化)
5. 编辑课程时间 → 旧通知取消、新时间到达
6. 关闭开关 → 全部取消
7. 重启手机(不打开 App)→ 已排通知仍到达(库自带 boot receiver)
8. 格式化数据 → 通知取消、开关复位
9. App 前台时收到通知显示横幅
10. 友谊校区学期:冬夏季节边界两侧的通知时间正确

## 已知限制(与设计规格一致)

- App 被强停(force-stop):系统取消全部通知,需再次打开 App 由 useReminderSync 重排
- 通知权限被系统设置撤销:排程自动清理,设置页显示警告行
- `USE_EXACT_ALARM` 有 Play 政策限制(闹钟/日历类);本项目为内部分发(EAS internal),风险低;若未来上架 Play 被拒,改回 `SCHEDULE_EXACT_ALARM` + 运行时引导即可
- Expo Go 不支持 expo-notifications,测试需 dev build / preview APK
