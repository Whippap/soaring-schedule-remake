# 导入跳过不排课课程 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 subagent-driven-development（推荐）或 executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 导入课表时跳过不排课（无上课时间）的课程，并在「选择学期」界面预览区下方显示被跳过的课程列表。

**架构：** 移除 `parseScheduleText` 的伪造兜底（根因），新增 `isUnscheduledCourse` 判定函数，`convertToCourses` 与导入向导 UI 共用；提取器（WebView 脚本 + `parseJwxtHtml`）显式识别「不排课」行并移除整页解析失败时的课程伪造兜底。

**技术栈：** React Native + Expo SDK 57、TypeScript（`npm run typecheck` 为验证主命令）、`npx tsx`（一次性 npx 下载，运行 Node 验证脚本；已验证可用：tsx 支持 tsconfig 路径别名，`Module._load` 打桩可跳过 `react-native-get-random-values`）。

**规格：** `docs/superpowers/specs/2026-08-29-skip-unscheduled-courses-design.md`

**验证脚本运行方式：** `npx tsx scripts/verify-jwxt-parser.ts`（脚本会打桩 `react-native-get-random-values`，Node 20 自带 `globalThis.crypto`，uuid 可正常工作——已实测）。

每条 commit 消息需以 `Co-Authored-By: Claude Code <noreply@anthropic.com>` 结尾。

---

## 文件结构

| 文件 | 职责 |
|------|------|
| 创建 `scripts/verify-jwxt-parser.ts` | 解析器行为验证脚本（Node 下运行，无需启动 App），覆盖 parseScheduleText / parseJwxtHtml / isUnscheduledCourse / convertToCourses / enhanceExtractedData |
| 修改 `src/utils/jwxtParser.ts` | 解析层：移除空结果伪造兜底；HTML 解析识别「不排课」行、移除课程伪造兜底；新增 `isUnscheduledCourse` 判定，`convertToCourses` 使用 |
| 修改 `src/components/JwxtWebView.tsx` | `EXTRACT_DATA_SCRIPT` 注入脚本同步：识别「不排课」行、移除课程伪造兜底 |
| 修改 `src/components/CourseImportWizard.tsx` | UI：课程拆分 importable/skipped，预览区下方渲染「以下课程不排课，不会导入课表」列表 |

---

### 任务 1：行为验证脚本（TDD 红灯——复现 bug）

**文件：**
- 创建：`scripts/verify-jwxt-parser.ts`

- [ ] **步骤 1：编写验证脚本**

```ts
// 教务解析器行为验证脚本（Node 环境下运行，无需启动 App）
// 运行方式：npx tsx scripts/verify-jwxt-parser.ts
// 说明：jwxtParser 顶层 import 'react-native-get-random-values' 仅 RN 环境需要，
// 在 Node 下通过 Module._load 打桩跳过；Node 20 自带 globalThis.crypto，uuid 可正常工作。
import Module from 'module';

const origLoad = (Module as any)._load;
(Module as any)._load = function (request: string, parent: any, isMain: boolean) {
  if (request === 'react-native-get-random-values') return {};
  return origLoad.call(this, request, parent, isMain);
};

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

const BUPOIKE_HTML = [
  '<table>',
  '<tr class="lessonInfo" data-semester="362">',
  '<td class="courseInfo" data-course="科研训练与学科竞赛[U05P61001]">',
  '<p class="showSchedules">科研训练与学科竞赛</p>',
  '<p>U05P61001<i class="operator"></i>实践实训<i class="operator"></i>机电学院</p>',
  '<p><span class="span-gap">学分(2)</span><span class="span-gap">总课时(32)</span><span class="span-gap">已安排课时(0)</span></p>',
  '<p>必修&nbsp;&nbsp;其他</p>',
  '<p>授课教师：冯硕(2024072007)</p>',
  '</td>',
  '<td class="text"><p class="inner">2024级学生</p></td>',
  '<td>不排课</td>',
  '<td><div class="remark">备注：<br></div></td>',
  '</tr>',
  '</table>',
].join('');

const REAL_ROW_HTML = [
  '<table>',
  '<tr class="lessonInfo" data-semester="362">',
  '<td class="courseInfo" data-course="机械设计Ⅰ[U05M11010]">',
  '<p class="showSchedules">机械设计Ⅰ</p>',
  '<p>U05M11010<i class="operator"></i>理论课<i class="operator"></i>机电学院</p>',
  '<p><span class="span-gap">学分(3.5)</span><span class="span-gap">总课时(56)</span><span class="span-gap">已安排课时(56)</span></p>',
  '<p>必修&nbsp;&nbsp;考试</p>',
  '<p>授课教师：李洲洋(2008010095)</p>',
  '</td>',
  '<td class="text"><p class="inner">2024级学生</p></td>',
  '<td>1-14周 周一 第七节~第八节 友谊校区 诚字楼210（李洲洋）</td>',
  '<td><div class="remark">备注：<br></div></td>',
  '</tr>',
  '</table>',
].join('');

async function main() {
  const { parseScheduleText, parseJwxtHtml } = await import('@/utils/jwxtParser');

  console.log('== parseScheduleText ==');
  check('空文本返回空数组', parseScheduleText(''), []);
  check('不排课拼接文本返回空数组', parseScheduleText('不排课 备注：'), []);
  check(
    '正常课表文本解析',
    parseScheduleText('1-14周 周一 第七节~第八节'),
    [{ weekRange: '1-14', repeatRule: '', dayOfWeek: 1, classSections: [7, 8] }],
  );

  console.log('== parseJwxtHtml ==');
  const bupaike = parseJwxtHtml(BUPOIKE_HTML);
  check('不排课行课程数', bupaike.courses.length, 1);
  check('不排课行课程名', bupaike.courses[0]?.name, '科研训练与学科竞赛');
  check('不排课行课程代码', bupaike.courses[0]?.code, 'U05P61001');
  check('不排课行 scheduleText 为空', bupaike.courses[0]?.scheduleText, '');

  const real = parseJwxtHtml(REAL_ROW_HTML);
  check('真实行课程数', real.courses.length, 1);
  check('真实行 scheduleText 含时间', real.courses[0]?.scheduleText.includes('1-14周'), true);
  check('真实行 location 含校区', real.courses[0]?.location?.includes('友谊校区'), true);

  const empty = parseJwxtHtml('<div><h3>机械设计Ⅰ</h3></div>');
  check('无 lessonInfo 行时不伪造课程', empty.courses.length, 0);

  if (failures > 0) {
    console.log(`\n${failures} 个用例失败`);
    process.exit(1);
  }
  console.log('\n全部用例通过');
}

void main();
```

- [ ] **步骤 2：运行脚本，确认红灯（复现 bug）**

运行：`npx tsx scripts/verify-jwxt-parser.ts`
预期：FAIL 的用例包括「空文本返回空数组」「不排课拼接文本返回空数组」「不排课行 scheduleText 为空」「无 lessonInfo 行时不伪造课程」（当前 `parseScheduleText` 伪造 `1-16周 周一 第1节`、td 兜底拼出「不排课 备注：」、整页兜底伪造课程）。退出码 1。

- [ ] **步骤 3：typecheck 通过**

运行：`npm run typecheck`
预期：通过（脚本只引用现有导出，`@types/node` 已随 expo 安装）。

- [ ] **步骤 4：Commit**

```bash
git add scripts/verify-jwxt-parser.ts
git commit -m "test(jwxt): 新增教务解析器行为验证脚本（复现不排课伪造课节）" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### 任务 2：parseScheduleText 移除伪造兜底

**文件：**
- 修改：`src/utils/jwxtParser.ts:153-200`

- [ ] **步骤 1：修改空文本分支**

将 `src/utils/jwxtParser.ts` 中：

```ts
export function parseScheduleText(scheduleText: string): TimeSlot[] {
  if (!scheduleText) {
    return [{ weekRange: '1-16', repeatRule: RepeatRule.ALL, dayOfWeek: 1, classSections: [1] }];
  }
```

改为：

```ts
export function parseScheduleText(scheduleText: string): TimeSlot[] {
  if (!scheduleText) {
    return [];
  }
```

- [ ] **步骤 2：删除解析失败伪造块**

删除以下整块（连同其上下的空行合并）：

```ts
  if (slots.length === 0) {
    return [{ weekRange: '1-16', repeatRule: RepeatRule.ALL, dayOfWeek: 1, classSections: [1] }];
  }

  return mergeSlots(slots);
```

替换为：

```ts
  return mergeSlots(slots);
```

- [ ] **步骤 3：运行脚本，确认 parseScheduleText 用例转绿**

运行：`npx tsx scripts/verify-jwxt-parser.ts`
预期：「空文本返回空数组」「不排课拼接文本返回空数组」「正常课表文本解析」PASS；parseJwxtHtml 相关红灯仍在（后续任务处理）。

- [ ] **步骤 4：typecheck 通过**

运行：`npm run typecheck`
预期：通过。注意 `RepeatRule` 仍被 `parseRepeatRule` 使用，import 不会被 tree-shake 报错。

- [ ] **步骤 5：Commit**

```bash
git add src/utils/jwxtParser.ts
git commit -m "fix(jwxt): parseScheduleText 空文本不再伪造默认课节" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### 任务 3：isUnscheduledCourse 判定 + convertToCourses 使用

**文件：**
- 修改：`src/utils/jwxtParser.ts`（新增 helper、修改 `convertToCourses`）
- 修改：`scripts/verify-jwxt-parser.ts`（新增用例）

- [ ] **步骤 1：编写失败的用例**

在 `scripts/verify-jwxt-parser.ts` 的 `main()` 中，`console.log('== parseJwxtHtml ==');` 之前插入：

```ts
  console.log('== isUnscheduledCourse / convertToCourses / enhanceExtractedData ==');
  const { isUnscheduledCourse, convertToCourses, enhanceExtractedData } = await import('@/utils/jwxtParser');
  check('空 scheduleText 判定为不排课', isUnscheduledCourse({ name: 'x', scheduleText: '' }), true);
  check('不排课拼接文本判定为不排课', isUnscheduledCourse({ name: 'x', scheduleText: '不排课 备注：' }), true);
  check(
    '正常课表文本判定为排课',
    isUnscheduledCourse({ name: 'x', scheduleText: '1-14周 周一 第七节~第八节' }),
    false,
  );
  const converted = convertToCourses(
    [
      { name: '科研训练与学科竞赛', code: 'U05P61001', scheduleText: '' },
      { name: '机械设计Ⅰ', code: 'U05M11010', scheduleText: '1-14周 周一 第七节~第八节' },
    ],
    'sem1',
  );
  check('convertToCourses 跳过不排课课程', converted.length, 1);
  check('convertToCourses 保留排课课程', converted[0]?.name, '机械设计Ⅰ');
  const enhanced = enhanceExtractedData({
    semesters: [],
    courses: [{ name: '科研训练与学科竞赛', scheduleText: '' }],
  });
  check('enhanceExtractedData 保留不排课课程供 UI 展示', enhanced.courses.length, 1);
```

- [ ] **步骤 2：运行脚本，确认失败**

运行：`npx tsx scripts/verify-jwxt-parser.ts`
预期：抛出 `TypeError: isUnscheduledCourse is not a function`（helper 尚未实现）。这是预期红灯。

- [ ] **步骤 3：实现 helper**

在 `src/utils/jwxtParser.ts` 中 `parseScheduleText` 函数结束后（`mergeSlots` 之前或之后均可，建议紧跟 `parseScheduleText` 后）新增：

```ts
export function isUnscheduledCourse(raw: RawCourse): boolean {
  return parseScheduleText(raw.scheduleText).length === 0;
}
```

- [ ] **步骤 4：convertToCourses 改用 helper**

将 `src/utils/jwxtParser.ts` `convertToCourses` 中：

```ts
  for (const raw of filtered) {
    const timeSlots = parseScheduleText(raw.scheduleText);
    if (timeSlots.length === 0) {
      continue;
    }
```

改为：

```ts
  for (const raw of filtered) {
    if (isUnscheduledCourse(raw)) {
      continue;
    }

    const timeSlots = parseScheduleText(raw.scheduleText);
```

- [ ] **步骤 5：运行脚本，确认新用例转绿**

运行：`npx tsx scripts/verify-jwxt-parser.ts`
预期：新用例全部 PASS；parseJwxtHtml 相关红灯仍在。

- [ ] **步骤 6：typecheck 通过**

运行：`npm run typecheck`
预期：通过。

- [ ] **步骤 7：Commit**

```bash
git add src/utils/jwxtParser.ts scripts/verify-jwxt-parser.ts
git commit -m "feat(jwxt): 新增 isUnscheduledCourse 判定并用于 convertToCourses" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### 任务 4：parseJwxtHtml 识别「不排课」行 + 移除课程伪造兜底

**文件：**
- 修改：`src/utils/jwxtParser.ts`（`parseJwxtHtml` 内两处）

- [ ] **步骤 1：td 循环识别「不排课」**

将 `src/utils/jwxtParser.ts` `parseJwxtHtml` 中：

```ts
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let tdMatch;
    let scheduleText = '';
    let location = '';
    while ((tdMatch = tdRe.exec(trContent)) !== null) {
      const tdText = tdMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      if (tdText.includes('第') && (tdText.includes('节') || tdText.includes('周'))) {
        scheduleText = tdText;
      }
```

改为：

```ts
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let tdMatch;
    let scheduleText = '';
    let location = '';
    let noSchedule = false;
    while ((tdMatch = tdRe.exec(trContent)) !== null) {
      const tdText = tdMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      if (tdText === '不排课') {
        noSchedule = true;
      }
      if (tdText.includes('第') && (tdText.includes('节') || tdText.includes('周'))) {
        scheduleText = tdText;
      }
```

- [ ] **步骤 2：td 兜底跳过「不排课」行**

将同一函数中：

```ts
    if (!scheduleText) {
      const allTds = [...trContent.matchAll(tdRe)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
      scheduleText = allTds.slice(-2).join(' ') || trContent.replace(/<[^>]+>/g, '');
    }
```

改为：

```ts
    if (!scheduleText && !noSchedule) {
      const allTds = [...trContent.matchAll(tdRe)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
      scheduleText = allTds.slice(-2).join(' ') || trContent.replace(/<[^>]+>/g, '');
    }
```

- [ ] **步骤 3：删除整页解析失败的课程伪造块**

删除 `parseJwxtHtml` 末尾整个块：

```ts
  if (courses.length === 0) {
    const h3Re = /<h3[^>]*>([^<]+)<\/h3>/g;
    const showSchedRe = /class=["'][^"']*showSchedules[^"']*["'][^>]*>([^<]+)/g;
    const foundNames = new Set<string>();
    let m;
    while ((m = h3Re.exec(html)) !== null) {
      if (m[1].trim().length >= 2) foundNames.add(m[1].trim());
    }
    while ((m = showSchedRe.exec(html)) !== null) {
      if (m[1].trim().length >= 2) foundNames.add(m[1].trim());
    }
    for (const name of foundNames) {
      courses.push({
        name,
        scheduleText: '1-16周 周一 第1-2节',
      });
    }
  }

  return { semesters, courses };
```

替换为：

```ts
  return { semesters, courses };
```

- [ ] **步骤 4：运行脚本，确认全部转绿**

运行：`npx tsx scripts/verify-jwxt-parser.ts`
预期：全部用例 PASS（「不排课行 scheduleText 为空」「无 lessonInfo 行时不伪造课程」转绿），退出码 0。

- [ ] **步骤 5：typecheck 通过**

运行：`npm run typecheck`
预期：通过。

- [ ] **步骤 6：Commit**

```bash
git add src/utils/jwxtParser.ts
git commit -m "fix(jwxt): HTML 解析识别不排课行并移除伪造课程兜底" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### 任务 5：JwxtWebView 提取脚本同步修改

**文件：**
- 修改：`src/components/JwxtWebView.tsx`（`EXTRACT_DATA_SCRIPT` 模板字符串内）

- [ ] **步骤 1：td 循环识别「不排课」**

将 `EXTRACT_DATA_SCRIPT` 中：

```js
        var scheduleText = '';
        var location = '';
        var tds = tr.querySelectorAll('td');
        for (var m = 0; m < tds.length; m++) {
          var tdText = (tds[m].textContent || '').replace(/\\s+/g, ' ').trim();
          if (tdText.indexOf('第') >= 0 && (tdText.indexOf('节') >= 0 || tdText.indexOf('周') >= 0)) {
            scheduleText = tdText;
          }
```

改为：

```js
        var scheduleText = '';
        var location = '';
        var noSchedule = false;
        var tds = tr.querySelectorAll('td');
        for (var m = 0; m < tds.length; m++) {
          var tdText = (tds[m].textContent || '').replace(/\\s+/g, ' ').trim();
          if (tdText === '不排课') {
            noSchedule = true;
          }
          if (tdText.indexOf('第') >= 0 && (tdText.indexOf('节') >= 0 || tdText.indexOf('周') >= 0)) {
            scheduleText = tdText;
          }
```

- [ ] **步骤 2：td 兜底跳过「不排课」行**

将 `EXTRACT_DATA_SCRIPT` 中：

```js
        if (!scheduleText) {
          var allTds = [];
          for (var n = 0; n < tds.length; n++) {
            allTds.push((tds[n].textContent || '').trim());
          }
          scheduleText = allTds.slice(-2).join(' ') || tr.innerHTML.replace(/<[^>]+>/g, '');
        }
```

改为：

```js
        if (!scheduleText && !noSchedule) {
          var allTds = [];
          for (var n = 0; n < tds.length; n++) {
            allTds.push((tds[n].textContent || '').trim());
          }
          scheduleText = allTds.slice(-2).join(' ') || tr.innerHTML.replace(/<[^>]+>/g, '');
        }
```

- [ ] **步骤 3：删除整页解析失败的课程伪造块**

删除 `EXTRACT_DATA_SCRIPT` 中整个块：

```js
      if (courses.length === 0) {
        var h3Regex = /<h3[^>]*>([^<]+)<\\/h3>/g;
        var showSchedRegex = /class=["'][^"']*showSchedules[^"']*["'][^>]*>([^<]+)/g;
        var found = {};
        var match;
        while ((match = h3Regex.exec(targetDoc.body.innerHTML)) !== null) {
          if (match[1].trim().length >= 2) found[match[1].trim()] = true;
        }
        while ((match = showSchedRegex.exec(targetDoc.body.innerHTML)) !== null) {
          if (match[1].trim().length >= 2) found[match[1].trim()] = true;
        }
        for (var fname in found) {
          courses.push({ name: fname, scheduleText: '1-16周 周一 第1-2节' });
        }
      }
```

（注意删除后 `var result = JSON.stringify(...)` 前不留悬空空行。）

- [ ] **步骤 4：typecheck 通过**

运行：`npm run typecheck`
预期：通过。注入脚本是字符串内容，typecheck 不执行它——本任务验证方式为：与任务 4 的 TS 解析器逐行核对逻辑一致性（改动一一对应），并在任务 7 由用户真机验证。

- [ ] **步骤 5：Commit**

```bash
git add src/components/JwxtWebView.tsx
git commit -m "fix(import): WebView 提取脚本识别不排课行并移除伪造兜底" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### 任务 6：CourseImportWizard 显示不排课课程提示区

**文件：**
- 修改：`src/components/CourseImportWizard.tsx`

- [ ] **步骤 1：引入 isUnscheduledCourse**

将导入行：

```ts
import { enhanceExtractedData, convertToCourses, parseScheduleText, computeMaxWeekAndSection, buildDefaultSectionTimes } from '@/utils/jwxtParser';
```

改为：

```ts
import { enhanceExtractedData, convertToCourses, parseScheduleText, computeMaxWeekAndSection, buildDefaultSectionTimes, isUnscheduledCourse } from '@/utils/jwxtParser';
```

- [ ] **步骤 2：课程拆分**

将 `src/components/CourseImportWizard.tsx` 中：

```ts
  const filteredPreview = parsedData
    ? parsedData.courses.filter((c) => !selectedDataSemester || c.dataSemester === selectedDataSemester)
    : [];
```

改为：

```ts
  const filteredPreview = parsedData
    ? parsedData.courses.filter((c) => !selectedDataSemester || c.dataSemester === selectedDataSemester)
    : [];
  const importableCourses = filteredPreview.filter((c) => !isUnscheduledCourse(c));
  const skippedCourses = filteredPreview.filter((c) => isUnscheduledCourse(c));
```

- [ ] **步骤 3：预览区改用 importableCourses**

将预览标题与列表（`src/components/CourseImportWizard.tsx` 中「预览」区块）：

```tsx
                预览（{filteredPreview.length} 门）
              </Text>
              {filteredPreview.slice(0, 5).map((c, i) => (
```

改为：

```tsx
                预览（{importableCourses.length} 门）
              </Text>
              {importableCourses.slice(0, 5).map((c, i) => (
```

将「还有 N 门」块：

```tsx
              {filteredPreview.length > 5 ? (
                <Text style={[styles.moreText, { color: dt.colors.textSecondary }]}>...还有 {filteredPreview.length - 5} 门课程</Text>
              ) : null}
```

改为：

```tsx
              {importableCourses.length > 5 ? (
                <Text style={[styles.moreText, { color: dt.colors.textSecondary }]}>...还有 {importableCourses.length - 5} 门课程</Text>
              ) : null}
```

- [ ] **步骤 4：新增不排课提示区**

在上述「还有 N 门」块之后、`<View style={styles.actions}>` 之前插入：

```tsx
              {skippedCourses.length > 0 ? (
                <View style={{ marginTop: 12 }}>
                  <Text
                    style={{
                      fontSize: dt.fontSize.body,
                      fontWeight: dt.fontWeight.subheading,
                      color: dt.colors.text,
                      marginBottom: 8,
                    }}
                  >
                    以下课程不排课，不会导入课表（{skippedCourses.length} 门）
                  </Text>
                  {skippedCourses.map((c, i) => (
                    <View
                      key={i}
                      style={[styles.previewItem, { borderBottomColor: dt.colors.surfaceAlt }]}
                    >
                      <Text
                        style={[styles.previewName, { color: dt.colors.textSecondary }]}
                        numberOfLines={1}
                      >
                        {c.name}
                        {c.code ? `（${c.code}）` : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
```

- [ ] **步骤 5：typecheck 通过**

运行：`npm run typecheck`
预期：通过。

- [ ] **步骤 6：Commit**

```bash
git add src/components/CourseImportWizard.tsx
git commit -m "feat(import): 选择学期界面显示不排课课程提示区" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### 任务 7：全量验证与收尾

- [ ] **步骤 1：运行行为验证脚本**

运行：`npx tsx scripts/verify-jwxt-parser.ts`
预期：`全部用例通过`，退出码 0。

- [ ] **步骤 2：typecheck**

运行：`npm run typecheck`
预期：通过，无输出。

- [ ] **步骤 3：lint**

运行：`npm run lint`
预期：无新增错误（如出现与本次改动无关的历史警告，如实记录，不处理）。

- [ ] **步骤 4：核对工作区**

运行：`git status` 与 `git log --oneline -8`
预期：任务 1-6 的 commit 全部在列；除用户原有的 `.gitignore` 修改外无未提交变更（如有遗漏变更，补一次 commit）。

- [ ] **步骤 5：真机手动验证（可选，交给用户）**

在真机上走一遍导入流程：登录教务系统 → 提取 → 选择学期界面应显示「以下课程不排课，不会导入课表（N 门）」及课程名 → 导入后课表网格与管理列表均无这些课程。
