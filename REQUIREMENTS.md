# 翱翔课表 (Soaring Schedule) — 重构需求文档

> 版本: 基于 v1.1.6 | 日期: 2026-07-02

---

## 目录

1. [项目概述](#1-项目概述)
2. [数据模型](#2-数据模型)
3. [功能模块](#3-功能模块)
   - [3.1 学期管理](#31-学期管理)
   - [3.2 课程管理](#32-课程管理)
   - [3.3 周视图课表](#33-周视图课表)
   - [3.4 日历视图](#34-日历视图)
   - [3.5 教务系统课程导入](#35-教务系统课程导入)
   - [3.6 课节时间表管理](#36-课节时间表管理)
   - [3.7 Android 桌面 Widget](#37-android-桌面-widget)
   - [3.8 主题与外观设置](#38-主题与外观设置)
   - [3.9 数据备份与恢复](#39-数据备份与恢复)
   - [3.10 数据管理与调试](#310-数据管理与调试)
4. [教务系统课程导入 — 详细设计](#4-教务系统课程导入--详细设计)
5. [现有实现附录](#5-现有实现附录)
6. [技术栈与架构](#6-技术栈与架构)
7. [已知问题与改进方向](#7-已知问题与改进方向)

---

## 1. 项目概述

**翱翔课表**是一款面向西北工业大学（NWPU）学生的课程表管理应用，基于 React Native + Expo 构建，支持 Android 平台。应用以本地存储为核心，无需后端服务器，所有数据通过 AsyncStorage 持久化。

### 1.1 核心价值

- **周视图课表**：以网格形式直观展示每周课程安排
- **教务系统一键导入**：通过内嵌 WebView 自动抓取学校教务系统课程数据
- **Android Widget**：在主屏幕显示当天课程
- **完全离线**：所有数据本地存储，无需网络

### 1.2 当前技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React Native 0.81.5 + Expo SDK 54 |
| 语言 | TypeScript (strict mode) |
| 路由 | Expo Router (file-based) |
| 状态管理 | Zustand 5.x |
| 本地存储 | AsyncStorage |
| UI 组件 | MUI (Material UI) + React Native Paper |
| WebView | react-native-webview 13.x |
| 日期处理 | date-fns 4.x |
| Widget | react-native-android-widget |
| 构建 | EAS Build |

---

## 2. 数据模型

### 2.1 核心类型定义

```typescript
// 重复规则
enum RepeatRule {
  ALL = '',          // 每周
  ODD = '仅单周',     // 仅单数周
  EVEN = '仅双周'     // 仅双数周
}

// 考核方式
enum AssessmentMethod {
  EXAM = '考试',
  INSPECTION = '考察',
  PNP = 'PnP'
}

// 时间段（一门课程可以有多个时间段）
interface TimeSlot {
  weekRange: string;       // 周数范围，如 "1-16"
  repeatRule: RepeatRule;  // 重复规则（每周/单周/双周）
  dayOfWeek: number;       // 星期几，1=周一, 7=周日
  classSections: number[]; // 课节编号数组，如 [1, 2] 表示第1-2节
}

// 课程
interface Course {
  name: string;                    // 课程名称（必填）
  semesterId: string;              // 所属学期 ID（必填）
  timeSlots: TimeSlot[];           // 时间段列表（至少一个）
  code?: string;                   // 课程代码
  location?: string;               // 上课地点
  credits?: number;                // 学分
  teacher?: string;                // 任课教师
  assessmentMethod?: AssessmentMethod; // 考核方式
  notes?: string;                  // 备注
  color?: string;                  // 卡片颜色（十六进制）
}

// 课节时间
interface SectionTime {
  start: string; // 开始时间，如 "08:30"
  end: string;   // 结束时间，如 "09:15"
}

// 学期
interface Semester {
  id: string;                // 唯一标识（时间戳字符串）
  name: string;              // 学期名称，如 "2025-2026春"
  startDate: string;         // 开始日期，格式 YYYY-MM-DD
  endDate: string;           // 结束日期，格式 YYYY-MM-DD（自动计算 = startDate + weekCount*7 - 1）
  weekCount: number;         // 学期总周数
  sectionCount: number;      // 每天课程节数
  sectionTimes: SectionTime[]; // 每节课的具体起止时间
}

// 事务/待办（旧日历视图使用，当前未完全实现）
interface Task {
  name: string;
  date: string;              // YYYY-MM-DD
  startTime?: string;
  endTime?: string;
  location?: string;
  status: '待完成' | '已完成' | string;
}
```

### 2.2 存储键

| 存储键 | 内容 | 读写者 |
|--------|------|--------|
| `soaring-schedule-courses` | `Course[]` JSON | courseStore |
| `soaring-schedule-settings` | SettingsState JSON（含 semesters） | settingsStore |
| `@soaring_schedule:widget_data` | WidgetDataSnapshot JSON | widgetData.ts |
| `@soaring_schedule:dark_mode` | 布尔值 | CourseWidget |

### 2.3 数据约束

- **学期时间不可重叠**：创建/编辑学期时检查日期范围是否与已有学期冲突
- **课程时间不可冲突**：同一学期内，课程时间段重叠时阻止保存
- **课程周数/节数受限于学期**：学期周数/节数缩减时，自动裁剪该学期下所有课程的超范围时间段
- **默认学期**：当用户未创建任何学期时，系统使用 "假期" 默认学期（52周，13节/天，1月1日~12月31日）

---

## 3. 功能模块

### 3.1 学期管理

**入口**：底部 Tab "课表管理" → 切换至 "学期" 模式

#### 3.1.1 功能描述

学期是整个应用的时间基准。每个学期定义了起止日期、教学周数和每天的课节安排。课程必须归属于某个学期，课表视图根据当前日期自动匹配对应学期。

#### 3.1.2 详细功能点

| 功能 | 描述 |
|------|------|
| 创建学期 | 输入名称、开始日期、周数、每天节数；自动计算结束日期；可设置课节时间表 |
| 编辑学期 | 修改已有学期的各项参数；若缩减周数/节数则自动裁剪关联课程 |
| 删除学期 | 删除学期时自动删除该学期下所有课程 |
| 自动识别当前学期 | 根据系统日期匹配日期范围内的学期；若无匹配则使用 "假期" 默认学期 |
| 学期列表 | 显示所有学期，标注当前学期，显示名称/开始日期/周数 |
| 时间重叠检测 | 创建/编辑时检查日期范围是否与已有学期重叠，重叠则阻止保存 |
| 智能警告 | 编辑学期时若周数/节数不足以容纳现有课程，弹出提醒 |

#### 3.1.3 默认课节时间（长安校区）

预设 13 节课的时间表，作为新建学期的默认值：

| 课节 | 时间 |
|------|------|
| 第1节 | 08:30-09:15 |
| 第2节 | 09:25-10:10 |
| 第3节 | 10:30-11:15 |
| 第4节 | 11:25-12:10 |
| 第5节 | 12:20-13:05 |
| 第6节 | 13:05-13:50 |
| 第7节 | 14:00-14:45 |
| 第8节 | 14:55-15:40 |
| 第9节 | 15:55-16:40 |
| 第10节 | 16:55-17:40 |
| 第11节 | 19:00-19:45 |
| 第12节 | 19:55-20:40 |
| 第13节 | 20:40-21:25 |

---

### 3.2 课程管理

**入口**：底部 Tab "课表管理" → "课程" 模式；或首页课表视图的添加按钮

#### 3.2.1 功能描述

支持手动添加/编辑/删除课程。每门课程包含名称、归属学期、一个或多个时间段、以及可选的课程代码、地点、教师、学分、考核方式、备注和颜色。

#### 3.2.2 详细功能点

| 功能 | 描述 |
|------|------|
| 添加课程 | 表单输入课程信息，至少需要一个时间段 |
| 编辑课程 | 修改已有课程的全部字段 |
| 删除课程 | 滑动删除或详情弹窗中删除，带确认对话框 |
| 课程列表 | FlatList 展示，按学期筛选；卡片显示名称、代码、地点、教师、学分、时间段摘要；左侧颜色标识条 |
| 时间段管理 | 支持每门课程多个时间段，每个时间段独立设置周数范围、星期、课节、重复规则 |
| 周数选择器 | 支持单选和范围选择两种模式，网格布局显示 1~学期最大周数 |
| 课节时间选择器 | 三列滚动选择（星期、开始节、结束节），自动展开为连续节数组 |
| 颜色选择 | 8 种预设颜色：#3498db, #2ecc71, #e74c3c, #f39c12, #9b59b6, #1abc9c, #e67e22, #34495e |
| 时间冲突检测 | 保存前检查与同学期其他课程是否时间重叠（同天 + 周数重叠 + 重复规则兼容 + 课节重叠） |
| 下拉刷新 | 课程列表支持下拉刷新 |

#### 3.2.3 时间冲突检测逻辑

```
isCourseConflict(newCourse, existingCourses, excludeIndex?):
  FOR each existingCourse (skip excludeIndex):
    IF existingCourse.semesterId !== newCourse.semesterId → skip
    FOR each slot in newCourse.timeSlots:
      FOR each existingSlot in existingCourse.timeSlots:
        IF isTimeSlotConflict(slot, existingSlot) → CONFLICT

isTimeSlotConflict(slot1, slot2):
  1. dayOfWeek 不同 → 无冲突
  2. weekRange 不重叠 → 无冲突
  3. repeatRule 互斥（单周 vs 双周）→ 无冲突
  4. classSections 无交集 → 无冲突
  5. 以上条件全部满足 → 有冲突
```

---

### 3.3 周视图课表

**入口**：首页 Tab（默认）

#### 3.3.1 功能描述

以网格形式展示一周课程。左侧纵轴为课节编号及时间，顶部横轴为星期和日期。课程块跨行显示（多节课合并），不同颜色区分课程。

#### 3.3.2 详细功能点

| 功能 | 描述 |
|------|------|
| 7天/3天切换 | 默认显示周一到周日（7天），可切换为仅显示近3天 |
| 周切换 | 上一周/下一周按钮切换查看不同周；"返回本周"按钮快速回到当前周 |
| 当前周高亮 | 今天的列以主题色高亮 |
| 课程块渲染 | 课程块绝对定位，跨越多行（根据 classSections 长度合并）；显示课程名和精简地点（去除校区前缀） |
| 点击课程详情 | 弹窗显示课程完整信息：名称、代码、地点、教师、学分、考核方式、所有时间段文本、备注；提供编辑/删除/关闭按钮 |
| 浮动导航按钮 | 上一周（左下）、返回本周（底部居中，绿色）、下一周（右下） |
| 学期感知 | 自动根据当前日期匹配学期；非当前学期的周次灰色显示；"假期"默认学期灰色禁用 |
| 下拉刷新 | 支持下拉刷新课程数据 |
| 过期周次 | 超出学期范围的周次单元格灰色不可用 |
| 动画 | 周切换时缩放动画效果 |

#### 3.3.3 课程块渲染逻辑

```
getCourseAt(dayOfWeek, section, targetDate):
  1. 通过 findSemesterForDate 找到目标日期对应的学期
  2. 计算目标日期对应的教学周数
  3. 遍历 courses，筛选：
     - semesterId 匹配
     - dayOfWeek 匹配
     - classSections 包含当前 section
     - isWeekInRange(weekNumber, weekRange) 满足
     - matchesRepeatRule(weekNumber, repeatRule) 满足
  4. 返回 { course, index, isFirstSection, isLastSection }
     - isFirstSection: section === min(classSections)，用于决定块起始位置
     - isLastSection: section === max(classSections)，用于决定块结束位置
```

---

### 3.4 日历视图

**入口**：目前集成在首页课程表组件中（CalendarView 组件存在但未作为独立 Tab）

#### 3.4.1 功能描述

月历形式展示，标识有课程的日期。点击日期查看当天课程和事务详情。

#### 3.4.2 详细功能点

| 功能 | 描述 |
|------|------|
| 月历网格 | 7列（周一起始），显示当月所有日期 |
| 月切换 | 上/下月箭头导航，"今天" 按钮快速返回 |
| 日期标记 | 有课程→蓝色圆点，有事务→橙色圆点 |
| 日期点击 | 弹出详情弹窗，显示当天课程（名称+地点）和事务（名称、时间、地点、状态标记） |
| 浮动添加按钮 | 绿色 "+" 按钮，预留添加事务入口 |
| 非当月日期 | 灰色显示 |

> **注意**：日历视图的 Task（事务）功能当前未完全实现——Task 类型已定义但无对应的 Store 方法。重构时需决定是完善还是移除。

---

### 3.5 教务系统课程导入

**入口**：设置页 → "导入课表"

> ⚠️ 此功能是本次重构的核心关注点，详见 [第4节 教务系统课程导入 — 详细设计](#4-教务系统课程导入--详细设计)

#### 3.5.1 功能概述

通过内嵌 WebView 加载西北工业大学教务系统（`https://ecampus.nwpu.edu.cn/`），用户在 WebView 中手动登录并导航到课表页面后，点击"提取课程"按钮触发 JavaScript 脚本抓取页面中的课程数据，解析后导入到应用。

#### 3.5.2 导入流程（高层）

```
设置页 → 打开导入向导 (CourseImportWizard)
  ↓
步骤1: WebView 打开教务系统 → 用户登录 → 导航到课表页面 → 点击"提取课程"
  ↓
JavaScript 脚本抓取页面数据 → postMessage 传回 RN 端
  ↓
步骤2: 选择目标学期 → 预览课程 → 确认导入
  ↓
解析时间文本 → 转换为 Course 对象 → 写入 AsyncStorage
```

---

### 3.6 课节时间表管理

**入口**：学期编辑 → "课节时间"；或学期列表 → 编辑学期 → 课节时间

#### 3.6.1 功能描述

管理每个学期每天每节课的具体起止时间。课程表视图左侧的时间标注即来源于此。

#### 3.6.2 详细功能点

| 功能 | 描述 |
|------|------|
| 编辑课节时间 | 列表形式展示每节课，点击可编辑开始/结束时间 |
| 统一时长开关 | 启用后所有课节时长相同，修改任一开始时间自动计算结束时间 |
| 快速填充预设 | 一键填充三种预定义时间表 |
| 时间重叠检测 | 保存前检查课节时间是否有重叠或倒置 |
| 自动推算 | 增加课节数时，根据最后一节的时间自动推算新增课节时间（45分钟/节 + 10分钟休息） |

#### 3.6.3 预设时间表

**友谊校区夏季**（5月1日-9月30日）：

| 课节 | 时间 |
|------|------|
| 第1节 | 08:00-08:45 |
| 第2节 | 08:55-09:40 |
| 第3节 | 10:00-10:45 |
| 第4节 | 10:55-11:40 |
| 第5节 | 11:50-12:35 |
| 第6节 | 12:35-13:20 |
| 第7节 | 14:30-15:15 |
| 第8节 | 15:25-16:10 |
| 第9节 | 16:20-17:05 |
| 第10节 | 17:15-18:00 |
| 第11节 | 19:30-20:15 |
| 第12节 | 20:25-21:10 |

**友谊校区冬季**（10月1日-4月30日）：

| 课节 | 时间 |
|------|------|
| 第1节 | 08:00-08:45 |
| 第2节 | 08:55-09:40 |
| 第3节 | 10:00-10:45 |
| 第4节 | 10:55-11:40 |
| 第5节 | 11:50-12:35 |
| 第6节 | 12:35-13:20 |
| 第7节 | 14:00-14:45 |
| 第8节 | 14:55-15:40 |
| 第9节 | 15:50-16:35 |
| 第10节 | 16:45-17:30 |
| 第11节 | 19:00-19:45 |
| 第12节 | 19:55-20:40 |

> **注意**：友谊校区冬季与夏季的差异仅在第7节之后的下午/晚上时间。

**长安校区**：同 [3.1.3 默认课节时间](#313-默认课节时间长安校区)。

---

### 3.7 Android 桌面 Widget

#### 3.7.1 功能描述

在 Android 主屏幕显示当天课程信息的桌面小部件。

#### 3.7.2 详细功能点

| 功能 | 描述 |
|------|------|
| Widget 显示 | 280×180 卡片，显示当天最近2节课 |
| 课程信息 | 课程名、课节范围+时间、地点、颜色圆点标识 |
| 空状态 | 无课时显示 "今天没有课了" |
| 深色模式 | 支持深色背景+浅色文字 |
| 点击刷新 | 点击 Widget 触发数据刷新 |
| 自动更新 | 监听课程数据变化自动更新；在下一节课开始时自动刷新 |
| 定时器管理 | 仅在学期内启用定时器，学期外停止 |
| 荣耀设备兼容 | 通过 `withHonorWidget` Expo 插件添加荣耀 Widget 支持 |

#### 3.7.3 数据流

```
课程数据变更
  → useWidgetDataSync Hook 监听
    → buildWidgetCourseData() 构建今日课程
    → saveWidgetData() 存入 AsyncStorage
    → updateCourseWidget() 触发 Widget 重渲染
```

#### 3.7.4 Widget 任务处理器

Widget 通过 `widget-task-handler.tsx` 处理生命周期事件：
- `WIDGET_ADDED`：Widget 被添加到桌面
- `WIDGET_UPDATE`：Widget 需要更新内容
- `WIDGET_CLICK`：用户点击 Widget（触发刷新）

---

### 3.8 主题与外观设置

**入口**：设置页

#### 3.8.1 功能描述

自定义应用的主题颜色。

#### 3.8.2 详细功能点

| 功能 | 描述 |
|------|------|
| 主题色选择 | 8 种预设颜色可选，影响 Tab 激活色、按钮色、头部色等 |
| 8 种预设颜色 | #3498db（蓝）、#2ecc71（绿）、#e74c3c（红）、#f39c12（橙）、#9b59b6（紫）、#1abc9c（青）、#e67e22（深橙）、#34495e（深灰） |
| Widget 预览 | 设置页内嵌 Widget 外观预览，实时反映主题色变化 |

> **注意**：Store 中定义了 `darkMode`、`secondaryColor`、`accentColor` 但 UI 中未完全使用。`darkMode` 仅在 Widget 中有实际效果。重构时需决定是否完整实现深色模式。

---

### 3.9 数据备份与恢复

**入口**：设置页 → "数据管理" 区域

#### 3.9.1 功能描述

支持将全部数据（课程+事务+设置）导出为 JSON 文件，以及从 JSON 文件导入恢复数据。

#### 3.9.2 详细功能点

| 功能 | 描述 |
|------|------|
| 导出数据 | 读取 AsyncStorage 中全部数据，序列化为 JSON，通过系统分享功能发送 |
| 导入数据 | 通过文件选择器选择 JSON 文件，验证格式后写入 AsyncStorage |
| 数据验证 | 导入时检查 JSON 结构是否包含预期的键 |
| 空数据检测 | 导出前检查是否有数据，无数据时提示 |

#### 3.9.3 导出 JSON 结构

```json
{
  "version": "1.0",
  "exportDate": "2026-07-02T...",
  "courses": [...],
  "tasks": [...],
  "settings": { "semesters": [...], ... }
}
```

---

### 3.10 数据管理与调试

**入口**：设置页 → "调试工具"

| 功能 | 描述 |
|------|------|
| 格式化数据 | 清空所有数据（学期、课程、设置），恢复出厂默认状态 |

---

## 4. 教务系统课程导入 — 详细设计

本节详细描述从教务系统导入课程的完整技术方案，包括数据抓取、解析、转换、存储的全链路。

### 4.1 架构总览

```
┌─────────────────────────────────────────────────────┐
│                    设置页 (settings.tsx)              │
│  用户点击"导入课表" → 打开 CourseImportWizard          │
└────────────────────┬────────────────────────────────┘
                     │
        ┌────────────▼────────────┐
        │  CourseImportWizard.tsx │  导入向导（状态机）
        │  step: 'webview' |      │
        │        'select-semester'│
        └──────┬──────────┬──────┘
               │          │
    ┌──────────▼──┐  ┌───▼──────────────┐
    │ JwxtWebView │  │ Semester Selection│
    │   .tsx      │  │ + Course Preview  │
    └──────┬──────┘  │ + Import Execute  │
           │         └──────────────────┘
    ┌──────▼──────┐
    │  JavaScript  │  注入到 WebView 的抓取脚本
    │  Injection   │
    └──────┬──────┘
           │ postMessage(DATA_EXTRACTED:...)
    ┌──────▼──────┐
    │ jwxtParser  │  解析 + 增强 + 转换
    │   .ts       │
    └──────┬──────┘
           │
    ┌──────▼──────┐
    │ courseStore │  Zustand → AsyncStorage
    └─────────────┘
```

### 4.2 第一步：WebView 数据抓取

#### 4.2.1 组件：JwxtWebView

**文件**：`src/components/JwxtWebView.tsx`

**职责**：
- 渲染全屏 Modal，内嵌 WebView 加载教务系统 URL
- 提供"提取课程"按钮，触发 JavaScript 注入
- 接收 WebView 回传的数据，解析后回调父组件

**URL**：`https://ecampus.nwpu.edu.cn/`（西北工业大学翱翔门户）

**状态管理**：
| 状态 | 类型 | 描述 |
|------|------|------|
| `canExtract` | boolean | 页面加载完成（收到 PAGE_LOADED），允许提取 |
| `extracting` | boolean | 正在执行提取脚本，显示 loading |

#### 4.2.2 注入脚本1：页面就绪检测

**注入时机**：`injectedJavaScriptBeforeContentLoaded`（页面内容加载前）

```javascript
// INJECTED_JAVASCRIPT_BEFORE_LOAD
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

**作用**：页面完全加载后等待 2 秒，通知 RN 端可以开始提取。

#### 4.2.3 注入脚本2：课程数据提取（EXTRACT_DATA_SCRIPT）

**注入时机**：用户点击"提取课程"按钮 → `webViewRef.current.injectJavaScript(EXTRACT_DATA_SCRIPT)`

**执行延迟**：4 秒（`setTimeout(..., 4000)`，等待动态内容渲染）

**提取步骤**：

```
Step 1: 定位目标文档
  └─ 搜索页面所有 <iframe>
     └─ 遍历每个 iframe，访问 contentDocument
        └─ 检查 body 文本是否包含关键词:
           "机械原理", "材料力学", "学分", "课程"
        └─ 找到则将该 iframe 的 document 设为目标
     └─ 若未找到匹配 iframe，使用主 document

Step 2: 提取学期列表
  └─ 查找 <select id="semesters">
     └─ 遍历 <option> 元素
        └─ 收集 { name, dataSemester }
           (name: 显示文本如 "2025-2026春",
            dataSemester: value如 "2025-2026-2")
     └─ 若未找到，使用默认值:
        { name: '2025-2026春', dataSemester: '2025-2026-2' }

Step 3: 扫描 <tr> 逐行提取课程
  └─ 遍历目标文档所有 <tr> 元素
     ├─ 若 tr 有 data-semester 属性 → 更新 currentDataSemester
     ├─ 检测课程名（优先级）:
     │  1. .showSchedules 元素文本
     │  2. <h3> 元素文本
     │  3. 文本含 "学分(" 且长度>20 → 从 <h3> 或首段提取
     │  (课程名长度 >= 2 才视为有效)
     ├─ 提取课程代码: 正则 /\[([A-Za-z0-9]+)\]/
     ├─ 提取学分: 正则 /学分\(([\d.]+)\)/
     ├─ 提取教师: 正则 /授课教师[：:]([^<]+)/ 或 /教师[：:]([^<]+)/
     ├─ 提取考核方式: 正则 /(考试|考察)/
     ├─ 提取上课时间/地点: 遍历所有 <td>
     │  ├─ td 文本含 "第"+"节"/"周" → 作为 scheduleText
     │  └─ td 文本匹配校区/教学楼/教室模式 → 作为 location
     ├─ 若未找到 scheduleText → 回退使用最后两个 <td>
     ├─ 若仍未找到 → 回退使用整个 tr 的 HTML
     └─ 过滤: scheduleText 含 "网课" → 跳过
     └─ 推入结果: { name, code, credits, teacher,
                    assessmentMethod, scheduleText,
                    location, dataSemester }

Step 4: 备用方案（若 Step 3 未提取到任何课程）
  └─ 全局扫描整个文档 HTML:
     ├─ 正则 /<h3[^>]*>([^<]+)<\/h3>/g 找课程名
     └─ 正则 /class="[^"]*showSchedules[^"]*"[^>]*>([^<]+)</g 找课程名
     └─ 合并去重后，每门课使用占位时间数据:
        scheduleText: '1-16周 周一 第1-2节'

Step 5: 发送结果
  └─ JSON.stringify({ semesters, courses })
  └─ window.ReactNativeWebView.postMessage('DATA_EXTRACTED:' + json)
  └─ 若出错: postMessage('ERROR:' + error.message)
```

#### 4.2.4 WebView → RN 消息通信

**消息类型**：
| 消息前缀 | 触发条件 | RN 端处理 |
|----------|----------|-----------|
| `PAGE_LOADED` | 页面加载完成 2 秒后 | 设置 `canExtract = true`，启用"提取课程"按钮 |
| `DATA_EXTRACTED:{json}` | 提取脚本执行成功 | 解析 JSON → 调用 `onDataExtracted(parsedData)` |
| `ERROR:{message}` | 提取脚本执行出错 | 弹出 Alert 显示错误信息 |

### 4.3 第二步：数据增强与解析

#### 4.3.1 数据增强

**函数**：`enhanceExtractedData(rawData)`（`src/utils/jwxtParser.ts`）

**处理内容**：
1. 补全地点：若 course.location 为空，调用 `extractLocationFromScheduleText()` 从时间文本中提取
2. 截断教师：教师列表中超过 15 人时截断并加 " 等"
3. 过滤网课：若课程名/教师/时间文本含网课关键词 → 跳过

**地点提取正则**（`extractLocationFromScheduleText`）：
```
优先级从高到低:
1. 校区 + 教室: /(长安校区|翠华校区|...)\s*([^\s,;]+)/
2. 校区简称:   /(长安|翠华|...)\s*校区\s*([^\s,;]+)/
3. XX楼 + 房间: /(\S+楼)\s*([^\s,;]+)/
4. 教学楼:     /(\S+教学楼)\s*([^\s,;]+)/
5. 字母数字:   /([ABCEFGSTU教]\s*\d+[-\d]*)/
6. 教室号:     /(\d+室)/, /(\d+教室)/
```

#### 4.3.2 时间文本解析

**函数**：`parseScheduleText(scheduleText)`（`src/utils/jwxtParser.ts`）

这是整个导入流程中最复杂的解析逻辑。

**输入示例**：
```
"1-16周 周一 第1-2节; 1-8周 周三 第3-4节"
"1~2,5~8周 周二 7-8节"
"第十一周~第十六周 周五 第十一节~第十二节"
"1-16周(单) 周一 第1,2节"
```

**解析流程**：

```
Step 1: 清理
  └─ 去除 HTML 标签、&nbsp;、多余空格

Step 2: 分割
  └─ 按分号 (;；) 分割为多个时间段
     └─ 对每个分号段，调用 splitByWeekRanges() 处理逗号分隔的周数

Step 3: 逐段解析 (对每个 schedulePart)
  ├─ 跳过含"网课"的段
  ├─ 解析周数范围:
  │  ├─ 范围格式: /(\d{1,3})[~至\-—](\d{1,3})/  (如 "1-16")
  │  └─ 单周格式: /(\d{1,3})/  (如 "8")
  │  └─ 验证: 1 ≤ 周数 ≤ 53
  ├─ 解析星期:  /(周一|周二|周三|周四|周五|周六|周日)/
  │  └─ 映射: {周一:1, 周二:2, ..., 周日:7}
  ├─ 解析课节 (8种模式按优先级):
  │  1. 中文数字范围: /第(十一|...|一)节~(?:第)?(...)节/
  │     例: "第十一节~第十二节" → [11, 12]
  │  2. 阿拉伯数字范围(带第): /第(\d+)[节~至\-](?:第)?(\d+)节/
  │     例: "第11-12节" → [11, 12]
  │  3. 阿拉伯数字范围(不带第): /(\d+)[节~至\-](\d+)节/
  │     例: "11-12节" → [11, 12]
  │  4. 逗号分隔(带第): /第((?:\d+,)*\d+)节/
  │     例: "第11,12节" → [11, 12]
  │  5. 逗号分隔(不带第): /((?:\d+,)*\d+)节/
  │     例: "11,12节" → [11, 12]
  │  6. 中文单节: /第(十一|...|一)节/
  │     例: "第十一节" → [11]
  │  7. 阿拉伯单节(带第): /第(\d+)节/
  │     例: "第11节" → [11]
  │  8. 阿拉伯单节(不带第): /(\d+)节/
  │     例: "11节" → [11]
  ├─ 解析重复规则:
  │  ├─ 含"单周"或"(单)" → RepeatRule.ODD
  │  └─ 含"双周"或"(双)" → RepeatRule.EVEN
  └─ 生成 TimeSlot: { weekRange, repeatRule, dayOfWeek, classSections }

Step 4: 智能合并
  └─ 按 (dayOfWeek, classSections) 分组
     └─ 每组内按周数范围排序
        └─ 合并重叠或连续的范围
           例: "1-10周" + "11-20周" → "1-20周"

Step 5: 兜底
  └─ 若解析结果为空，返回默认:
     { weekRange: '1-16', repeatRule: ALL, dayOfWeek: 1, classSections: [1] }
```

**辅助函数**：

`splitByWeekRanges(text)` — 处理同一课程有多个不连续周数范围的情况：
```
输入: "1~2,5~8周 周二 7-8节"
输出: ["1~2周 周二 7-8节", "5~8周 周二 7-8节"]
```

`chineseNumToArabic(chinese)` — 中文数字转阿拉伯数字：
```
'一'→1, '十一'→11, ..., '二十'→20
```

#### 4.3.3 课程转换

**函数**：`convertToCourses(parsedCourses, semesterId, targetDataSemester?)`

```
1. 按 targetDataSemester 过滤课程（可选）
2. 遍历过滤后的课程:
   a. 调用 parseScheduleText() 解析 scheduleText → TimeSlot[]
   b. 若 timeSlots 为空 → 跳过该课程
   c. 从 10 色调色板轮询分配颜色
   d. 构造 Course 对象
3. 返回 Course[]
```

**颜色轮询**（10 色）：
```
#3498db, #2ecc71, #e74c3c, #f39c12, #9b59b6,
#1abc9c, #e67e22, #34495e, #16a085, #27ae60
```

**辅助计算函数**：
- `calculateMaxWeekFromCourses(courses)` — 扫描所有课程的已解析时间段，返回最大周数（默认 20）
- `calculateMaxSectionFromCourses(courses)` — 扫描所有课程的已解析时间段，返回最大课节号（默认 10）

### 4.4 第三步：导入向导流程

**组件**：`CourseImportWizard.tsx`

#### 4.4.1 状态机

```
┌─────────┐  数据提取完成  ┌─────────────────┐  导入完成
│ webview │──────────────→│ select-semester │──────────→ 关闭
└─────────┘               └────────┬────────┘
     ↑                              │
     └────────── 返回 ──────────────┘
```

#### 4.4.2 状态

| 状态 | 类型 | 描述 |
|------|------|------|
| `step` | `'webview' \| 'select-semester'` | 当前步骤 |
| `parsedData` | `ParsedData \| null` | 增强后的解析数据 |
| `selectedSemesterId` | `string \| null` | 选中的目标学期 ID |
| `selectedDataSemester` | `string \| null` | 选中的数据学期（如 "2025-2026-2"） |
| `showSemesterForm` | boolean | 是否显示学期创建表单 |
| `importing` | boolean | 正在导入 |
| `autoCreateSemester` | `Omit<Semester, 'id'> \| null` | 自动创建的学期预设数据 |
| `overwriteExisting` | boolean | 是否覆盖目标学期现有课程 |

#### 4.4.3 步骤2界面布局

**Section 1: 检测到的学期**
- 列出从教务系统提取到的所有学期（名称）
- 点击选择某个数据学期，筛选对应课程
- 显示已提取到 N 门课程

**Section 2: 选择目标学期**
- 列出应用中已有的学期
- 若无学期则显示"暂无学期，请先创建"
- **智能创建按钮**：若数据学期名称与已有学期不匹配，显示"创建「XXX」学期"
  - 自动预设：名称=教务系统学期名、开始日期=根据春/秋推断、周数=maxWeek、节数=maxSection
- **覆盖开关**：选中目标学期后，可选"覆盖原有学期课程"
- **创建新学期按钮**：手动创建学期

**Section 3: 预览**
- 总课程数
- 前 5 门课程名称
- 超过 5 门显示 "...还有 N 门课程"

**底部按钮**：取消 / 导入课程

#### 4.4.4 导入执行逻辑

```
handleImport():
  1. 验证：必须有 parsedData 且有目标学期
  2. 确定目标学期 ID: selectedSemesterId || semesters[0].id
  3. 若 overwriteExisting → removeCoursesBySemester(targetSemesterId)
  4. convertToCourses(parsedData.courses, targetSemesterId, selectedDataSemester)
  5. 若转换后为空 → 提示"没有找到可导入的课程"
  6. 逐门课程 addCourse()（每门课独立写入 AsyncStorage）
  7. 弹出成功提示，包含课程数量 + 提醒用户核对
  8. 关闭向导
```

#### 4.4.5 学期冲突检测

```
checkSemesterConflict(newSemester):
  └─ 遍历已有学期
     └─ 比较日期范围: 若 !(newEnd < existingStart || newStart > existingEnd)
        └─ 存在重叠 → 记录冲突学期
  └─ 若有冲突 → Alert 显示冲突学期名称，阻止创建
```

### 4.5 HTML 解析方式（备用）

**函数**：`parseJwxtHtml(html)`（`src/utils/jwxtParser.ts`）

除了 WebView 注入 JS 抓取外，还提供了直接解析完整 HTML 字符串的方式。使用正则表达式匹配特定的 HTML 结构：

```
学期正则:
/<tr class="semester_tr"[^>]*data-semester="([^"]+)"[^>]*>[\s\S]*?<td>([^<]+)<\/td>/g

课程正则:
/<tr class="lessonInfo"[^>]*data-semester="([^"]+)"[^>]*>
 [\s\S]*?<td class="courseInfo"[^>]*data-course="([^"]+)"[^>]*>
 [\s\S]*?<p class="showSchedules">([^<]+)<\/p>
 [\s\S]*?<p>([^<]+)<i[\s\S]*?学分\(([\d.]+)\)[\s\S]*?授课教师：([^<]+)<\/p>
 [\s\S]*?<td>([^<]*)<\/td>
 [\s\S]*?<td>([\s\S]*?)<\/td>/g
```

> **注意**：此方式依赖教务系统固定的 HTML 结构（`tr.lessonInfo`、`td.courseInfo`、`p.showSchedules` 等 class 名）。若教务系统改版，此方式将失效。WebView JS 注入方式比 HTML 解析更灵活，因为它通过 DOM 语义（`.showSchedules` class、`<h3>` 标签、内容关键词）而非固定结构来定位数据。

### 4.6 错误处理汇总

| 层级 | 错误场景 | 处理方式 |
|------|----------|----------|
| WebView JS | 提取脚本执行异常 | postMessage(`ERROR:${message}`)，RN 端 Alert 显示 |
| WebView JS | 未找到学期选择器 | 使用默认学期 `{name:'2025-2026春', dataSemester:'2025-2026-2'}` |
| WebView JS | 结构化提取无结果 | 回退到全 HTML 扫描 `<h3>` 和 `.showSchedules` |
| JwxtWebView | JSON 解析失败 | Alert "解析课程数据失败，请重试" |
| JwxtWebView | injectJavaScript 失败 | Alert "提取课程数据失败，请重试" |
| jwxtParser | 周数超出范围 (>53 或 <1) | `continue`，跳过该时间段 |
| jwxtParser | 未匹配到任何课节 | 返回默认值 `{weekRange:'1-16', dayOfWeek:1, classSections:[1]}` |
| jwxtParser | 课程无地点信息 | 从 scheduleText 中尝试提取，提取不到则留空 |
| jwxtParser | 教师超过 15 人 | 截断并加 " 等" |
| CourseImportWizard | 学期日期重叠 | Alert 显示冲突学期名，阻止创建 |
| CourseImportWizard | addSemester 抛出异常 | Alert 显示错误消息 |
| CourseImportWizard | 转换后课程数为 0 | Alert "没有找到可导入的课程" |
| CourseImportWizard | 导入循环异常 | Alert "导入课程失败" |
| CourseImportWizard | 无学期且未选择 | Alert "请先选择或创建一个学期" |

---

## 5. 现有实现附录

### 5.1 文件清单

```
soaring-schedule-expo/
├── app/
│   ├── _layout.tsx            # 根布局：底部 Tab 导航（课表/课表管理/设置）
│   ├── index.tsx              # 首页：课表视图 + 课程表单 + Widget 同步
│   ├── schedule.tsx           # 课表管理：课程列表 + 学期管理
│   └── settings.tsx           # 设置：导入/主题/Widget预览/备份/调试
├── src/
│   ├── components/
│   │   ├── CalendarView.tsx      # 月历视图
│   │   ├── CourseForm.tsx        # 课程添加/编辑表单（~1132行）
│   │   ├── CourseImportWizard.tsx # 教务系统导入向导
│   │   ├── CourseList.tsx        # 课程列表视图
│   │   ├── CourseSchedule.tsx    # 周视图课表（~996行）
│   │   ├── JwxtWebView.tsx       # 教务系统 WebView（~500行）
│   │   ├── MainView.tsx          # 主视图包装器
│   │   ├── SemesterForm.tsx      # 学期添加/编辑表单
│   │   ├── TimeTableEditor.tsx   # 课节时间表编辑器（~1087行）
│   │   └── WidgetPreview.tsx     # Widget 预览组件
│   ├── hooks/
│   │   └── useWidgetDataSync.ts  # Widget 数据同步 Hook
│   ├── stores/
│   │   ├── courseStore.ts        # 课程状态（Zustand + AsyncStorage）
│   │   └── settingsStore.ts      # 设置+学期状态（Zustand + AsyncStorage）
│   ├── types/
│   │   └── index.ts              # 全部 TypeScript 类型定义
│   └── utils/
│       ├── dataBackup.ts         # JSON 数据导入/导出
│       ├── jwxtParser.ts         # 教务系统数据解析器（~629行）
│       ├── scheduleDate.ts       # 日期与学期计算工具
│       ├── timeConflict.ts       # 时间冲突检测
│       └── widgetData.ts         # Widget 数据处理
├── widgets/
│   ├── CourseWidget.tsx          # Android Widget 组件
│   └── widget-task-handler.tsx   # Widget 任务处理器
└── plugins/
    └── withHonorWidget.js        # 荣耀设备 Widget 兼容插件
```

### 5.2 关键代码片段索引

| 功能 | 文件 | 关键函数/组件 |
|------|------|--------------|
| WebView JS 抓取 | `JwxtWebView.tsx` | `EXTRACT_DATA_SCRIPT` (L41-340), `handleMessage` (L351-376) |
| HTML 正则解析 | `jwxtParser.ts` | `parseJwxtHtml()` (L91-187) |
| 时间文本解析 | `jwxtParser.ts` | `parseScheduleText()` (L305-548) |
| 数据增强 | `jwxtParser.ts` | `enhanceExtractedData()` (L190-249) |
| 课程转换 | `jwxtParser.ts` | `convertToCourses()` (L587-628) |
| 导入向导 | `CourseImportWizard.tsx` | `handleImport()` (L170-210) |
| 时间冲突检测 | `timeConflict.ts` | `isTimeSlotConflict()`, `isCourseConflict()` |
| 日期计算 | `scheduleDate.ts` | `findSemesterForDate()`, `getWeekNumberForDate()`, `isWeekInRange()`, `matchesRepeatRule()` |
| 课程存储 | `courseStore.ts` | `addCourse()`, `adjustCoursesForSemester()` |
| 学期存储 | `settingsStore.ts` | `addSemester()`, `updateSemester()`, `deleteSemester()` |
| Widget 同步 | `useWidgetDataSync.ts` | 核心 Hook 函数 |

### 5.3 WebView JS 注入脚本完整代码

见 `src/components/JwxtWebView.tsx` 中 `EXTRACT_DATA_SCRIPT` 常量（第 41-340 行）。

### 5.4 时间解析支持的格式

| 格式 | 示例 | 解析结果 |
|------|------|----------|
| 标准周数范围 | `1-16周 周一 第1-2节` | weekRange:"1-16", dayOfWeek:1, sections:[1,2] |
| 多周数范围(逗号) | `1~2,5~8周 周二 7-8节` | 两个 TimeSlot: (1-2)+(5-8) |
| 分号分隔 | `1-8周 周一 1-2节; 9-16周 周三 3-4节` | 两个独立 TimeSlot |
| 中文数字 | `第十一周~第十六周 周五 第十一节~第十二节` | weekRange:"11-16", dayOfWeek:5, sections:[11,12] |
| 单双周规则 | `1-16周(单) 周一 第1,2节` | repeatRule:ODD |
| 单周（文本） | `1-16周 单周 周一 1-2节` | repeatRule:ODD |
| 无"周"字 | `1-16 周一 第1-2节` | weekRange:"1-16" |
| 波浪线范围 | `1~16周 周一 1~2节` | weekRange:"1-16", sections:[1,2] |
| 中文"至" | `1至16周 周一 1至2节` | weekRange:"1-16", sections:[1,2] |
| 逗号分隔课节 | `第11,12节` 或 `11,12节` | sections:[11,12] |
| 单节 | `第11节` 或 `11节` | sections:[11] |

---

## 6. 技术栈与架构

### 6.1 技术栈明细

| 类别 | 包名 | 版本 | 用途 |
|------|------|------|------|
| 核心 | react | 19.1.0 | UI 框架 |
| 核心 | react-native | 0.81.5 | 原生渲染 |
| 平台 | expo | ~54.0.33 | 跨平台开发框架 |
| 路由 | expo-router | ~6.0.23 | 文件系统路由 |
| 导航 | @react-navigation/bottom-tabs | ^7.4.0 | 底部Tab导航 |
| 状态 | zustand | ^5.0.11 | 轻量状态管理 |
| 存储 | @react-native-async-storage/async-storage | ^2.2.0 | 本地持久化 |
| UI | @mui/material | ^7.3.8 | Material UI 组件 |
| UI | react-native-paper | ^5.15.0 | Material Design 组件 |
| UI | @emotion/react | ^11.14.0 | CSS-in-JS |
| WebView | react-native-webview | 13.15.0 | 内嵌浏览器 |
| Widget | react-native-android-widget | ^0.20.1 | Android 桌面部件 |
| 日期 | date-fns | ^4.1.0 | 日期工具 |
| 日期选择 | @react-native-community/datetimepicker | 8.4.4 | 原生日期时间选择 |
| 文件 | expo-document-picker | - | 文件选择 |
| 文件 | expo-file-system | - | 文件系统访问 |
| 分享 | expo-sharing | - | 系统分享 |
| 编译 | expo (reactCompiler) | - | React Compiler 实验性支持 |

### 6.2 数据流架构

```
                    ┌──────────────┐
                    │  AsyncStorage │
                    └──┬───┬───┬──┘
                       │   │   │
          ┌────────────┘   │   └────────────┐
          ▼                ▼                ▼
   ┌─────────────┐  ┌─────────────┐  ┌──────────┐
   │ courseStore │  │settingsStore│  │ widget   │
   │  (Zustand)  │  │  (Zustand)  │  │ data     │
   └──────┬──────┘  └──────┬──────┘  └────┬─────┘
          │                │               │
          └────────┬───────┘               │
                   ▼                       ▼
          ┌────────────────┐     ┌─────────────────┐
          │  React 组件树   │────→│ useWidgetDataSync│
          │  (UI 渲染)     │     │ (Widget 同步)    │
          └────────────────┘     └────────┬────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │ Android Widget   │
                                 │ (桌面小部件)      │
                                 └─────────────────┘
```

**Store 间交互**：
- `settingsStore.deleteSemester()` → 调用 `courseStore.removeCoursesBySemester()`
- `settingsStore.updateSemester()` → 若周数/节数缩减 → 调用 `courseStore.adjustCoursesForSemester()`
- `settingsStore.formatData()` → 调用 `courseStore.clearAllCourses()`

### 6.3 路由结构

```
/ (index.tsx)          → HomeScreen    (课表首页)
/schedule (schedule.tsx) → ScheduleScreen (课程管理)
/settings (settings.tsx) → SettingsScreen (设置)
```

使用 Expo Router 的文件系统路由，`_layout.tsx` 定义底部 Tab 导航。

### 6.4 构建配置

- **eas.json**：三个构建配置（development / preview / production），全部输出 APK
- **app.json**：包名 `com.soaringschedule.app`，竖屏锁定，启用新架构，scheme `soaringschedule`
- **plugins**：expo-router, expo-splash-screen, react-native-android-widget, withHonorWidget, datetimepicker

---

## 7. 已知问题与改进方向

### 7.1 教务系统耦合

- **硬编码 URL**：`https://ecampus.nwpu.edu.cn/` 硬编码在 `JwxtWebView.tsx` 中，不支持其他学校
- **DOM 结构依赖**：JS 提取脚本和 HTML 正则解析都依赖特定的 DOM 结构（class 名、元素层级），教务系统改版将导致导入失效
- **关键词硬编码**：iframe 识别依赖 "机械原理"、"材料力学" 等课程名关键词
- **无认证状态保持**：每次导入都需要重新登录教务系统
- **无错误重试**：提取失败后需要用户手动重新操作整个流程

### 7.2 架构改进

| 问题 | 建议 |
|------|------|
| Task（事务）功能未完成 | 类型已定义但无 Store 方法，UI 中仅有占位。需决定完善或移除 |
| CalendarView 未充分利用 | 日历视图组件存在但未作为独立 Tab，功能不完整 |
| darkMode 实现不完整 | Store 中有 darkMode 但仅在 Widget 中生效，应用主体未适配 |
| secondaryColor/accentColor 未使用 | Store 中定义了但 UI 中未实际应用 |
| 数据备份格式不包含版本迁移 | JSON 导出/导入无 schema 版本管理 |
| 错误处理依赖 Alert | 大量使用 Alert.alert() 作为错误提示，用户体验不佳 |
| 无国际化支持 | 所有文本硬编码中文 |
| 无 iOS Widget 支持 | Widget 仅支持 Android（react-native-android-widget） |
| MUI + Paper 混用 | 同时使用两个 UI 库，增大包体积，样式不统一 |

### 7.3 重构建议优先级

1. **教务系统导入模块解耦**：将教务系统特定的逻辑抽象为可配置的"导入源"接口，支持多学校/多数据源
2. **完善 Task/Calendar 功能**：决定保留还是移除，统一功能范围
3. **统一 UI 库**：选择 MUI 或 Paper 之一，减少包体积
4. **完善深色模式**：全应用适配
5. **改进错误处理**：使用 Toast/Snackbar 替代 Alert
6. **添加数据版本管理**：导出的 JSON 含版本号，支持导入时自动迁移
7. **添加单元测试**：目前项目无任何测试代码

---

> **文档维护**：本文档基于 v1.1.6 版本代码分析生成。重构实施时请同步更新此文档。
