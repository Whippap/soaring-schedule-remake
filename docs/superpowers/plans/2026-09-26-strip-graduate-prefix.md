# 去除研究生课程名「研究生」前缀 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 教务导入解析完成后，剥离研究生课程名恰好一个前导「研究生」前缀。

**架构：** 在 `src/utils/jwxtParser.ts` 新增纯函数 `stripGraduatePrefix`，并接入既有清洗收口 `enhanceExtractedData`（导入向导预览前的唯一后处理入口）。Node 验证脚本 `scripts/verify-jwxt-parser.ts` 增加用例，TDD 流程：先写失败测试再实现。

**技术栈：** TypeScript（无运行时依赖变更）、tsx 验证脚本。

**规格：** `docs/superpowers/specs/2026-09-26-strip-graduate-prefix-design.md`

---

### 任务 1：TDD 实现前缀剥离

**文件：**
- 修改：`src/utils/jwxtParser.ts:308`（`enhanceExtractedData` 上方新增函数，函数内接入）
- 测试：`scripts/verify-jwxt-parser.ts:63-69`（导入解构）、`:97-101`（enhanced 检查附近新增段落）

- [ ] **步骤 1：编写失败测试**

修改 `scripts/verify-jwxt-parser.ts` 第 63-69 行的导入解构，加入 `stripGraduatePrefix`：

```ts
  const {
    parseScheduleText,
    parseJwxtHtml,
    isUnscheduledCourse,
    convertToCourses,
    enhanceExtractedData,
    stripGraduatePrefix,
  } = await import('@/utils/jwxtParser');
```

在第 101 行（`enhanceExtractedData 保留不排课课程供 UI 展示` 检查之后）新增段落：

```ts
  console.log('== stripGraduatePrefix ==');
  check('研究生前缀剥离', stripGraduatePrefix('研究生矩阵论'), '矩阵论');
  check('双重前缀只剥一个', stripGraduatePrefix('研究生研究生科技英语'), '研究生科技英语');
  check('无前缀原样返回', stripGraduatePrefix('机械设计Ⅰ'), '机械设计Ⅰ');
  check('整名即前缀剥离为空', stripGraduatePrefix('研究生'), '');
  const enhancedGrad = enhanceExtractedData({
    semesters: [],
    courses: [{ name: '研究生矩阵论', scheduleText: '1-14周 周一 第七节~第八节' }],
  });
  check('enhanceExtractedData 剥离研究生前缀', enhancedGrad.courses[0]?.name, '矩阵论');
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm run verify:jwxt`
预期：FAIL，首个 `stripGraduatePrefix(...)` 调用抛出 `TypeError: stripGraduatePrefix is not a function`（模块未导出该函数），脚本以非零退出码结束。

- [ ] **步骤 3：编写最少实现代码**

修改 `src/utils/jwxtParser.ts`，在 `enhanceExtractedData`（约第 308 行）上方新增：

```ts
const GRADUATE_PREFIX = '研究生';

export function stripGraduatePrefix(name: string): string {
  return name.startsWith(GRADUATE_PREFIX) ? name.slice(GRADUATE_PREFIX.length) : name;
}
```

在 `enhanceExtractedData` 中，把第 335 行的

```ts
    enhanced.push({ ...course, location, teacher });
```

改为：

```ts
    enhanced.push({ ...course, name: stripGraduatePrefix(course.name), location, teacher });
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npm run verify:jwxt`
预期：全部 PASS，末尾输出 `全部用例通过`。

- [ ] **步骤 5：Commit**

```bash
git add src/utils/jwxtParser.ts scripts/verify-jwxt-parser.ts
git commit -m "feat(import): 剥离研究生课程名统一前缀"
```

---

### 任务 2：同步 CLAUDE.md 文档

**文件：**
- 修改：`CLAUDE.md`「Course Import Flow」一节

- [ ] **步骤 1：补充导入流程说明**

把「Course Import Flow」一节的第 2 条从：

```markdown
2. **`jwxtParser.ts`** — parses the raw text with 10 regex patterns plus an HTML table fallback parser.
```

改为：

```markdown
2. **`jwxtParser.ts`** — parses the raw text with 10 regex patterns plus an HTML table fallback parser. `enhanceExtractedData` 清洗时剥离研究生课程名统一前缀「研究生」（恰好一个，`stripGraduatePrefix`）。
```

- [ ] **步骤 2：Commit**

```bash
git add CLAUDE.md
git commit -m "docs: 记录研究生课程名前缀剥离流程"
```

---

### 任务 3：全量验证

**文件：** 无（如有修复，涉及 `src/utils/jwxtParser.ts` 或 `scripts/verify-jwxt-parser.ts`）

- [ ] **步骤 1：运行全部验证命令**

依次运行，全部通过：

```bash
npm run verify:jwxt     # 预期:全部用例通过
npm run typecheck       # 预期:无错误输出
npm run lint            # 预期:无 error
```

- [ ] **步骤 2：如有失败则修复**

失败时用 systematic-debugging 技能定位根因并修复，修复后重跑步骤 1，并将修改追加 commit：

```bash
git add -u && git commit -m "fix: 修复验证问题"
```

预期：本轮为纯逻辑 + 文档改动，无 lint/类型问题。
