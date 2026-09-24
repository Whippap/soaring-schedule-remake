# 友谊校区双时间表设计

日期：2026-08-28
状态：已批准

## 背景与问题

当前课表应用的节次时间预设分为三种：长安校区（13 节）、友谊校区夏季（12 节）、友谊校区冬季（12 节），选择预设时把静态的 `SectionTime[]` 复制进 `Semester.sectionTimes`。

实际上友谊校区全年使用两套时间表：

- **夏季时间**：5月1日–9月30日
- **冬季时间**：10月1日–4月30日

一个学期（如春季学期 2月–7月）必然会跨越 5月1日 或 10月1日 的时间更替。当前静态复制的方式无法正确处理更替，需要把友谊夏、冬合并为一套"友谊校区"预设，并按日期动态选择时间表。

## 目标

1. 表单预设合并为两个：长安、友谊（友谊内含夏、冬两套时间）
2. 课表显示按三种情况处理：
   - 当前周属于假期 → 显示默认时间
   - 当前周属于某个学期且不跨更替日 → 按日期显示对应时间表
   - 当前周属于某个学期且跨更替日 → 时间列顶部出现切换按钮（左右箭头指示当前显示哪套），更替的两天列之间画加粗竖线
3. Widget 按当天日期（今天、明天各自判定）显示对应时间表

## 决策记录

| 决策点 | 选择 | 备选（已排除） |
|--------|------|----------------|
| 校区标记与迁移 | `Semester` 加 `campus` 字段 + 启动时自动迁移旧数据 | 不加字段运行时隐式识别（自定义时间会误判）；惰性迁移（使用点易遗漏） |
| 时间表存储 | 双套时间落库（`sectionTimes` 夏 + `altSectionTimes` 冬） | 运行时查代码预设表（用户自定义节数无法保存，备份丢信息） |
| 时间列按钮布局 | 保持 42px 宽，紧凑图标按钮（`◀冬` / `夏▶`） | 全局加宽到 60px（牺牲课程列宽）；仅边界周临时加宽（布局跳动） |
| 边界周默认显示 | 按当前选中日期（anchor）所属时间表，每周重置 | 总是显示跨越前那套；跨周记住手动选择 |

## 时间规则

- `getYouyiSeasonForDate(date)`：5月1日–9月30日（含端点）→ `'summer'`；其余（10月1日–4月30日）→ `'winter'`
- 友谊夏、冬两套均为 12 节，节次编号一一对应。切换时间表只改变时间列文字，课程块位置不变

## 数据模型

`src/types/index.ts`：

```ts
export type Campus = '长安' | '友谊';

export interface Semester {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  weekCount: number;
  sectionCount: number;
  sectionTimes: SectionTime[];        // 友谊：夏季 12 节；长安：13 节；默认假期：13 节
  campus?: Campus;                    // 缺省视为长安，兼容旧数据与导入数据
  altSectionTimes?: SectionTime[];    // 仅友谊：冬季 12 节
}
```

`createDefaultSemester()` 不变（无 campus → 按长安处理，显示默认时间）。

## 新模块：`src/utils/campusTimes.ts`

集中管理预设与时间判定（消除 `SemesterForm` / `TimeTableEditor` 中预设重复的代码异味）：

```ts
export type YouyiSeason = 'summer' | 'winter';

export const CHANGAN_SECTION_TIMES: SectionTime[];   // 13 节，原 SemesterForm 中的值
export const YOUYI_SUMMER_TIMES: SectionTime[];      // 12 节，原「友谊校区夏季」
export const YOUYI_WINTER_TIMES: SectionTime[];      // 12 节，原「友谊校区冬季」

export function applyCampusPreset(campus: Campus): {
  sectionTimes: SectionTime[];
  altSectionTimes?: SectionTime[];
};                                                    // 友谊 → 夏主冬辅；长安 → 仅一套

export function sectionTimesEqual(a: SectionTime[], b: SectionTime[]): boolean;

export function getYouyiSeasonForDate(date: Date): 'summer' | 'winter';
// 实现：md = month*100 + day；501 <= md <= 930 → summer

export function getSectionTimesForDate(semester: Semester, date: Date): SectionTime[];
// 统一入口：campus !== '友谊' 或 altSectionTimes 缺失 → sectionTimes
//           友谊 → summer ? sectionTimes : altSectionTimes

export function findSeasonBoundary(days: Date[]): number | null;
// days 为显示的日期序列（7 天或 3 天，周一在前的连续日期）
// 返回 i：更替发生在 days[i-1] 与 days[i] 之间；i === 0 表示更替发生在
// days[0] 前一天与 days[0] 之间（如更替日恰为周一，竖线画在首列左缘）
// 无更替 → null

export function migrateSemesters(semesters: Semester[]): Semester[];
// 幂等迁移，见下节
```

## 迁移

`migrateSemesters`（幂等，可在启动时和导入时重复执行）：

1. `campus === '友谊'` → 原样返回
2. `sectionTimes` 等于 `YOUYI_SUMMER_TIMES` 或 `YOUYI_WINTER_TIMES` → 标记 `campus: '友谊'`，夏季放主位（`sectionTimes`），冬季放 `altSectionTimes`
3. 其余（长安或自定义时间）→ 原样返回，按长安处理

接入点：

- `settingsStore.ts` 的 `onRehydrateStorage`：rehydrate 后对 `state.semesters` 执行迁移，有变化则 `setState` 写回（zustand persist 会自动持久化）
- `dataBackup.ts` 的 `importData`：导入的 `parsed.settings.semesters` 先过迁移再写入 AsyncStorage 和 store

备份版本号保持 `2.0` 不变（新增字段向后兼容，`validateBackup` 不做深字段校验）。

## 课表 UI：`CourseSchedule.tsx`

### 取值

```ts
const isYouyi = semester.campus === '友谊' && !isDefault;
const boundary = isYouyi ? findSeasonBoundary(days) : null;   // 情况 3 判定
const activeTimes = boundary !== null
  ? (activeSeason === 'summer' ? semester.sectionTimes : semester.altSectionTimes!)
  : getSectionTimesForDate(semester, anchor);                 // 情况 1、2
```

时间列第 sec 节显示 `activeTimes[sec - 1]?.start`。

### 切换状态（无 flicker 的确定性方案）

```ts
// key = `${weekOffset}-${dayMode}`；override 只在 key 匹配时生效
const [override, setOverride] = useState<{ key: string; season: YouyiSeason } | null>(null);
const autoSeason = getYouyiSeasonForDate(anchor);
const activeSeason = override?.key === currentKey ? override.season : autoSeason;
```

点击按钮：`setOverride({ key: currentKey, season: 另一套 })`。滑到其他周或切换 7天/3天 模式时 key 变化，override 自动失效（回到按选中日期判定），无需 effect 清理，也不会出现一帧残留。

### 情况 3 的渲染（boundary !== null）

- **切换按钮**：时间列顶部、第一节时间上方，新增一行高 `TOGGLE_ROW_HEIGHT = 30`：
  - 宽度 42px（`TIME_COLUMN_WIDTH`），居中显示紧凑文本
  - 文本：显示两侧季节标签 + 激活侧箭头，左右排列跟随竖线实际布局——5月1日周（冬在左）显示 `◀冬 夏` / `冬 夏▶`；10月1日周（夏在左）显示 `◀夏 冬` / `夏 冬▶`。颜色 `dt.colors.primary`，字号约 10、加粗
  - 点击在夏/冬间切换；仅改变时间列文字
- **对齐垫行**：每个天列顶部渲染同高（30px）的空白 View，保证网格行与时间列对齐；天列总高相应变为 `sectionCount * ROW_HEIGHT + TOGGLE_ROW_HEIGHT`
- **加粗竖线**：在 `gridBody` 内绝对定位，`left = TIME_COLUMN_WIDTH + boundary * columnWidth`，宽 3px，`top: 0, bottom: 0`，颜色 `dt.colors.primary`，贯穿课程网格区域。`boundary === 0` 时画在首列左缘（可 clamp 到 `TIME_COLUMN_WIDTH`）

### 3 天模式

`days` 为 anchor 起连续 3 天，`findSeasonBoundary` 同样适用：显示的 3 天跨更替日 → 按钮 + 竖线；不跨 → 按日期显示（情况 2）。

## Widget：`widgetData.ts`

`buildDayCourses` 中：

```ts
const times = getSectionTimesForDate(semester, date);
const startTime = times[firstSec - 1]?.start ?? '';
const endTime = times[lastSec - 1]?.end ?? '';
```

今天、明天各自用各自的 `date` 判定时间表（跨更替日时如 4/30 显示冬季、5/1 显示夏季）。其余逻辑（筛选、排序、`filterUpcomingCourses`）不动。

## 表单：`SemesterForm.tsx`

- `CAMPUS_PRESETS` 与 `PRESET_LABELS` 移除，改为两个预设按钮：`长安` / `友谊`（`value` 即 `Campus`）
- 新增状态 `altSectionTimes`；`handlePreset(campus)` 调用 `applyCampusPreset` 同时写入主、辅两套时间，节数随之设为 12 或 13
- 打开/编辑重置时（`useLayoutEffect`）补上：`setAltSectionTimes(editing?.altSectionTimes)`、`setSelectedPreset(editing?.campus ?? '长安')`（修复现有"编辑友谊学期时预设选中态不还原"的问题）
- 「每天节数」增减：主、辅两套时间同步裁剪/追加（追加逻辑各自基于本套最后一条的结束时间）
- 重叠校验（`hasOverlap`）同时检查两套
- `handleSave` 的 draft 增加 `campus: selectedPreset as Campus`、`altSectionTimes`
- 选中友谊预设时，预设行下方显示说明文字：`含夏、冬两套时间，5月1日、10月1日自动切换`

## 其他接入点

- `CourseImportWizard.handleAutoCreateSemester` 与 `jwxtParser.buildSemesterFromData` 生成的学期 draft 不含 campus（按长安处理），用户在随后弹出的 `SemesterForm` 中可选友谊预设——不改代码
- `TimeTableEditor.tsx`（未使用死代码）、`CalendarView`、`CourseDetailSheet` 均不触碰

## 边界情况

| 场景 | 行为 |
|------|------|
| 更替日恰为周一（如 10/1 周一） | 本周全部为同一套时间；`findSeasonBoundary` 与前一天比较返回 0，按钮显示，竖线画在首列左缘 |
| 更替日恰为周日 | 竖线画在周六/周日列之间 |
| 3 天模式不跨更替日 | 无按钮无竖线，按日期显示 |
| 假期 / 无学期数据 | `findSemesterForDate` 返回默认学期，无 campus → 默认时间 |
| 用户自定义过节次时间的旧学期 | 迁移时不匹配预设 → 视为长安，原时间原样保留 |
| 旧友谊冬学期 | 迁移后夏季放主位、冬季放辅位，两套齐全 |
| 编辑友谊学期时改节数 | 两套同步裁剪/追加，长度始终一致 |

## 范围外

- `TimeTableEditor.tsx` 的死代码清理与预设去重（当前不动，仅在新模块中消除新增重复）
- Widget 午夜/跨天不刷新问题（已由后续改动解决：系统 30 分钟周期刷新 + headless 从存储重建快照）

## 验证

无测试套件，验证命令：`npm run typecheck`、`npm run lint`。

手动验证清单：

1. 新建友谊学期（跨 5/1，如 2/20–7/10）：3 月周显示冬季时间、6 月周显示夏季时间（情况 2）
2. 边界周：按钮出现、默认按选中日期、点击切换时间列文字、竖线位于更替的两天之间
3. 滑走再滑回：按钮消失/重置；7天/3天 切换：重置
4. 假期（无学期或日期落在假期）：默认时间（情况 1）
5. 长安学期：无按钮无竖线，时间不变
6. Widget：友谊学期下今天/明天时间各自按日期正确；跨更替日（如 4/30 与 5/1）各自正确
7. 迁移：预置旧友谊夏/冬格式数据 → 启动后 campus='友谊' 且两套时间齐全
8. 备份：导出→导入后语义不变；导入旧格式备份后正确迁移
9. 编辑旧友谊学期：表单自动选中友谊预设
