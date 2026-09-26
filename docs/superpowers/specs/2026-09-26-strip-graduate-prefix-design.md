# 去除研究生课程名「研究生」前缀设计

日期：2026-09-26
状态：已批准

## 背景与问题

研究生用户从教务系统导入课表后，每门课程名称前都带有「研究生」三个字（如「研究生矩阵论」「研究生文献检索与科技论文写作」）。用户反馈希望删除该前缀。

开发者无法直接查看研究生教务系统原始数据，依据用户导出的备份数据（`docs/soaring-schedule-2026-09-26.json`）分析：

- 9 门课全部以「研究生」开头；
- 其中一门为双重前缀「研究生研究生科技英语」——说明教务系统统一给研究生课程名前置一个「研究生」标记，而该课程真实名称本身即含「研究生」（研究生科技英语）。

因此正确的剥离规则是：**仅当名称以「研究生」开头时，剥离恰好一个前缀**。剥离后「研究生研究生科技英语」→「研究生科技英语」，其余课程各剥一个，本科生课程（无此前缀）完全不受影响。

## 目标

解析完成后，课程名剥离恰好一个「研究生」前缀；导入向导预览即显示干净名称。

## 决策记录

| 决策点 | 选择 | 备选（已排除） |
|--------|------|----------------|
| 剥离位置 | `enhanceExtractedData`（解析完成后的既有清洗步骤） | 提取脚本 `EXTRACT_DATA_SCRIPT`（嵌入字符串无法 Node 测试，HTML 回退路径不一致）；`convertToCourses`（向导预览直接读 `parsedData.courses`，预览与导入结果不一致） |
| 剥离规则 | 恰好一个前导「研究生」 | 全部移除（「研究生科技英语」会被误剥成「科技英语」）；去掉任意位置出现（课名中段出现属真实内容） |
| 已有脏数据 | 不迁移，用户重新导入并勾选「覆盖该学期现有课程」 | 一次性自动迁移（可能误伤手动创建的课程，如「研究生组会」）；设置页手动清理按钮（新增 UI 与维护成本） |

## 解析层变更

`src/utils/jwxtParser.ts`：

```ts
const GRADUATE_PREFIX = '研究生';

export function stripGraduatePrefix(name: string): string {
  return name.startsWith(GRADUATE_PREFIX) ? name.slice(GRADUATE_PREFIX.length) : name;
}
```

- `enhanceExtractedData` 遍历课程时，`name` 替换为 `stripGraduatePrefix(name)`，与既有清洗逻辑（网课过滤、教师截断）并列。
- 该函数为导入向导唯一后处理收口：`CourseImportWizard.handleDataExtracted` 在展示预览之前调用，预览即显示干净名称。

## 边界情况

- 名称恰好为「研究生」→ 剥离为空字符串，接受此行为（实际不存在此类课程，空名在预览中显示为空）。
- 名称以「研究生」开头但真实课名即以此开头 → 系统前缀与真实课名各占一个，剥离一个后正确保留（「研究生研究生科技英语」→「研究生科技英语」）。
- 本科课程名称不以前缀开头 → 原样返回，无影响。

## 测试

`scripts/verify-jwxt-parser.ts` 增加用例（Node 下运行）：

- `stripGraduatePrefix('研究生矩阵论')` → `'矩阵论'`
- `stripGraduatePrefix('研究生研究生科技英语')` → `'研究生科技英语'`（只剥一个，关键用例）
- `stripGraduatePrefix('机械设计Ⅰ')` → `'机械设计Ⅰ'`
- `stripGraduatePrefix('研究生')` → `''`

## 文档

CLAUDE.md「Course Import Flow」一节补充一句：研究生课名统一前缀在 `enhanceExtractedData` 中剥离。

## 验证

- `npm run verify:jwxt`
- `npm run typecheck`
- `npm run lint`
