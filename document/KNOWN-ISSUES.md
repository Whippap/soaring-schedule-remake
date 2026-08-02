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
