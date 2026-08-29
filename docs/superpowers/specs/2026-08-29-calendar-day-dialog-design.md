# 月视图日期弹窗优化设计

日期：2026-08-29
状态：已批准

## 背景与问题

月视图（CalendarView）点击某一天时，弹出底部抽屉（bottom sheet）显示当天课程，采用 reanimated 弹簧滑动动画（translateY 400→0）。用户反馈：

1. 动画过多——希望移除滑动动画，弹窗直接淡入、居中显示在屏幕中央；关闭时只做淡出
2. 弹窗缺少跳转入口——希望添加「跳转到周视图」按钮，点击后直接跳到那一天所在的周

## 目标

1. 弹窗从底部抽屉改为屏幕居中卡片，打开/关闭仅使用淡入/淡出动画
2. 弹窗 footer 增加「跳转到周视图」按钮，点击后关闭弹窗并切换至周视图、显示目标日所在周

## 决策记录

| 决策点 | 选择 | 备选（已排除） |
|--------|------|----------------|
| 动画实现 | 保留 reanimated，用 `withTiming` 对 overlay 容器做 opacity 淡入淡出（方案 A） | RN 内置 Animated（引入第二套动画体系）；完全无动画（不满足淡入淡出要求） |
| 弹窗位置 | 屏幕居中卡片（用户原话「屏幕中央」） | 保持底部（与需求冲突） |
| 跳转时显示模式 | 强制切换到 7 天模式 | 保持 3 天模式（weekOffset 语义下无法保证目标日可见，见下文） |

## 现状

- `src/components/CalendarView.tsx`：`sheetTranslateY`（useSharedValue(400)）+ `withSpring` 滑动；overlay `justifyContent: 'flex-end'` 底部定位；卡片仅顶部圆角；`sheetHandle` 拖拽把手；footer 仅「关闭」按钮；`useReducedMotion` 已接入
- `app/index.tsx`（HomeScreen）：持有 `view`（'schedule' | 'calendar'）与 `weekOffset` 状态，传给 `CourseSchedule`
- `src/components/CourseSchedule.tsx`：`dayMode`（7 | 3）为组件内部 useState；`override` key 使用 `${weekOffset}-${dayMode}`

## 设计

### 1. CalendarView 弹窗改造

**布局（居中卡片）：**

- `sheetOverlay`：`justifyContent: 'flex-end'` → `'center'`
- 卡片：顶部圆角 → 四角圆角（`dt.borderRadius.xl`），左右 `margin: 24`
- 删除 `sheetHandle` / `handleBar`（底部抽屉拖拽把手，居中对话框无意义）
- 其余内容（标题「M月d日 星期」、课程列表、footer）不变

**动画（纯淡入淡出）：**

```ts
const overlayOpacity = useSharedValue(0);

const showSheet = () => {
  overlayOpacity.value = reduced ? 1 : withTiming(1, { duration: 150 });
};

const hideSheet = () => {
  if (reduced) {
    overlayOpacity.value = 0;
    runOnJS(setSelectedDay)(null);
    return;
  }
  overlayOpacity.value = withTiming(0, { duration: 150 }, () => {
    runOnJS(setSelectedDay)(null);
  });
};

const animatedOverlay = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
```

- overlay 容器（scrim + 卡片）整体包一层 `Animated.View` 应用 `animatedOverlay`，遮罩与卡片一起淡入淡出
- 删除 `sheetTranslateY`、`withSpring` 及相关样式引用
- `useReducedMotion` 逻辑保留：减少动态效果开启时直接显示/隐藏，不播放动画

### 2. 「跳转到周视图」按钮

- footer 改为双按钮行：「关闭」（左侧，次要文本按钮，沿用现有样式）+「跳转到周视图」（右侧，primary 胶囊按钮，样式参考「今天」按钮：primary 背景 + onPrimary 文字 + 圆角 pill）
- 点击流程：直接调用 `onJumpToWeek(selectedDay.date)`（视图立即切换，CalendarView 整体卸载，无需等待淡出完成——不调用 `hideSheet`）
- 新 prop：`CalendarView` 增加 `onJumpToWeek: (date: Date) => void`（必传）

### 3. 跳转数据流（app/index.tsx）

**`dayMode` 提升：**

- HomeScreen 新增 `const [dayMode, setDayMode] = useState<7 | 3>(7);`
- `CourseSchedule` 改为受控：Props 增加 `dayMode: 7 | 3` 与 `onDayModeChange: (mode: 7 | 3) => void`，删除内部 useState；7天/3天按钮 onPress 改调 `onDayModeChange`
- `CourseSchedule` 其余逻辑（含 override key、3 天模式 days 计算）不变

**跳转处理：**

```ts
const handleJumpToWeek = (date: Date) => {
  const targetWeekStart = startOfWeek(date, { weekStartsOn: 1 });
  const todayWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const offset = differenceInCalendarDays(targetWeekStart, todayWeekStart) / 7;
  setWeekOffset(offset);
  setDayMode(7);
  setView('schedule');
};
```

- 需要新 import：`startOfWeek`、`differenceInCalendarDays`（date-fns）
- 跳转后 `weekOffset ≠ 0` 时「返回本周」按钮自然出现（现有行为，不改）
- CalendarView 传入 `onJumpToWeek={handleJumpToWeek}`

**为什么强制切 7 天模式：** weekOffset 语义为 anchor = 今天 + offset×7，offset 只能保证 anchor 落在目标周内；3 天模式窗口是 [anchor, anchor+2]，目标日可能在窗口外（如目标日为周四、anchor 为周一）。切到 7 天模式保证目标日必然显示。

## 文件清单

| 文件 | 改动 |
|------|------|
| `src/components/CalendarView.tsx` | 居中布局、删除把手、opacity 动画、footer 双按钮、新增 `onJumpToWeek` prop |
| `app/index.tsx` | `dayMode` 状态提升、`handleJumpToWeek`、date-fns import、传参 |
| `src/components/CourseSchedule.tsx` | `dayMode` 改为受控 prop（删除内部 useState），按钮改调 `onDayModeChange` |

## 边界情况

| 场景 | 行为 |
|------|------|
| 减少动态效果开启 | 弹窗直接显示/隐藏（无淡入淡出），跳转功能不受影响 |
| 3 天模式下跳转 | 自动切到 7 天模式，目标日所在周完整显示 |
| 跳转目标日 = 今天所在周 | offset = 0，「返回本周」按钮不出现（weekOffset === 0） |
| 弹窗打开时快速重复点击日期 | 被 scrim 遮挡，无法触发（现状不变） |
| 点击「跳转」后 | 视图立即切换到周视图（CalendarView 卸载，弹窗随视图切换消失） |

## 范围外

- 弹窗内容（课程列表展示形式）不改
- 「返回本周」按钮行为不改
- 周视图内部动画/布局不改

## 验证

- 命令：`npm run typecheck`、`npm run lint`（项目无测试套件）
- 真机清单：
  1. 月视图点击日期 → 弹窗屏幕居中、仅淡入出现（无滑动/弹性动画）
  2. 点击遮罩或「关闭」→ 仅淡出后消失
  3. 弹窗点「跳转到周视图」→ 切换到周视图，显示目标日所在周（周一到周日完整可见）
  4. 先在周视图切到 3 天模式 → 回月视图点某天跳转 → 自动回到 7 天模式
  5. 跳转后 offset ≠ 0 时「返回本周」按钮出现，点击回到本周
  6. 系统开启「减少动态效果」后，弹窗直接显示/隐藏
