# 翱翔课表 (Soaring Schedule)

西北工业大学课程表管理应用，基于 React Native + Expo SDK 54 构建，仅支持 Android 平台，完全离线运行。

<p align="center">
  <strong>Expo 54</strong> · <strong>RN 0.81</strong> · <strong>TypeScript</strong> · <strong>React Native Paper</strong>
</p>

---

## 功能

| Tab | 功能 |
|-----|------|
| **课表** | 周视图网格（7天/3天切换），课程块跨课节合并，点击详情弹窗，月历视图，周切换/返回本周 |
| **课表管理** | 学期 CRUD，课程 CRUD（多时间段、周数网格、课节选择器、8 色预设、冲突检测） |
| **设置** | 教务系统一键导入（NWPU WebView 自动抓取）、深色模式/主题色切换、Widget 预览、数据导出/导入（JSON + 版本号）、格式化重置 |

### Android Widget

- 280×180 桌面卡片，显示当天最近 2 节课
- 课程名 / 课节时间 / 地点 / 颜色标识
- 深色/浅色双主题
- 点击刷新，数据变化自动更新

---

## 技术栈

```
React Native 0.81    Expo SDK 54       TypeScript (strict)
Zustand 5            AsyncStorage 2     date-fns 4
React Native Paper 5  react-native-webview 13
```

完整依赖列表见 `package.json`（共 29 个运行时依赖）。

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
npx expo start
```

然后在 Expo Go 中扫码，或按 `a` 启动 Android 构建。

### 验证（无需设备）

```bash
npx tsc --noEmit        # TypeScript 类型检查
npx eslint .            # 代码规范检查
npx expo-doctor         # SDK 兼容性检查 (18/18)
```

---

## 项目结构

```
app/                     Expo Router 文件路由（3 Tab）
├── _layout.tsx          根布局（Tab 导航 + PaperProvider + 深色模式）
├── index.tsx            Tab1 课表（周视图 + 月历切换）
├── schedule.tsx         Tab2 课表管理（课程/学期 CRUD）
└── settings.tsx         Tab3 设置（导入/主题/备份/格式化）
src/
├── types/index.ts       全部类型定义（Semester, Course, TimeSlot, RepeatRule 等）
├── stores/              Zustand 状态管理
│   ├── courseStore.ts   课程 CRUD + 冲突检测 + 学期裁剪
│   └── settingsStore.ts 学期 CRUD + 主题/深色模式 + 一键清空
├── utils/               工具模块
│   ├── scheduleDate.ts  日期计算（学期匹配、周数、周范围、重复规则）
│   ├── timeConflict.ts  时间冲突检测（日重叠 + 周交集 + 课节交集）
│   ├── jwxtParser.ts    教务系统解析（10 种文本格式 + HTML 备用解析）
│   ├── widgetData.ts    Widget 数据构建与持久化
│   └── dataBackup.ts    JSON 导出/导入（版本号验证）
├── hooks/
│   ├── useSnackbar.ts   全局 Snackbar（Zustand store + _layout host）
│   └── useWidgetDataSync.ts Widget 数据同步 Hook
└── components/          9 个 UI 组件（全部基于 React Native Paper）
widgets/                 Android Widget
├── CourseWidget.tsx     桌面小部件组件（FlexWidget + TextWidget）
└── widget-task-handler.tsx Widget 生命周期处理
plugins/
└── withHonorWidget.js   荣耀设备 Widget 兼容插件
```

## 数据流

```
AsyncStorage
  ├── courseStore      → "soaring-schedule-courses"
  ├── settingsStore    → "soaring-schedule-settings"
  └── widget data      → "@soaring_schedule:widget_data"

settingsStore ──deleteSemester()────→ courseStore.deleteCoursesBySemester()
settingsStore ──updateSemester()────→ courseStore.adjustCoursesForSemester() (周/节缩减时)
settingsStore ──formatData()────────→ courseStore.clearAllCourses()
```

两个 Zustand store，单向耦合（settingsStore → courseStore，不可反向）。

## License

MIT
