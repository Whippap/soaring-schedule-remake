# 上课提醒功能设计

日期:2026-09-24
状态:已批准

## 背景与目标

用户希望在上课前收到本地通知提醒:在设置界面配置开关与提前时间,通知文案为「{课程名}将在{N}分钟后开始,上课地点为{地点},请做好准备」。另在设置项下方展示提示文案。灵动岛(iOS Live Activities)经澄清不在本次范围内,项目保持 Android-only,仅做标准通知。

## 范围

范围内:

- 设置界面新增「上课提醒」配置卡片
- 本地定时通知,按课程时间段逐个排程
- 精确闹钟调度(方案 A),权限缺失时降级并提示

范围外:

- 灵动岛 / Live Activities / Android 16 Live Updates
- iOS 支持
- 服务器推送或云同步

## 需求

1. 设置界面可开关「上课提醒」,默认关闭
2. 可设置提前档位:5 / 10 / 15 / 30 分钟,单选,默认 10 分钟
3. 通知文案:「{课程名}将在{提前分钟}分钟后开始,上课地点为{地点},请做好准备」;课程无地点时省略地点分句
4. 设置项下方恒显提示:「在课程开始前发送通知提醒您上课,如果还是害怕错过课程的话,就去定个闹钟吧~」
5. 通知标题:「上课提醒」
6. 通知渠道:高重要性 + 响铃
7. 通知点击:打开 App(默认行为)
8. App 前台时收到通知仍显示横幅

## 设计

### 1. 设置界面(`app/settings.tsx`)

新增「上课提醒」卡片,位于「外观」与「数据管理」之间:

- 开关行:铃铛图标 + 「上课提醒」+ Paper Switch
- 开启后显示档位选择行:SegmentedButtons,5 / 10 / 15 / 30 分钟
- 提示文案行(恒显):上文需求 4 的文案,次要色小字
- 权限警告行(条件显示):
  - 精确闹钟权限未授予:「提醒可能不准时,点击前往系统设置开启」→ 跳转系统精确闹钟设置页
  - 通知权限被拒:「通知权限已关闭,无法发送提醒」

### 2. 状态与存储(`src/stores/settingsStore.ts`)

- 新增字段:`reminderEnabled: boolean`(默认 false)、`reminderLeadMinutes: number`(默认 10)
- 两者加入 `partialize` 持久化
- `formatData()` 重置时一并恢复默认值

### 3. 调度引擎(新增 `src/utils/reminderScheduler.ts`)

纯逻辑模块,复用现有工具(`src/utils/scheduleDate.ts`、`src/utils/campusTimes.ts` 的 `getSectionTimesForDate`):

- `computeUpcomingOccurrences(courses, semesters, now)`:遍历每门课的每个 timeSlot,展开未来上课日期:
  - 周次范围(`isWeekInRange`)、单双周(`matchesRepeatRule`)、星期几
  - 每节课开始时间用 `getSectionTimesForDate(semester, date)` 计算(友谊校区冬夏切换自动正确)
  - 排程范围:今天起至所属学期 endDate;对「今天起 90 天内开始」的未来学期也排程,覆盖学期切换(总数上限 400 条保护,超出按最近优先截断)
- 触发时间 = 上课开始 − `reminderLeadMinutes`
- 通知标识符:确定性 id,如 `reminder-{courseId}-{slotIndex}-{yyyy-MM-dd}`(便于精确取消)
- 全量替换策略:`scheduleAll` = 取消全部已排通知 + 重新排程;`cancelAll` 供关闭开关与格式化数据使用
- 挂载为 `src/hooks/useReminderSync.ts`(仿 `useWidgetDataSync`):订阅 courses / semesters / reminder 设置,变化时全量重排;仅当 `reminderEnabled` 为真时排程

### 4. 通知通道与呈现

- 通知渠道:`class-reminders`(名称「上课提醒」),importance HIGH,响铃;App 启动时创建
- `setNotificationHandler` 在 bundle 入口 `index.ts` 注册(与 widget handler 同处:保证所有 JS 上下文生效),前台时显示横幅
- 每条通知:title「上课提醒」,body 见需求 3,trigger 为精确 Date

### 5. 权限与降级

- 新依赖:`expo-notifications`(SDK 57 对应版本),注册 config plugin
- `app.json` `android.permissions` 声明:`POST_NOTIFICATIONS`、`SCHEDULE_EXACT_ALARM`(API 31-32)、`USE_EXACT_ALARM`(API 33+,本 App 属日历类应用,符合政策)
- 首次打开开关:先请求通知权限(POST_NOTIFICATIONS);拒绝 → 开关回弹关闭 + Snackbar 提示
- 精确闹钟:开启时检查是否已授予;未授予 → 照常排程(系统会降级为不精确) + 设置页显示警告行,点击跳系统精确闹钟设置页
- 每次排程前复查通知权限:若用户在系统设置中撤销了通知权限 → 取消全部排程并在设置页显示警告行(不弹请求框)
- 具体 API(权限检查、跳转 Intent)以实现时 SDK 57 的 expo-notifications API 为准

## 边界与已知限制

- 课程/学期增删改、导入恢复、格式化数据 → 经 store 订阅自动触发全量重排
- 手机重启:expo-notifications 自带的 boot receiver 恢复已排通知(实现时需真机验证)
- App 被强停(force-stop):系统取消全部通知,需再次打开 App 重排——与 widget 同属 Android 平台限制,设置页提示文案间接覆盖
- 假期/默认学期、未开始的学期(超过 90 天)不产生排程
- 同一课程多时间段 → 每个时间段独立一条提醒

## 验证

静态:`npm run typecheck`、`npm run lint`。

真机清单(preview APK):

1. 打开开关 → 通知权限弹窗 → 授予 → 显示档位选择,默认 10 分钟
2. 精确闹钟权限引导 → 系统设置页开启
3. 将一门课的节次改到当前时间 +11 分钟后(触发时间 = 现在 +1 分钟),等待通知准点到达,文案格式正确(含/不含地点)
4. 切换档位 5 分钟 → 重排生效
5. 编辑课程(改时间)→ 旧通知取消、新通知按新时间到达
6. 关闭开关 → 全部通知取消
7. 重启手机(不打开 App)→ 已排通知仍按时到达
8. 拒绝通知权限 → 开关回弹 + Snackbar
9. 拒绝精确闹钟权限 → 设置页警告行出现,点击可跳转系统设置
10. 格式化数据 → 通知全部取消、开关复位
