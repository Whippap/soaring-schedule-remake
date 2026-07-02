# 翱翔课表 (Soaring Schedule) — 设计与实现规格书

> 版本: 2.0 (重构版) | 日期: 2026-07-03 | 基于 v1.1.6 分析

---

## 目录

1. [项目概述](#1-项目概述)
2. [重构决策记录](#2-重构决策记录)
3. [数据模型](#3-数据模型)
4. [路由与页面结构](#4-路由与页面结构)
5. [状态管理](#5-状态管理)
6. [功能模块](#6-功能模块)
   - [6.1 学期管理](#61-学期管理)
   - [6.2 课程管理](#62-课程管理)
   - [6.3 周视图课表](#63-周视图课表)
   - [6.4 日历视图](#64-日历视图)
   - [6.5 教务系统课程导入](#65-教务系统课程导入)
   - [6.6 课节时间表管理](#66-课节时间表管理)
   - [6.7 Android 桌面 Widget](#67-android-桌面-widget)
   - [6.8 主题与深色模式](#68-主题与深色模式)
   - [6.9 数据备份与恢复](#69-数据备份与恢复)
   - [6.10 数据格式化](#610-数据格式化)
7. [教务系统导入 — 详细技术设计](#7-教务系统导入--详细技术设计)
8. [错误处理规范](#8-错误处理规范)
9. [实施计划](#9-实施计划)
10. [文件清单](#10-文件清单)

---

## 1. 项目概述

**翱翔课表**是一款面向西北工业大学（NWPU）学生的课程表管理应用，基于 React Native + Expo 构建，仅支持 Android 平台。完全离线运行，AsyncStorage 为唯一持久化层。

### 1.1 核心价值

- **周视图课表**：网格形式直观展示每周课程
- **教务系统一键导入**：内嵌 WebView 自动抓取 NWPU 教务系统课程数据
- **Android Widget**：主屏幕显示当天课程
- **完全离线**：无需网络，数据本地存储

### 1.2 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | React Native + Expo | RN 0.81+ / SDK 54 |
| 语言 | TypeScript (strict) | - |
| 路由 | Expo Router (file-based) | ~6.0 |
| 状态管理 | Zustand | 5.x |
| 本地存储 | AsyncStorage | 2.x |
| UI 组件 | React Native Paper | 5.x |
| WebView | react-native-webview | 13.x |
| 日期处理 | date-fns | 4.x |
| Widget | react-native-android-widget | 0.20 |
| 构建 | EAS Build | - |

---

## 2. 重构决策记录

以下决策是本重构计划的基线，来源于对 v1.1.6 版本的问题分析和需求评审。

| 编号 | 决策项 | 决定 | 理由 |
|------|--------|------|------|
| D1 | Task（事务）功能 | **移除** | 类型已定义但无 Store 方法、UI 仅占位，减少维护负担 |
| D2 | CalendarView | **保留，仅课程标记** | 移除 Task 引用，仅保留蓝色圆点标注有课日期 |
| D3 | 深色模式 | **全应用适配** | darkMode 从 Store 推进到所有页面和组件 |
| D4 | 无用 Store 字段 | **移除** secondaryColor/accentColor | UI 中从未使用 |
| D5 | UI 库统一 | **仅 React Native Paper** | 移除 MUI，减少包体积，统一设计语言 |
| D6 | 平台支持 | **仅 Android** | iOS Widget 不可用，专注 Android |
| D7 | 教务系统解耦 | **保持 NWPU 专用** | 需求明确固定用户群体，暂不增加抽象层 |
| D8 | 错误处理 | **Toast/Snackbar 替代 Alert.alert()** | 提升用户体验 |
| D9 | 数据备份版本管理 | **添加 version 字段** | 导出 JSON 含版本号，支持导入时的识别 |
| D10 | 导入源认证状态 | **不保持** | 每次导入都需要手动登录教务系统 |

---

## 3. 数据模型

### 3.1 核心类型定义

```typescript
// 重复规则
enum RepeatRule {
  ALL = '',           // 每周
  ODD = '仅单周',      // 仅单数周
  EVEN = '仅双周'      // 仅双数周
}

// 考核方式
enum AssessmentMethod {
  EXAM = '考试',
  INSPECTION = '考察',
  PNP = 'PnP'
}

// 时间段（一门课程可以有多个时间段）
interface TimeSlot {
  weekRange: string;        // 周数范围，如 "1-16"
  repeatRule: RepeatRule;   // 重复规则
  dayOfWeek: number;        // 星期几，1=周一, 7=周日
  classSections: number[];  // 课节编号数组，如 [1, 2] 表示第1-2节
}

// 课程
interface Course {
  id: string;                       // 唯一标识 (UUID)
  name: string;                     // 课程名称 (必填)
  semesterId: string;               // 所属学期 ID (必填)
  timeSlots: TimeSlot[];            // 时间段列表 (至少一个)
  code?: string;                    // 课程代码
  location?: string;                // 上课地点
  credits?: number;                 // 学分
  teacher?: string;                 // 任课教师
  assessmentMethod?: AssessmentMethod; // 考核方式
  notes?: string;                   // 备注
  color?: string;                   // 卡片颜色 (十六进制)
}

// 课节时间
interface SectionTime {
  start: string; // 开始时间，如 "08:30"
  end: string;   // 结束时间，如 "09:15"
}

// 学期
interface Semester {
  id: string;                   // 唯一标识 (时间戳字符串)
  name: string;                 // 学期名称，如 "2025-2026春"
  startDate: string;            // 开始日期，格式 YYYY-MM-DD
  endDate: string;              // 结束日期 (自动计算)
  weekCount: number;            // 学期总周数
  sectionCount: number;         // 每天课程节数
  sectionTimes: SectionTime[];  // 每节课的具体起止时间
}
```

### 3.2 存储键

| 存储键 | 内容 | 读写者 |
|--------|------|--------|
| `soaring-schedule-courses` | `Course[]` JSON | courseStore |
| `soaring-schedule-settings` | SettingsState JSON (含 semesters) | settingsStore |
| `@soaring_schedule:widget_data` | WidgetDataSnapshot JSON | widgetData.ts |
| `@soaring_schedule:dark_mode` | boolean | CourseWidget |

### 3.3 数据约束

- **学期时间不可重叠**：创建/编辑学期时检查日期范围是否与已有学期冲突
- **课程时间不可冲突**：同一学期内，课程时间段重叠时阻止保存
- **课程周数/节数受限于学期**：学期周数/节数缩减时，自动裁剪该学期下所有课程的超范围时间段
- **默认学期（"假期"）**：用户未创建任何学期时自动使用 — 52周、13节/天、1月1日~12月31日

### 3.4 8 种预设课程颜色

```
#3498db  #2ecc71  #e74c3c  #f39c12  #9b59b6  #1abc9c  #e67e22  #34495e
```

### 3.5 导入用 10 色调色板

```
#3498db  #2ecc71  #e74c3c  #f39c12  #9b59b6  #1abc9c  #e67e22  #34495e  #16a085  #27ae60
```

---

## 4. 路由与页面结构

Expo Router 文件系统路由，`app/_layout.tsx` 定义底部 Tab 导航。

```
app/
├── _layout.tsx      # 根布局：底部 Tab 导航 (3个Tab)
├── index.tsx        # Tab1「课表」— 周视图网格课表 + 课程表单入口
├── schedule.tsx     # Tab2「课表管理」— 课程列表 + 学期管理
└── settings.tsx     # Tab3「设置」— 导入/主题/Widget预览/备份/格式化
```

**Tab 配置**（使用 @react-navigation/bottom-tabs）：

| Tab 标签 | 图标 | 对应文件 |
|----------|------|----------|
| 课表 | calendar-month | `index.tsx` |
| 课表管理 | view-list | `schedule.tsx` |
| 设置 | cog | `settings.tsx` |

---

## 5. 状态管理

### 5.1 Store 架构

```
AsyncStorage
    ├── courseStore    → "soaring-schedule-courses"
    ├── settingsStore  → "soaring-schedule-settings"
    └── widget data    → "@soaring_schedule:widget_data"
```

### 5.2 courseStore

**职责**：课程 CRUD、冲突检测、学期范围裁剪、按学期删除

```typescript
interface CourseState {
  courses: Course[];
  // Actions
  addCourse(course: Course): void;
  updateCourse(id: string, updates: Partial<Course>): void;
  deleteCourse(id: string): void;
  getCoursesBySemester(semesterId: string): Course[];
  deleteCoursesBySemester(semesterId: string): void;
  adjustCoursesForSemester(semesterId: string, maxWeek: number, maxSection: number): void;
  clearAllCourses(): void;
  isCourseConflict(course: Course, excludeId?: string): boolean;
}
```

### 5.3 settingsStore

**职责**：学期 CRUD、时间重叠检测、主题色、深色模式

```typescript
interface SettingsState {
  semesters: Semester[];
  themeColor: string;         // 默认 #3498db
  darkMode: boolean;          // 默认 false
  // Actions
  addSemester(semester: Semester): void;
  updateSemester(id: string, updates: Partial<Semester>): void;
  deleteSemester(id: string): void;
  setThemeColor(color: string): void;
  setDarkMode(enabled: boolean): void;
  formatData(): void;         // 清空所有数据
  isSemesterOverlap(semester: Omit<Semester, 'id'>, excludeId?: string): boolean;
}
```

> **移除字段**：`secondaryColor`、`accentColor` 不再存在于 Store 中。

### 5.4 Store 间交互

```
settingsStore.deleteSemester()
  └─ 调用 courseStore.deleteCoursesBySemester()

settingsStore.updateSemester() — 当周数/节数缩减时
  └─ 调用 courseStore.adjustCoursesForSemester()

settingsStore.formatData()
  └─ 调用 courseStore.clearAllCourses()
```

---

## 6. 功能模块

---

### 6.1 学期管理

**入口**：Tab "课表管理" → 切换至 "学期" 模式

| 功能 | 详细描述 |
|------|----------|
| 创建学期 | 输入名称、开始日期、周数、每天节数；自动计算结束日期；可设置课节时间表 |
| 编辑学期 | 修改参数；缩减周数/节数则自动裁剪关联课程 |
| 删除学期 | 同时删除该学期下所有课程，带确认对话框 |
| 自动识别当前学期 | 根据系统日期匹配日期范围内的学期，无匹配则使用 "假期" 默认学期 |
| 学期列表 | 显示所有学期，标注当前学期，显示名称/开始日期/周数 |
| 时间重叠检测 | 创建/编辑时检查日期范围是否与已有学期重叠，重叠则阻止保存 |
| 智能警告 | 编辑学期时若周数/节数不足以容纳现有课程，弹出 Snackbar 提醒 |

**默认学期（"假期"）**：
- 名称："假期"
- 开始日期：当年 1月1日
- 结束日期：当年 12月31日
- 周数：52
- 节数：13
- 课节时间：长安校区默认时间表

**默认课节时间（长安校区预设）**：

| 节次 | 时间 | 节次 | 时间 |
|------|------|------|------|
| 第1节 | 08:30-09:15 | 第8节 | 14:55-15:40 |
| 第2节 | 09:25-10:10 | 第9节 | 15:55-16:40 |
| 第3节 | 10:30-11:15 | 第10节 | 16:55-17:40 |
| 第4节 | 11:25-12:10 | 第11节 | 19:00-19:45 |
| 第5节 | 12:20-13:05 | 第12节 | 19:55-20:40 |
| 第6节 | 13:05-13:50 | 第13节 | 20:40-21:25 |
| 第7节 | 14:00-14:45 | | |

---

### 6.2 课程管理

**入口**：Tab "课表管理" → "课程" 模式；或首页课表视图的添加按钮

| 功能 | 详细描述 |
|------|----------|
| 添加课程 | 表单输入课程信息，至少需要一个时间段 |
| 编辑课程 | 修改已有课程的全部字段 |
| 删除课程 | 滑动删除或详情弹窗中删除，带确认对话框 |
| 课程列表 | FlatList 展示，按学期筛选；卡片显示名称、代码、地点、教师、学分、时间段摘要；左侧颜色标识条 |
| 时间段管理 | 每门课程可多个 TimeSlot，每个独立设置周数范围、星期、课节、重复规则 |
| 周数选择器 | 单选和范围选择两种模式，网格布局显示 1~学期最大周数 |
| 课节时间选择器 | 三列滚动选择（星期、开始节、结束节），自动展开为连续节数组 |
| 颜色选择 | 8 种预设颜色圆点 |
| 时间冲突检测 | 保存前检查与同学期其他课程是否时间重叠 |
| 下拉刷新 | 课程列表支持下拉刷新 |

**时间冲突检测逻辑**：

```
isCourseConflict(newCourse, existingCourses, excludeId?):
  FOR each existingCourse (skip excludeId):
    IF existingCourse.semesterId !== newCourse.semesterId → skip
    FOR each slot in newCourse.timeSlots:
      FOR each existingSlot in existingCourse.timeSlots:
        IF isTimeSlotConflict(slot, existingSlot) → CONFLICT → show Snackbar

isTimeSlotConflict(slot1, slot2):
  1. dayOfWeek 不同 → 无冲突
  2. weekRange 不重叠 → 无冲突
  3. repeatRule 互斥 (ODD vs EVEN) → 无冲突
  4. classSections 无交集 → 无冲突
  5. 以上全满足 → 有冲突
```

---

### 6.3 周视图课表

**入口**：Tab "课表"（首页默认）

| 功能 | 详细描述 |
|------|----------|
| 7天/3天切换 | 默认显示周一到周日（7天），可切换为仅显示近3天 |
| 周切换 | 上一周/下一周箭头按钮切换，或横向滑动手势 |
| "返回本周" | 居中绿色按钮，快速跳转到当前周 |
| 当前周高亮 | 今天所在列以主题色高亮 |
| 课程块渲染 | 绝对定位，按 classSections 长度合并跨行；显示课程名和精简地点（去除校区前缀） |
| 点击课程详情 | 弹窗显示完整信息：名称、代码、地点、教师、学分、考核方式、所有时间段文本、备注；提供编辑/删除/关闭按钮 |
| 浮动导航按钮 | 上一周（左下）、返回本周（底部居中，绿色）、下一周（右下） |
| 学期感知 | 根据当前日期匹配学期；非当前学期的课程灰色显示；"假期"默认学期灰色禁用 |
| 下拉刷新 | 支持下拉刷新课程数据 |
| 过期周次 | 超出学期范围的周次单元格灰色不可用 |
| 动画 | 周切换时缩放动画效果 |

**课程块渲染逻辑**：

```
getCourseAt(dayOfWeek, section, targetDate):
  1. findSemesterForDate(targetDate) → 目标日期对应学期
  2. getWeekNumberForDate(targetDate, semester) → 教学周数
  3. 遍历 courses 筛选：
     - semesterId 匹配
     - dayOfWeek 匹配
     - classSections 包含当前 section
     - isWeekInRange(weekNumber, weekRange) 满足
     - matchesRepeatRule(weekNumber, repeatRule) 满足
  4. 返回 { course, index, isFirstSection, isLastSection }
```

---

### 6.4 日历视图

**入口**：集成在首页课程表组件中（月历模式切换按钮）

| 功能 | 详细描述 |
|------|----------|
| 月历网格 | 7列（周一起始），显示当月所有日期 |
| 月切换 | 上/下月箭头导航，"今天" 按钮快速返回 |
| 课程日期标记 | 有课程 → 蓝色圆点 |
| 日期点击 | 弹出详情弹窗，显示当天课程（名称 + 地点） |
| 非当月日期 | 灰色显示 |

> **不包含 Task（事务）功能。** 已从类型定义、Store、UI 中完全移除。

---

### 6.5 教务系统课程导入

**入口**：设置页 → "导入课表"

**流程概览**：

```
设置页 → CourseImportWizard
  ↓
步骤1: JwxtWebView → 用户登录 → 导航到课表页面 → 点击"提取课程"
  ↓ JavaScript 抓取 → postMessage
步骤2: 选择目标学期 → 预览 → 确认导入
  ↓
jwxtParser → 解析 + 增强 + 转换 → courseStore
```

> 详细技术设计见 [第7节](#7-教务系统导入--详细技术设计)。

---

### 6.6 课节时间表管理

**入口**：学期编辑 → "课节时间"；或学期列表 → 编辑学期 → 课节时间

| 功能 | 详细描述 |
|------|----------|
| 编辑课节时间 | 列表形式展示每节课，点击可编辑开始/结束时间 |
| 统一时长开关 | 启用后所有课节时长相同，修改任一开始时间自动计算结束时间 |
| 快速填充预设 | 一键填充三种预定义时间表 |
| 时间重叠检测 | 保存前检查课节时间是否有重叠或倒置，使用 Snackbar 提示 |
| 自动推算 | 增加课节数时，根据最后一节时间自动推算新增课节（45分钟/节 + 10分钟休息） |

**三种预设时间表**：

| 预设 | 节数 | 备注 |
|------|------|------|
| 长安校区 | 13节 | 默认值，作为新建学期的默认 |
| 友谊校区夏季 | 12节 | 5月1日-9月30日；第7节起下午/晚上时间略有不同 |
| 友谊校区冬季 | 12节 | 10月1日-4月30日；与夏季版仅第7节之后时间不同 |

---

### 6.7 Android 桌面 Widget

| 功能 | 详细描述 |
|------|----------|
| Widget 显示 | 280×180 卡片，显示当天最近 2 节课 |
| 课程信息 | 课程名、课节范围+时间、地点、颜色圆点标识 |
| 空状态 | 无课时显示 "今天没有课了" |
| 深色模式 | 支持深色背景+浅色文字 |
| 点击刷新 | 点击 Widget 触发数据刷新 |
| 自动更新 | 监听课程数据变化自动更新；在下一节课开始时自动刷新 |
| 定时器管理 | 仅在学期内启用定时器，学期外停止 |
| 荣耀兼容 | withHonorWidget Expo 插件 |

**数据流**：

```
课程变更 → useWidgetDataSync Hook 监听
  → buildWidgetCourseData() 构建今日课程
  → saveWidgetData() 存入 AsyncStorage
  → updateCourseWidget() 触发 Widget 重渲染
```

**Widget 生命周期**（`widget-task-handler.tsx`）：
- `WIDGET_ADDED`：Widget 被添加到桌面
- `WIDGET_UPDATE`：Widget 需要更新内容
- `WIDGET_CLICK`：用户点击 Widget（触发刷新）

---

### 6.8 主题与深色模式

**入口**：设置页

| 功能 | 详细描述 |
|------|----------|
| 主题色选择 | 8 种预设颜色，影响 Tab 激活色、按钮色、头部色、课程表当前列高亮 |
| 深色模式切换 | 全局开关，使用 RN Paper Provider 包装根布局，所有页面和组件适配 |
| Widget 预览 | 设置页内嵌 Widget 外观预览，实时反映主题色和深色模式变化 |

**深色模式实现方案**：
- `app/_layout.tsx` 读取 `settingsStore.darkMode`，选择 `MD3DarkTheme` / `MD3LightTheme`
- 传递自定义 `colors.primary`（含主题色）
- Widget 组件独立读取 `@soaring_schedule:dark_mode`（因 Widget 运行在独立进程）

**8 种预设主题色**：

```
#3498db (蓝, 默认)  #2ecc71 (绿)   #e74c3c (红)   #f39c12 (橙)
#9b59b6 (紫)        #1abc9c (青)   #e67e22 (深橙)  #34495e (深灰)
```

---

### 6.9 数据备份与恢复

**入口**：设置页 → "数据管理" 区域

| 功能 | 详细描述 |
|------|----------|
| 导出数据 | 读取 AsyncStorage 全部数据，序列化为 JSON，通过系统分享发送 |
| 导入数据 | 通过文件选择器选择 JSON 文件，验证格式后写入 AsyncStorage |
| 数据验证 | 检查 JSON 结构是否包含预期的键 |
| 版本号 | 导出 JSON 含 `version: "2.0"`，导入时识别，预留迁移能力 |
| 空数据检测 | 导出前检查，无数据时 Snackbar 提示 |

**导出 JSON 结构**：

```json
{
  "version": "2.0",
  "exportDate": "2026-07-03T...",
  "courses": [...],
  "settings": {
    "semesters": [...],
    "themeColor": "#3498db",
    "darkMode": false
  }
}
```

---

### 6.10 数据格式化

**入口**：设置页 → "调试工具"

| 功能 | 详细描述 |
|------|----------|
| 格式化数据 | 清空所有数据（学期、课程、设置），重置为默认状态（"假期" 默认学期） |
| 确认对话框 | 操作前弹出对话框确认 |

---

## 7. 教务系统导入 — 详细技术设计

### 7.1 架构图

```
┌──────────────────────────────────────────────┐
│               settings.tsx                    │
│  用户点击"导入课表" → 打开 CourseImportWizard   │
└───────────────────┬──────────────────────────┘
                    │
       ┌────────────▼────────────┐
       │ CourseImportWizard.tsx   │ 两步状态机
       │ step: 'webview' |        │
       │       'select-semester'  │
       └──────┬──────────┬───────┘
              │          │
   ┌──────────▼──┐  ┌───▼──────────────┐
   │ JwxtWebView │  │ Semester Select + │
   │    .tsx     │  │ Course Preview    │
   └──────┬──────┘  │ + Import Execute  │
          │         └──────────────────┘
   ┌──────▼──────┐
   │ JavaScript   │ 注入到 WebView 的抓取脚本
   │ Injection    │
   └──────┬──────┘
          │ postMessage(DATA_EXTRACTED:...)
   ┌──────▼──────┐
   │ jwxtParser  │ 增强 + 解析 + 转换
   │    .ts      │
   └──────┬──────┘
          │
   ┌──────▼──────┐
   │ courseStore │ Zustand → AsyncStorage
   └─────────────┘
```

### 7.2 步骤1：WebView 数据抓取 (JwxtWebView)

**URL**：`https://ecampus.nwpu.edu.cn/`（硬编码，NWPU 专用）

**组件状态**：

| 状态 | 类型 | 含义 |
|------|------|------|
| `canExtract` | boolean | 页面加载完成，允许提取 |
| `extracting` | boolean | 正在执行提取脚本 |

#### 注入脚本1：页面就绪检测

**注入时机**：`injectedJavaScriptBeforeContentLoaded`

```javascript
(function() {
  window.addEventListener('load', function() {
    setTimeout(function() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage('PAGE_LOADED');
      }
    }, 2000);
  });
})();
```

收到 `PAGE_LOADED` → 设置 `canExtract = true`，启用"提取课程"按钮。

#### 注入脚本2：课程数据提取 (EXTRACT_DATA_SCRIPT)

**注入时机**：用户点击"提取课程"按钮 → `webViewRef.injectJavaScript(EXTRACT_DATA_SCRIPT)`

**执行延迟**：4s (`setTimeout(..., 4000)`)

**提取步骤**：

```
Step 1: 定位目标文档
  ├─ 搜索页面所有 <iframe>
  │  └─ 遍历每 iframe.contentDocument
  │     └─ body 文本含关键词("机械原理","材料力学","学分","课程") → 设为目标
  └─ 未找到 → 使用主 document

Step 2: 提取学期列表
  └─ 查找 <select id="semesters">
     └─ 遍历 <option> → { name, dataSemester }
  └─ 未找到 → 默认 { name:'2025-2026春', dataSemester:'2025-2026-2' }

Step 3: 扫描 <tr> 逐行提取课程
  ├─ 有 data-semester 属性 → 更新 currentDataSemester
  ├─ 检测课程名（优先级）:
  │  1. .showSchedules 元素文本
  │  2. <h3> 元素文本
  │  3. 文本含"学分("且长度>20 → 从<h3>或首段提取
  │  (长度 >= 2 才视为有效)
  ├─ 提取课程代码: /\[([A-Za-z0-9]+)\]/
  ├─ 提取学分: /学分\(([\d.]+)\)/
  ├─ 提取教师: /授课教师[：:]([^<]+)/ | /教师[：:]([^<]+)/
  ├─ 提取考核方式: /(考试|考察)/
  ├─ 提取上课时间/地点: 遍历 <td>
  │  ├─ 含"第"+"节"/"周" → scheduleText
  │  └─ 匹配校区/教学楼/教室 → location
  ├─ 未找到 scheduleText → 回退最后两个 <td>
  ├─ 仍未找到 → 回退 tr.innerHTML
  ├─ scheduleText 含"网课" → 跳过
  └─ 推入: { name, code, credits, teacher, assessmentMethod,
            scheduleText, location, dataSemester }

Step 4: 备用方案 (Step 3 无结果)
  └─ 全局扫描 HTML:
     ├─ /<h3[^>]*>([^<]+)<\/h3>/g → 课程名
     └─ /class="[^"]*showSchedules[^"]*"[^>]*>([^<]+)/g → 课程名
     └─ 合并去重 → 占位时间: '1-16周 周一 第1-2节'

Step 5: 发送结果
  └─ JSON.stringify({ semesters, courses })
  └─ postMessage('DATA_EXTRACTED:' + json)
  └─ 出错: postMessage('ERROR:' + error.message)
```

#### WebView → RN 消息通信

| 消息前缀 | 触发 | RN 端处理 |
|----------|------|-----------|
| `PAGE_LOADED` | 页面加载完成 2s 后 | `canExtract = true` |
| `DATA_EXTRACTED:{json}` | 提取成功 | `JSON.parse` → `onDataExtracted(parsedData)` |
| `ERROR:{message}` | 提取出错 | Snackbar 显示错误信息 |

### 7.3 步骤2：数据增强与解析 (jwxtParser.ts)

#### 数据增强 `enhanceExtractedData(rawData)`

1. 补全地点：`course.location` 为空时从 `scheduleText` 提取
2. 截断教师：>15 人时截断加 " 等"
3. 过滤网课：课程名/教师/时间文本含网课关键词 → 跳过

**地点提取正则（优先级从高到低）**：

```
1. 校区+教室: /(长安校区|翠华校区|...)\s*([^\s,;]+)/
2. 校区简称:   /(长安|翠华|...)\s*校区\s*([^\s,;]+)/
3. XX楼+房间: /(\S+楼)\s*([^\s,;]+)/
4. 教学楼:     /(\S+教学楼)\s*([^\s,;]+)/
5. 字母数字:   /([ABCEFGSTU教]\s*\d+[-\d]*)/
6. 教室号:     /(\d+室)/, /(\d+教室)/
```

#### 时间文本解析 `parseScheduleText(scheduleText)`

**输入示例**：

```
"1-16周 周一 第1-2节; 1-8周 周三 第3-4节"
"1~2,5~8周 周二 7-8节"
"第十一周~第十六周 周五 第十一节~第十二节"
"1-16周(单) 周一 第1,2节"
```

**解析流程**：

```
Step 1: 清理 — 去 HTML 标签、&nbsp;、多余空格

Step 2: 分割 — 按分号(;；)分割 → 每段调用 splitByWeekRanges() 处理逗号

Step 3: 逐段解析 (对每个 schedulePart)
  ├─ 跳过含"网课"的段
  ├─ 解析周数范围:
  │  ├─ 范围: /(\d{1,3})[~至\-—](\d{1,3})/  → 如 "1-16"
  │  ├─ 单周: /(\d{1,3})/                      → 如 "8"
  │  └─ 验证: 1 ≤ 周数 ≤ 53
  ├─ 解析星期: /(周一|周二|周三|周四|周五|周六|周日)/
  │  └─ 映射: {周一:1, 周二:2, ..., 周日:7}
  ├─ 解析课节 (8种模式):
  │  1. 中文数字范围: /第(十一|...|一)节~(?:第)?(...)节/
  │  2. 阿拉伯数字范围(带第): /第(\d+)[节~至\-](?:第)?(\d+)节/
  │  3. 阿拉伯数字范围(不带第): /(\d+)[节~至\-](\d+)节/
  │  4. 逗号分隔(带第): /第((?:\d+,)*\d+)节/
  │  5. 逗号分隔(不带第): /((?:\d+,)*\d+)节/
  │  6. 中文单节: /第(十一|...|一)节/
  │  7. 阿拉伯单节(带第): /第(\d+)节/
  │  8. 阿拉伯单节(不带第): /(\d+)节/
  ├─ 解析重复规则:
  │  ├─ 含"单周"或"(单)" → ODD
  │  └─ 含"双周"或"(双)" → EVEN
  └─ 输出 TimeSlot

Step 4: 智能合并
  └─ 按 (dayOfWeek, classSections) 分组
     └─ 每组按周数范围排序 → 合并连续/重叠范围
        例: "1-10周"+"11-20周" → "1-20周"

Step 5: 兜底
  └─ 解析结果为空 → [{weekRange:'1-16', repeatRule:ALL, dayOfWeek:1, classSections:[1]}]
```

**支持的格式汇总**：

| 格式 | 示例 | 解析结果 |
|------|------|----------|
| 标准范围 | `1-16周 周一 第1-2节` | range:"1-16", day:1, sec:[1,2] |
| 逗号周数 | `1~2,5~8周 周二 7-8节` | 两个 TimeSlot |
| 分号分隔 | `1-8周 周一 1-2节; 9-16周 周三 3-4节` | 两个 TimeSlot |
| 中文数字 | `第十一周~第十六周 周五 第十一节~第十二节` | range:"11-16", day:5, sec:[11,12] |
| 单双周 | `1-16周(单) 周一 第1,2节` | repeat:ODD |
| 无"周"字 | `1-16 周一 第1-2节` | range:"1-16" |
| 波浪线 | `1~16周 周一 1~2节` | range:"1-16", sec:[1,2] |
| 中文"至" | `1至16周 周一 1至2节` | range:"1-16", sec:[1,2] |
| 逗号课节 | `第11,12节` 或 `11,12节` | sec:[11,12] |
| 单节 | `第11节` 或 `11节` | sec:[11] |

**辅助函数**：
- `splitByWeekRanges(text)` — 处理逗号分隔的周数范围
- `chineseNumToArabic(chinese)` — 中文数字→阿拉伯：一→1, 十一→11, ..., 二十→20

#### 课程转换 `convertToCourses(parsedCourses, semesterId, targetDataSemester?)`

```
1. 按 targetDataSemester 过滤课程（可选）
2. 遍历：
   a. parseScheduleText() → TimeSlot[]
   b. timeSlots 为空 → 跳过
   c. 10 色调色板轮询分配颜色
   d. 构造 Course 对象
3. 返回 Course[]
```

**辅助计算**：
- `calculateMaxWeekFromCourses(courses)` → 扫描所有时间段，返回最大周数（默认 20）
- `calculateMaxSectionFromCourses(courses)` → 扫描所有时间段，返回最大课节号（默认 10）

**备用解析**：`parseJwxtHtml(html)` — 直接解析完整 HTML 字符串的备用路径，依赖固定 HTML class 名（`tr.lessonInfo`, `td.courseInfo`, `p.showSchedules` 等）。

### 7.4 步骤3：导入向导 (CourseImportWizard)

**状态机**：

```
┌─────────┐  数据提取完成  ┌─────────────────┐  导入完成
│ webview │──────────────→│ select-semester │──────────→ 关闭
└─────────┘               └────────┬────────┘
     ↑                              │
     └────────── 返回 ──────────────┘
```

**状态**：

| 状态 | 类型 | 描述 |
|------|------|------|
| `step` | `'webview' \| 'select-semester'` | 当前步骤 |
| `parsedData` | `ParsedData \| null` | 增强后的解析数据 |
| `selectedSemesterId` | `string \| null` | 选中的目标学期 ID |
| `selectedDataSemester` | `string \| null` | 选中的数据学期 |
| `showSemesterForm` | boolean | 是否显示学期创建表单 |
| `importing` | boolean | 正在导入 |
| `autoCreateSemester` | `Omit<Semester, 'id'> \| null` | 自动创建的学期预设 |
| `overwriteExisting` | boolean | 是否覆盖目标学期现有课程 |

**步骤2 UI 布局**：

1. **检测到的学期**：列出教务系统提取到的学期，点击选择；显示已提取 N 门课程
2. **选择目标学期**：列出应用已有学期；智能创建按钮（若数据学期名称不匹配）；覆盖开关；手动创建按钮
3. **预览**：总课程数；前 5 门名称；超过 5 门显示 "...还有 N 门课程"
4. **底部**：取消 / 导入课程 按钮

**导入执行逻辑**：

```
handleImport():
  1. 验证: parsedData && 目标学期
  2. 确定目标学期 ID
  3. 若 overwriteExisting → deleteCoursesBySemester()
  4. convertToCourses(parsedData.courses, targetSemesterId, selectedDataSemester)
  5. 空结果 → Snackbar "没有找到可导入的课程"
  6. 逐门 courseStore.addCourse()
  7. Snackbar 成功提示 (课程数 + 核对提醒)
  8. 关闭向导
```

**学期冲突检测**：

```
checkSemesterConflict(newSemester):
  └─ 遍历已有学期 → 日期范围比较
     └─ !(newEnd < existingStart || newStart > existingEnd)
        → 重叠 → Snackbar 显示冲突学期名，阻止创建
```

### 7.5 错误处理

| 层级 | 场景 | 处理 |
|------|------|------|
| WebView JS | 脚本异常 | `postMessage('ERROR:'+message)` → Snackbar |
| WebView JS | 未找到学期选择器 | 默认学期 fallback |
| WebView JS | 结构化提取无结果 | 回退全 HTML 扫描 |
| JwxtWebView | JSON 解析失败 | Snackbar |
| JwxtWebView | injectJavaScript 失败 | Snackbar |
| jwxtParser | 周数超出 (>53/<1) | 跳过该时间段 |
| jwxtParser | 课节未匹配 | 默认 TimeSlot fallback |
| jwxtParser | 无地点信息 | 从 scheduleText 提取/留空 |
| jwxtParser | 教师 >15 人 | 截断 |
| CourseImportWizard | 学期冲突 | Snackbar |
| CourseImportWizard | addSemester 异常 | Snackbar |
| CourseImportWizard | 转换后 0 课程 | Snackbar |
| CourseImportWizard | 导入异常 | Snackbar |
| CourseImportWizard | 未选学期 | Snackbar |

---

## 8. 错误处理规范

### 8.1 全局替换原则

所有用户交互中的错误/成功/警告提示**统一使用 React Native Paper 的 `Snackbar` 组件**，不再使用 `Alert.alert()`。

`Alert.alert()` 保留仅用于**破坏性操作确认**：
- 删除学期（同时删除关联课程）
- 删除课程
- 格式化数据（清空全部）

### 8.2 Snackbar 三种级别

| 级别 | 样式 | 用途 |
|------|------|------|
| error | 红色背景、白色文字 | 操作失败、验证失败 |
| success | 绿色背景、白色文字 | 操作成功 |
| warning | 橙色背景、白色文字 | 警告提醒（如课程将超出学期范围） |

### 8.3 Snackbar 实现方式

- 使用 RN Paper 的 `Snackbar` 组件（`@react-native-paper/core` 提供）
- 在 `app/_layout.tsx` 中通过 Context 提供全局 show/showError/showSuccess/showWarning 函数
- 各组件通过 Hook 调用（如 `useSnackbar()`），避免在组件中重复定义 Snackbar

---

## 9. 实施计划

### Phase 1: 项目初始化
- `npx create-expo-app` SDK 54 + TypeScript strict
- 建立目录结构
- 安装依赖：RN Paper、Zustand、AsyncStorage、date-fns、expo-router、react-native-webview、react-native-android-widget、@react-native-community/datetimepicker、expo-document-picker、expo-file-system、expo-sharing
- 配置 ESLint、Prettier、tsconfig
- eas.json + app.json

### Phase 2: 数据模型 + 状态 + 路由
- `src/types/index.ts` — 所有类型定义（不包含 Task）
- `courseStore.ts` — 课程 CRUD
- `settingsStore.ts` — 学期 CRUD + 主题/深色模式
- 路由：`_layout.tsx` (Tab) + index/schedule/settings 骨架页面

### Phase 3: 学期 + 课程管理
- 工具模块：`scheduleDate.ts`、`timeConflict.ts`
- `SemesterForm.tsx`
- `CourseForm.tsx`
- `CourseList.tsx`

### Phase 4: 周视图 + 日历视图
- `CourseSchedule.tsx`
- `CalendarView.tsx`（移除 Task 引用）

### Phase 5: 教务系统导入
- `jwxtParser.ts`
- `JwxtWebView.tsx`
- `CourseImportWizard.tsx`

### Phase 6: Widget + 设置 + 备份
- `widgetData.ts`、`useWidgetDataSync.ts`
- `CourseWidget.tsx`、`widget-task-handler.tsx`
- `withHonorWidget.js`
- 设置页：主题色、Widget 预览、备份/恢复
- `TimeTableEditor.tsx`
- `dataBackup.ts`

### Phase 7: 深色模式全应用适配
- RN Paper Provider + 自定义 theme
- 覆盖所有页面/组件

### Phase 8: 错误处理 + 收尾
- 全局 Snackbar Hook
- 备份 JSON version 字段
- 最终 lint + type-check

---

## 10. 文件清单

```
soaring-schedule-remake/
├── app/
│   ├── _layout.tsx                 # Tab 导航根布局
│   ├── index.tsx                   # 「课表」— 周视图网格课表
│   ├── schedule.tsx                # 「课表管理」— 课程列表 + 学期管理
│   └── settings.tsx                # 「设置」— 导入/主题/Widget预览/备份/格式化
├── src/
│   ├── types/
│   │   └── index.ts                # 全部类型定义
│   ├── stores/
│   │   ├── courseStore.ts          # 课程状态 (Zustand)
│   │   └── settingsStore.ts        # 设置+学期状态 (Zustand)
│   ├── utils/
│   │   ├── scheduleDate.ts         # 日期与学期计算
│   │   ├── timeConflict.ts         # 时间冲突检测
│   │   ├── jwxtParser.ts           # 教务系统解析
│   │   ├── dataBackup.ts           # JSON 导入/导出
│   │   └── widgetData.ts           # Widget 数据处理
│   ├── hooks/
│   │   ├── useSnackbar.ts          # 全局 Snackbar Hook
│   │   └── useWidgetDataSync.ts    # Widget 数据同步
│   └── components/
│       ├── CourseSchedule.tsx       # 周视图课表
│       ├── CourseForm.tsx           # 课程添加/编辑
│       ├── CourseList.tsx           # 课程列表
│       ├── CourseImportWizard.tsx   # 导入向导
│       ├── JwxtWebView.tsx          # 教务系统 WebView
│       ├── SemesterForm.tsx         # 学期表单
│       ├── TimeTableEditor.tsx      # 课节时间编辑器
│       ├── CalendarView.tsx         # 月历视图
│       └── WidgetPreview.tsx        # Widget 预览
├── widgets/
│   ├── CourseWidget.tsx             # Android Widget 组件
│   └── widget-task-handler.tsx      # Widget 任务处理器
└── plugins/
    └── withHonorWidget.js           # 荣耀设备兼容插件
```

---

> **文档维护**：本规格书为重构基准文档，实现过程中如需调整，应在"重构决策记录"中添加新条目并注明日期。