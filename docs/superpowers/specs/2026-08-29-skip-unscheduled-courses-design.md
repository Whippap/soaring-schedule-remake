# 导入跳过不排课课程设计

日期：2026-08-29
状态：已批准

## 背景与问题

从教务系统导入课表时，不排课的课程（如「科研训练与学科竞赛」）会被错误地赋予伪造的上课时间。根因有两处：

1. `parseScheduleText`（`src/utils/jwxtParser.ts`）对空文本或解析不出课节的文本，返回伪造的默认课节 `[{ weekRange: '1-16', dayOfWeek: 1, classSections: [1] }]`。
2. 提取器（`JwxtWebView.tsx` 的 `EXTRACT_DATA_SCRIPT` 与 `parseJwxtHtml`）在行内找不到时间 td 时，把最后两个 td（「不排课」+「备注：」）拼接为 `scheduleText`；且整页一个课程都没解析出时，用课程名伪造 `'1-16周 周一 第1-2节'` 兜底导入。

教务系统中不排课行的形态：

```html
<tr class="lessonInfo" data-semester="362">
  <td class="courseInfo" data-course="科研训练与学科竞赛[U05P61001]">
    <p class="showSchedules">科研训练与学科竞赛</p>
    <p>U05P61001<i class="operator"></i>实践实训<i class="operator"></i>机电学院</p>
    <p>...学分(2)...总课时(32)...已安排课时(0)...</p>
    <p>必修&nbsp;&nbsp;其他</p>
    <p>授课教师：冯硕(2024072007)</p>
  </td>
  <td class="text"><p class="inner">2024级学生</p></td>
  <td>不排课</td>
  <td><div class="remark">备注：<br></div></td>
</tr>
```

## 目标

1. 无上课时间的课程（解析不出任何课节）在导入时直接跳过，不导入课表。
2. 在「导入课表 - 选择学期」界面的预览区下方，新增提示区「以下课程不排课，不会导入课表」，列出被跳过的课程。
3. 移除两处伪造兜底：`parseScheduleText` 的空结果伪造、整页解析失败时的课程伪造。

## 决策记录

| 决策点 | 选择 | 备选（已排除） |
|--------|------|----------------|
| 跳过判定 | 无课节即跳过，地点不参与判定 | 严格按「时间地点两者都没有」（有地点无时间会导入不可显示的课程） |
| 判定位置 | 解析工具层新增 `isUnscheduledCourse`，`convertToCourses` 与 UI 共用 | 提取层打 `noSchedule` 标志（两处提取器需同步改）；UI 与导入各写一套判定（逻辑重复易漂移） |
| 整页解析失败的伪造兜底 | 移除，显示 0 门课程 | 保留（伪造课程有伪造时间，仍会被导入） |
| 已有脏数据 | 不做自动迁移，用户重新导入并勾选「覆盖该学期现有课程」 | 自动清理（可能误伤真实课程，如真实存在周一第 1 节无地点记录的课程） |

## 解析层变更

### `parseScheduleText` 移除伪造兜底

`src/utils/jwxtParser.ts`：

- 输入为空文本时不再返回默认课节，返回 `[]`。
- 解析完成后 `slots.length === 0` 时不再填充默认课节，返回 `[]`。

已核查全部调用点，返回 `[]` 均安全：

| 调用点 | 影响 |
|--------|------|
| `convertToCourses` | 空数组 → `continue` 跳过，正是目标行为 |
| `computeMaxWeekAndSection` | 空数组循环无贡献，maxWeek/maxSection 保持默认 |
| `CourseImportWizard` 预览 | 改为只渲染有课节的课程，`[0]` 恒存在 |

### 提取器识别「不排课」行

`JwxtWebView.tsx`（`EXTRACT_DATA_SCRIPT`）与 `parseJwxtHtml`（`parseJwxtHtml`）：

- 扫描 td 时，若某 td 的纯文本为「不排课」，该行 `scheduleText` 置空，跳过 `slice(-2)` 拼接兜底。

### 移除整页解析失败的伪造兜底

`JwxtWebView.tsx` 与 `parseJwxtHtml` 中 `courses.length === 0` 时的课程名伪造逻辑删除。该情况返回空课程列表；向导界面显示「预览（0 门）」，点导入提示「没有找到可导入的课程」。

## 判定与数据层

`src/utils/jwxtParser.ts`：

```ts
export function isUnscheduledCourse(raw: RawCourse): boolean {
  return parseScheduleText(raw.scheduleText).length === 0;
}
```

- `convertToCourses` 中现有 `timeSlots.length === 0 → continue` 分支改用 `isUnscheduledCourse(raw)`，语义直白。
- `enhanceExtractedData` 保持现状：无课节课程继续保留在 `ParsedData.courses` 中供 UI 展示；网课课程仍被过滤（不进跳过列表）。

## UI 变更

`src/components/CourseImportWizard.tsx`（选择学期步骤）：

- 按所选 dataSemester 过滤后，课程拆为两组：
  - `importableCourses`：`!isUnscheduledCourse(c)`
  - `skippedCourses`：`isUnscheduledCourse(c)`
- 「预览（N 门）」只渲染 `importableCourses`（保持前 5 门 + 「还有 N 门」样式）。
- 预览区下方，`skippedCourses.length > 0` 时渲染：
  - 标题：「以下课程不排课，不会导入课表（M 门）」
  - 列表：每门课程名（`textSecondary` 色；解析到代码时附上代码）
- 顶部「检测到的学期（共提取 N 门课程）」保持总提取数不变。
- `handleImport` 无需改动：`convertToCourses` 自动跳过；全部跳过时已有「没有找到可导入的课程」提示。

## 边界情况

- 无时间有地点 → 跳过（决策记录第 1 条）。
- 仅网课文本的课程 → `enhanceExtractedData` 已过滤，不进跳过列表。
- 整页解析失败 → 0 门课程，用户返回重试。
- 已有脏数据 → 不迁移，重新导入并覆盖即可。

## 验证

- `npm run typecheck`（项目无测试套件，主验证命令）。
- 实现后对解析逻辑跑轻量脚本验证，覆盖用例：
  - `parseScheduleText('')` → `[]`
  - `parseScheduleText('不排课 备注：')` → `[]`
  - `parseScheduleText('1-14周 周一 第七节~第八节')` → 正常课节
  - `isUnscheduledCourse` 对上述 RawCourse 的判定
