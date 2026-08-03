# 翱翔课表 (Soaring Schedule)

西北工业大学课程表管理应用，基于 React Native + Expo SDK 57 构建，仅支持 Android 平台，完全离线运行。

<p align="center">
  <strong>Expo 57</strong> · <strong>RN 0.86</strong> · <strong>React 19.2</strong> · <strong>TypeScript 6.0</strong> · <strong>React Native Paper 5</strong>
</p>

---

## 功能

| Tab | 功能 |
|-----|------|
| **课表** | 周视图网格（7 天 / 3 天切换），课程块跨课节合并，点击详情弹窗（含编辑入口），月历视图，周切换 / 返回本周 |
| **课表管理** | 学期 CRUD，课程 CRUD（多时间段、周范围选择、课节选择器、8 色预设、冲突检测），按教室分组合并地点展示 |
| **设置** | 教务系统一键导入（NWPU WebView 自动抓取）、深色模式 / 主题色切换、数据导出 / 导入（JSON + 版本号）、格式化重置 |

### Android Widget

支持两种尺寸的桌面小组件，均支持深色/浅色双主题、点击刷新、数据变化自动更新、整点闹钟刷新。

| Widget | 尺寸 | 内容 |
|--------|------|------|
| **大 Widget**（4×3） | 250×180dp | 今明两天双栏布局，全量课程列表，可上下滚动，中间竖线分隔 |
| **小 Widget**（3×2） | 180×110dp | 左侧竖排「今日课程」标题，显示当天后续 3 门课 + 溢出计数 |

每条课程显示：颜色标识、课程名、课节范围 + 时间、地点。

---

## 技术栈

```
React Native 0.86    Expo SDK 57         TypeScript 6.0 (strict)
Zustand 5            AsyncStorage 2      date-fns 4
React Native Paper 5 react-native-webview react-native-android-widget
React Compiler       Expo Router 4       React Native Reanimated 4
```

此外项目还启用了 Expo Router **typed routes** 和 **React Compiler**（`experiments.reactCompiler`）。

---

## 快速开始

### 前置条件

- Node.js ≥ 18
- npm ≥ 9
- Android 设备或模拟器

### 安装 & 运行

```bash
git clone <repo-url>
cd soaring-schedule-remake
npm install
npx expo start          # 开发服务器（Expo Go / 开发构建）
```

按 `a` 启动 Android 构建，或扫码运行。WSL2 用户可使用 `npm run wsl2`（自动启用 tunnel 模式）。

### EAS Build

```bash
eas build --profile development   # 开发客户端 APK
eas build --profile preview       # 内部测试 APK
eas build --profile production    # 正式发布 AAB
```

详见 `eas.json`。

### 验证（无需设备）

```bash
npm run typecheck         # TypeScript 类型检查
npm run lint              # ESLint 代码规范检查
```

---

## 项目结构

```
app/                        Expo Router 文件路由（3 Tab）
├── _layout.tsx             根布局（Tab 导航 + PaperProvider + ThemeProvider + Widget 同步）
├── index.tsx               Tab1 课表（周视图 + 月历切换）
├── schedule.tsx            Tab2 课表管理（课程/学期 CRUD）
└── settings.tsx            Tab3 设置（导入/主题/备份/格式化）

src/
├── types/index.ts          全部类型定义（Semester, Course, TimeSlot, RepeatRule 等）
├── stores/                 Zustand 状态管理
│   ├── courseStore.ts      课程 CRUD + 冲突检测 + 学期裁剪
│   └── settingsStore.ts    学期 CRUD + 主题/深色模式 + 一键清空
├── design/                 三层设计 Token 系统
│   ├── colors.ts           语义化颜色（light/dark）+ 课程色 + 导入预览色
│   ├── typography.ts       字号 / 字重 / 行高
│   ├── spacing.ts          间距 / 圆角 / 触控目标 / 图标尺寸
│   └── tokens.ts           Token 工厂 + useTokens Hook
├── hooks/
│   ├── useDesignTokens.ts  设计 Token Hook（响应深色模式切换）
│   ├── useWidgetDataSync.ts Widget 数据同步 Hook
│   ├── useSnackbar.ts      全局 Snackbar（Zustand store）
│   ├── useAppHydrated.ts   Store 水合完成状态
│   └── useReducedMotion.ts 系统「减弱动态效果」检测
├── utils/                  工具模块
│   ├── scheduleDate.ts     日期计算（学期匹配、周数、周范围、重复规则）
│   ├── timeConflict.ts     时间冲突检测（日重叠 + 周交集 + 课节交集）
│   ├── jwxtParser.ts       教务系统解析（10 种文本格式 + HTML 备用解析）
│   ├── widgetData.ts       Widget 数据构建与持久化
│   ├── dataBackup.ts       JSON 导出/导入（版本号验证）
│   ├── locationFormat.ts   教务系统地点格式化（按教室分组，教室前置）
│   └── color.ts            W3C 相对亮度对比色计算
└── components/             17 个 UI 组件（全部基于 React Native Paper）
    ├── CourseSchedule.tsx   课表网格视图（周视图/3天切换）
    ├── CalendarView.tsx     月历视图
    ├── CourseDetailSheet.tsx 课程详情底部弹窗（含编辑入口）
    ├── CourseForm.tsx       课程编辑表单
    ├── CourseList.tsx       课程列表（入场动画）
    ├── CourseImportWizard.tsx 教务系统导入向导（2 步状态机）
    ├── JwxtWebView.tsx      NWPU 教务系统 WebView 抓取
    ├── SemesterForm.tsx     学期编辑表单
    ├── TimeTableEditor.tsx  课节时间表编辑器（暂未使用）
    ├── AppTextField.tsx     增强文本输入框
    ├── FormModal.tsx        表单模态框
    ├── ScreenContainer.tsx  页面容器
    ├── ScreenHeader.tsx     页面标题栏
    ├── EmptyState.tsx       空状态占位
    ├── Skeleton.tsx         骨架屏加载
    ├── Icon.tsx             图标映射（Phosphor Icons 统一入口）
    └── ThemeProvider.tsx    主题提供者（Paper 主题 + Snackbar 宿主）

widgets/                    Android Widget
├── CourseWidget.tsx        桌面小组件渲染（大/小两种变体）
└── widget-task-handler.tsx Widget 生命周期处理

plugins/                    Expo Config Plugins
├── withHonorWidget.js      荣耀设备 Widget 兼容
├── withWidgetConfig.js     AlarmManager 整点刷新注入
└── templates/
    └── WidgetProvider.java  AlarmManager 实现模板
```

---

## 设计 Token 系统

项目使用三层设计 Token，通过 `useDesignTokens()` 消费：

- **colors.ts** — `lightColors` / `darkColors`（语义 Token：`bg`、`surface`、`primary`、`text`、`textSecondary`、`textMuted`、`border`、`destructive` 等），以及 `courseColors`（8 色课程分配）和 `importColors`（10 色导入预览）
- **typography.ts** — `fontSize`（6 档）、`fontWeight`（6 档）、`lineHeight`（6 档）
- **spacing.ts** — `spacing`（xs → 4xl）、`borderRadius`（sm → pill）、`touchTarget`（48）、`iconSize`（sm → xl）

`useDesignTokens()` 根据 settingsStore 中的 `darkMode` 自动切换 light/dark 调色板。组件应使用此 Hook 而非直接引入颜色常量。

图标统一使用 `src/components/Icon.tsx`，封装了约 30 个 Phosphor Icons 名称映射，**禁止**直接引入 `phosphor-react-native` 或 `@expo/vector-icons`。

---

## 数据流

```
AsyncStorage
  ├── courseStore      → "soaring-schedule-courses"
  ├── settingsStore    → "soaring-schedule-settings"
  ├── widget data      → "@soaring_schedule:widget_data"
  └── widget dark mode → "@soaring_schedule:dark_mode"

settingsStore ──deleteSemester()────→ courseStore.deleteCoursesBySemester()
settingsStore ──updateSemester()────→ courseStore.adjustCoursesForSemester()（周/节缩减时裁剪）
settingsStore ──formatData()────────→ courseStore.clearAllCourses()
```

两个 Zustand store，**单向耦合**（settingsStore → courseStore，不可反向）。Widget 数据独立于 App 的 darkMode 设置，使用单独的 AsyncStorage key。

---

## 教务系统导入流程

`CourseImportWizard.tsx` 为 2 步状态机：

1. **`JwxtWebView.tsx`** — 加载 `https://ecampus.nwpu.edu.cn/`，注入 JS 抓取 iframe/table 课程数据，通过 `postMessage` 回传
2. **`jwxtParser.ts`** — 10 种正则模式 + HTML table 备用解析器解析原始文本
3. 用户选择/创建目标学期，预览解析结果（使用 `importColors` 配色），确认导入

导入后直接更新 Zustand store，无需重启应用。

---

## License

MIT
