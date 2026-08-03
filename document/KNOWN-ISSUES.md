# 已知未修复问题

> 最后更新：2026-08-03

## 1. 编辑表单首次打开时 TextInput 标签闪烁

### 现象
在课程表页面点击课程卡片 → 弹出详情 → 点击编辑按钮进入课程编辑页面时，输入框中的**值**（如 "理论力学"）会先显示，而**标签文字**（如 "课程名称*"）会短暂延迟后才出现（"顿一下"）。学期编辑页面同样存在此问题。

第二次编辑相同课程时表现正常。

### 根因
`react-native-paper` 的 `TextInput` 组件在全新挂载时，`labelLayout.measured` 初始为 `false`，导致标签容器 `opacity` 计算为 `0`（不可见）。需等待原生布局回调返回后，`opacity` 才变为 `1`。

```js
// react-native-paper TextInputFlat.tsx:301-306
opacity:
  parentState.value || parentState.focused
    ? parentState.labelLayout.measured  // 初始为 false
      ? 1
      : 0    // ← 标签不可见
    : 1,
```

完整链路：
1. `react-native-paper` 的 `Modal` 在关闭时 `return null` → 子组件（TextInput）被卸载
2. 再次打开时 TextInput 全新挂载 → `labelLayout.measured = false` → label opacity = 0
3. 原生布局回调 → `measured = true` → opacity 变为 1 → label 突然出现

### 已尝试的修复
- **v1**: 移除 `<Portal>` 包装 → 消除 Portal 异步 setState 延迟（部分改善）
- **v2**: 用自定义 `FormModal` 替代 `react-native-paper` 的 `Modal`，通过 opacity+pointerEvents 切换显隐、关闭后延迟 500ms 卸载子组件 → 消除了第二次打开的闪烁（首次仍存在）
- **v3**: 在父组件中使用 `setTimeout(0)` 分帧，先设值再显示 → 确保值已在位但标签仍需测量

### 根本难点
react-native-paper 的 `TextInput` 组件在首次挂载时必须通过原生 `onLayout` 回调来测量标签布局，这是组件内部的设计，外部无法绕过。唯一的解决办法是让 TextInput **早于 Modal 可见之前完成挂载和测量**，目前的 `FormModal` 延迟卸载方案已将此问题降低为仅影响「冷却后首次打开」（即上次关闭超过 500ms 后）。

### 可能的进一步方向
- 在 app 启动时预挂载不可见的 TextInput 实例（warm-up）
- 或将表单改为使用 React Native 原生 `TextInput` + 自定义标签（放弃 react-native-paper 的 TextInput）
- 或接受此行为，通过骨架屏/加载态掩盖首帧延迟

---

## 2. 动画仅首次播放

### 现象
部分入场动画（如课程列表的 spring 动画）只在页面首次挂载时播放一次，后续切换到该页面不再播放。

### 根因
Expo Router 在 tab 切换时**保持页面挂载**（不卸载）。`CourseList` 中 `AnimatedCard` 的入场动画在 `useEffect` 空依赖数组中触发（仅挂载时执行一次），页面不卸载则动画不重播。

这是架构层面的设计权衡（保持页面存活以提升切换速度 vs 每次切换重新播放动画）。如需重播动画，需要监听 tab 焦点事件（`useFocusEffect`）手动触发。

---

## 3. 首次加载时明显卡顿

### 现象
应用首次打开时页面切换、弹窗打开有明显卡顿感。

### 根因
Zustand `persist` 中间件从 AsyncStorage 异步水化数据。水化完成时所有订阅者同时重渲染，三个 tab 页面的重型组件（CourseSchedule、CalendarView、CourseList）同时挂载并执行首次渲染计算。

### 已完成的优化
- `parseWeeks` / `getWeekNumberForDate` 添加 Map 缓存
- CalendarView / CourseSchedule 使用 `useMemo` 预计算每天课程映射
- 主要组件添加 `React.memo`
- 回调使用 `useCallback` 稳定引用

### 可能的进一步方向
- 添加启动屏幕延迟（splash screen 保持到水化完成）
- 或在 store 中添加 `hydrated` 标志，水化前渲染骨架屏
- 或使用 `useForeground` / `AppState` 延迟非活跃 tab 的首次渲染

---

## 进一步分析与解决方案（2026-08-03）

### 修复进展

2026-08-03 已开始按推荐顺序落地：

- 已为 `courseStore` / `settingsStore` 增加 `hydrated` 状态，启动时保留 splash screen，直到两个 store 都完成水化后再挂载 Tabs。
- 已将 widget 同步延后到水化完成和首屏交互之后执行，避免与首屏渲染争抢 JS 线程。
- 已新增 `AppTextField`，并替换 `CourseForm` / `SemesterForm` 中的 `react-native-paper` `TextInput`，课程/学期编辑表单不再依赖 Paper TextInput 的 label 测量。
- 已将 `document` 目录从 TypeScript 编译范围排除，避免旧资料副本影响源码类型检查。

### 总体判断

当前“不流畅”不是单点问题，而是三个时机问题叠加：

1. **表单打开首帧**：`react-native-paper` 的 `TextInput` label 必须等原生 `onLayout` 测量，导致有值输入框的 label 首帧不可见。
2. **导航切换生命周期**：Expo Router tab 默认保活，页面不会因切换而重新挂载，所以挂载型入场动画只会播放一次。
3. **启动水合风暴**：`courseStore`、`settingsStore` 都使用 Zustand `persist` 异步水合；水合完成后，`_layout`、`ThemeProvider`、`useWidgetDataSync`、首页、管理页和多个重型组件会在短时间内一起响应更新。

因此解决顺序应是：先减少启动阶段同步工作，再处理弹窗首帧，最后决定动画是否需要“每次切换都重播”。

### 关键证据

- `FormModal` 已通过 `mounted` 和 500ms 延迟卸载减少重复挂载，但冷启动/冷却后首次打开仍会新挂载子组件，无法避免 `TextInput` 首次 label 测量。
- `CourseForm` 和 `SemesterForm` 使用 `useLayoutEffect` 在打开时同步重置多个字段，能避免旧值闪现，但也会让表单打开那一帧承担更多 JS 更新。
- `app/_layout.tsx` 直接订阅 `darkMode`、`themeColor`，同时调用 `useWidgetDataSync()`；`ThemeProvider` 和 `useDesignTokens()` 又各自订阅 settings store，水化完成时更新面较大。
- `useWidgetDataSync()` 在 `courses` / `semesters` 变化后会构建 widget 数据并请求更新 widget，这类副作用不应抢占首屏交互。
- `CourseSchedule` 的 `blocksByDay`、`CalendarView` 的 `coursesByDay` 已经做了 `useMemo`，但它们仍然依赖水化后的课程/学期数据，无法从根上避免水化完成那一刻的首次重计算。

### 方案 A：启动水合闸门（最高优先级）

目标：让用户看到的第一个可交互界面只在两个 store 都水化完成后出现，避免“先渲染空数据，再立刻渲染真实数据”的两段式卡顿。

实施要点：

1. 在 `courseStore` 和 `settingsStore` 中增加 `hydrated: boolean`，并使用 `persist.onRehydrateStorage` 在水化结束后置为 `true`。
2. 新增 `useAppHydrated()`，同时读取两个 store 的 hydrated 状态。
3. 在 `app/_layout.tsx` 或一个 `AppBootstrap` 组件中接管 `expo-splash-screen`：
   - 模块加载时 `SplashScreen.preventAutoHideAsync()`。
   - 两个 store 都 hydrated 后，再 `SplashScreen.hideAsync()`。
   - hydrated 前不要挂载 Tabs 内重型页面，可显示极轻量占位或继续保留原生启动屏。
4. `useWidgetDataSync()` 增加 hydrated 判断，水化前不执行，水化后用 `InteractionManager.runAfterInteractions` 或短延迟把 widget 同步让出首屏。

预期收益：首屏不会经历空数据和真实数据两轮完整渲染；widget 同步不会和首页首次绘制争抢 JS 线程。

验收标准：

- 冷启动时不再先出现空课表再跳到真实课表。
- Android 中低端设备上，启动后首次切换 tab 不应出现明显长帧。
- widget 数据仍能在启动后数秒内正确同步。

### 方案 B：延迟非当前视图/非当前 tab 的重型计算

目标：水化后只渲染当前用户看到的内容，把其他视图推迟到用户真正进入时。

实施要点：

1. 首页当前默认只在 `view === 'calendar'` 时挂载 `CalendarView`，这点是好的；继续保持。
2. 管理页中 `CourseList` 只有进入 `schedule` tab 后才挂载，但 tab 保活后会常驻；可以接受，不建议为了动画强制卸载。
3. 若仍有首启卡顿，可在首页用 focus 状态保护重型组件：
   - 页面未 focus 时只渲染轻量容器。
   - focus 后再挂载 `CourseSchedule`。
4. 对 `CourseSchedule` 的 `blocksByDay` 和 `CalendarView` 的 `coursesByDay`，保留 `useMemo`，但可进一步抽成按 `(semesterId, weekNumber/month, coursesVersion)` 缓存，避免切回页面时重复构建。

预期收益：启动和首次 tab 切换更平滑，计算发生在更接近用户需要的时刻。

验收标准：

- 首页 schedule 视图首次可用时间优先于其他页面完整渲染。
- 切到管理页时可以有轻微首次加载，但不影响首页启动。

### 方案 C：替换表单输入框首帧策略

目标：彻底消除“有值先出现，label 后出现”的观感问题。

优先级建议：

1. **推荐方案：新增 `AppTextField`，用原生 `TextInput` + 自定义静态 label 替代 react-native-paper TextInput。**
   - 表单当前并不依赖 Paper TextInput 的复杂浮动动画。
   - 自定义 label 不需要原生测量即可显示，能从根上解决闪烁。
   - 统一封装 `label`、`required`、`error/helper`、`multiline`、`keyboardType`、主题颜色。
   - 先替换 `CourseForm` 与 `SemesterForm`，再按需替换 `TimeTableEditor`。
2. **保守方案：弹窗打开前预挂载实际表单，等待 1 帧后再淡入。**
   - 修改 `FormModal`：`visible` 变 true 时先 `setMounted(true)`，但 opacity 暂时保持 0；在 `requestAnimationFrame` 后再开始淡入。
   - 这只能提高 label 测量完成概率，不能保证所有设备完全无闪。
3. **不推荐：app 启动时 warm-up 一个隐藏 Paper TextInput。**
   - Paper TextInput 的 label 测量是每个实例自己的 layout 状态，warm-up 其他实例不能保证当前表单实例已测量。
   - 还会增加启动期无意义工作，与首屏优化方向冲突。

预期收益：表单打开首帧稳定，输入框值和 label 同时出现。

验收标准：

- 冷启动后首次编辑课程/学期，label 不再延迟出现。
- 快速连续打开/关闭表单无旧数据闪现。
- 键盘、multiline、数字输入、深色模式均保持正常。

### 方案 D：动画语义重新定义

目标：区分“页面首次出现动画”和“每次回到 tab 都播放动画”，避免为了重播动画破坏页面保活带来的流畅性。

建议：

1. 课程列表卡片入场动画保留为“首次挂载/数据新增”动画。
2. 若产品上确实希望每次回到管理页都有反馈，用 `useFocusEffect` 增加一个轻量页面级淡入/位移动画，不要让每张卡片都重新 spring。
3. 对新增课程，只给新增 item 播放动画；已有 item 不重播，减少视觉噪音和 JS/UI 工作。
4. 尊重 `useReducedMotion()`，当前已有基础支持，应继续保留。

预期收益：切换 tab 的性能优先，动画只服务状态变化，不成为额外卡顿源。

验收标准：

- tab 切换无明显掉帧。
- 新增课程时有局部反馈。
- 开启减少动态效果后动画被禁用或明显减弱。

### 推荐落地顺序

1. **第 1 阶段：水合闸门 + 延迟 widget 同步**
   - 修改两个 store 的 hydrated 标志。
   - 增加启动屏控制。
   - `useWidgetDataSync` 等水化和首屏交互完成后再运行。

2. **第 2 阶段：表单输入框替换**
   - 新增 `AppTextField`。
   - 替换 `CourseForm` / `SemesterForm` 中的 Paper `TextInput`。
   - 保留 `FormModal` 延迟卸载，作为减少重复挂载成本的补充。

3. **第 3 阶段：重型视图按需挂载与缓存**
   - 只在 focus 后挂载当前页面重型区域。
   - 评估是否需要按周/月缓存课程映射。

4. **第 4 阶段：动画策略收敛**
   - 明确哪些动画只播放一次，哪些在 focus 时播放。
   - 避免全列表每次重播。

### 风险与取舍

- 启动屏保持到水化完成会让“白屏/启动屏时间”略长，但换来进入应用后的稳定性；这是更适合日程类工具的取舍。
- 自定义输入框需要一次性补齐可访问性、错误态、深色模式样式，但长期可控性高于继续绕 Paper TextInput 的内部测量行为。
- 强制 tab 卸载可以让动画重播，但会牺牲切换速度，不建议作为性能修复手段。

### 建议的性能验证方式

1. 准备一份压力数据：至少 100 门课程，每门 1-3 个时间段，20 周学期。
2. 在 Android 真机 release/dev-client 环境验证，避免只看 Expo Go 或 debug 模式。
3. 记录四个场景：
   - 冷启动到首页可交互。
   - 首页 schedule/calendar 切换。
   - schedule tab 与管理 tab 切换。
   - 冷启动后首次打开课程编辑和学期编辑。
4. 使用 React DevTools Profiler 或 Flipper/Android Studio Profiler 观察 JS 长任务；对关键计算可临时加 `performance.now()` 日志。
