# 月视图日期弹窗优化 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 月视图日期弹窗从底部抽屉改为屏幕居中卡片、仅淡入淡出；footer 增加「跳转到周视图」按钮，点击直接切换到目标日所在周。

**架构：** `CalendarView` 弹窗改用 overlay 容器整体 opacity（withTiming 150ms）淡入淡出并居中布局；`dayMode` 从 `CourseSchedule` 内部状态提升为 HomeScreen 受控 prop（跳转需要跨视图控制显示模式）；跳转通过 `onJumpToWeek(date)` 回调在 HomeScreen 计算 `weekOffset = (目标周周一 − 本周周一)/7`，强制切 7 天模式并切视图。

**技术栈：** React Native + Expo SDK 57、react-native-reanimated、date-fns、TypeScript 6。**本项目无测试套件**（CLAUDE.md 明示），每步验证为 `npm run typecheck`（预期无输出、退出码 0）；最终 `npm run lint` 与真机清单。

**规格：** `docs/superpowers/specs/2026-08-29-calendar-day-dialog-design.md`（已批准）

---

### 任务 1：弹窗改造 — 居中布局 + 纯淡入淡出

**文件：**
- 修改：`src/components/CalendarView.tsx`

- [ ] **步骤 1：更新 reanimated import（withSpring → withTiming）**

将：

```ts
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
```

替换为：

```ts
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
```

- [ ] **步骤 2：替换动画状态与函数（删除 translateY/spring，改为 overlay opacity）**

将组件内：

```ts
  const sheetTranslateY = useSharedValue(400);
```

替换为：

```ts
  // 纯淡入淡出：overlay 容器整体 opacity（scrim + 卡片一起）
  const overlayOpacity = useSharedValue(0);
```

将：

```ts
  const showSheet = useCallback(() => {
    sheetTranslateY.value = reduced ? 0 : withSpring(0, { damping: 20, stiffness: 150 });
  }, [sheetTranslateY, reduced]);

  const hideSheet = useCallback(() => {
    const target = 400;
    if (reduced) {
      sheetTranslateY.value = target;
      runOnJS(setSelectedDay)(null);
      return;
    }
     
    sheetTranslateY.value = withSpring(target, { damping: 20, stiffness: 150 }, () => {
      runOnJS(setSelectedDay)(null);
    });
  }, [sheetTranslateY, reduced]);

  const animatedSheet = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));
```

替换为：

```ts
  const showSheet = useCallback(() => {
    overlayOpacity.value = reduced ? 1 : withTiming(1, { duration: 150 });
  }, [overlayOpacity, reduced]);

  const hideSheet = useCallback(() => {
    if (reduced) {
      overlayOpacity.value = 0;
      runOnJS(setSelectedDay)(null);
      return;
    }
    overlayOpacity.value = withTiming(0, { duration: 150 }, () => {
      runOnJS(setSelectedDay)(null);
    });
  }, [overlayOpacity, reduced]);

  const animatedOverlay = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
```

- [ ] **步骤 3：替换弹窗 JSX（overlay 包 Animated.View、居中卡片、删除把手）**

将整个弹窗块：

```tsx
      {/* Bottom Sheet */}
      {selectedDay ? (
        <View style={styles.sheetOverlay}>
          <Pressable style={[styles.sheetScrim, { backgroundColor: dt.colors.overlay }]} onPress={hideSheet} />
          <Animated.View
            style={[
              styles.bottomSheet,
              {
                backgroundColor: dt.colors.surface,
                borderTopLeftRadius: dt.borderRadius.xl,
                borderTopRightRadius: dt.borderRadius.xl,
              },
              animatedSheet,
            ]}
          >
            <View style={styles.sheetHandle}>
              <View style={[styles.handleBar, { backgroundColor: dt.colors.border }]} />
            </View>
            <Text
              style={{
                fontSize: dt.fontSize.subheading,
                fontWeight: dt.fontWeight.subheading,
                color: dt.colors.text,
                paddingHorizontal: 20,
                paddingBottom: 12,
              }}
            >
              {format(selectedDay.date, 'M月d日 EEEE')}
            </Text>
            <ScrollView style={styles.sheetBody} bounces={false} showsVerticalScrollIndicator={false}>
              {selectedDay.courses.length === 0 ? (
                <Text style={{ color: dt.colors.textMuted, textAlign: 'center', paddingVertical: 24 }}>
                  当天无课程
                </Text>
              ) : (
                selectedDay.courses.map((c) => (
                  <View key={c.id} style={styles.courseItem}>
                    <View
                      style={[
                        styles.courseDot,
                        { backgroundColor: c.color ?? dt.colors.primary },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: dt.fontSize.body, color: dt.colors.text, fontWeight: '500' }}>
                        {c.name}
                      </Text>
                      {c.location ? (
                        <Text style={{ fontSize: dt.fontSize.caption, color: dt.colors.textSecondary, marginTop: 2 }}>
                          {formatLocationForDisplay(c.location)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
            <View style={[styles.sheetFooter, { borderTopColor: dt.colors.border }]}>
              <TouchableOpacity onPress={hideSheet} style={styles.sheetCloseBtn}>
                <Text style={{ color: dt.colors.primary, fontSize: dt.fontSize.body, fontWeight: dt.fontWeight.subheading }}>
                  关闭
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      ) : null}
```

替换为：

```tsx
      {/* Day Dialog — 屏幕居中，仅淡入淡出 */}
      {selectedDay ? (
        <Animated.View style={[styles.sheetOverlay, animatedOverlay]}>
          <Pressable style={[styles.sheetScrim, { backgroundColor: dt.colors.overlay }]} onPress={hideSheet} />
          <View
            style={[
              styles.dayDialog,
              {
                backgroundColor: dt.colors.surface,
                borderRadius: dt.borderRadius.xl,
              },
            ]}
          >
            <Text
              style={{
                fontSize: dt.fontSize.subheading,
                fontWeight: dt.fontWeight.subheading,
                color: dt.colors.text,
                paddingHorizontal: 20,
                paddingBottom: 12,
              }}
            >
              {format(selectedDay.date, 'M月d日 EEEE')}
            </Text>
            <ScrollView style={styles.sheetBody} bounces={false} showsVerticalScrollIndicator={false}>
              {selectedDay.courses.length === 0 ? (
                <Text style={{ color: dt.colors.textMuted, textAlign: 'center', paddingVertical: 24 }}>
                  当天无课程
                </Text>
              ) : (
                selectedDay.courses.map((c) => (
                  <View key={c.id} style={styles.courseItem}>
                    <View
                      style={[
                        styles.courseDot,
                        { backgroundColor: c.color ?? dt.colors.primary },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: dt.fontSize.body, color: dt.colors.text, fontWeight: '500' }}>
                        {c.name}
                      </Text>
                      {c.location ? (
                        <Text style={{ fontSize: dt.fontSize.caption, color: dt.colors.textSecondary, marginTop: 2 }}>
                          {formatLocationForDisplay(c.location)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
            <View style={[styles.sheetFooter, { borderTopColor: dt.colors.border }]}>
              <TouchableOpacity onPress={hideSheet} style={styles.sheetCloseBtn}>
                <Text style={{ color: dt.colors.primary, fontSize: dt.fontSize.body, fontWeight: dt.fontWeight.subheading }}>
                  关闭
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      ) : null}
```

- [ ] **步骤 4：更新样式（居中 overlay、dayDialog、删除把手样式）**

将：

```ts
  sheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
```

替换为：

```ts
  sheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
  },
```

将：

```ts
  bottomSheet: {
    maxHeight: '60%',
    overflow: 'hidden',
  },
  sheetHandle: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
```

替换为：

```ts
  dayDialog: {
    marginHorizontal: 24,
    maxHeight: '60%',
    overflow: 'hidden',
  },
```

- [ ] **步骤 5：运行类型检查**

运行：`npm run typecheck`
预期：无输出，退出码 0

- [ ] **步骤 6：Commit**

```bash
git add src/components/CalendarView.tsx
git commit -m "feat(calendar): 日期弹窗改为居中卡片，仅淡入淡出动画

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### 任务 2：dayMode 受控化（CourseSchedule + HomeScreen）

**文件：**
- 修改：`src/components/CourseSchedule.tsx`
- 修改：`app/index.tsx`

- [ ] **步骤 1：CourseSchedule Props 增加受控字段，删除内部状态**

`src/components/CourseSchedule.tsx` 的 Props 接口，将：

```ts
interface Props {
  semesters: Semester[];
  weekOffset: number;
  onWeekChange: (offset: number) => void;
  onEdit?: (course: Course) => void;
}
```

替换为：

```ts
interface Props {
  semesters: Semester[];
  weekOffset: number;
  dayMode: 7 | 3;
  onWeekChange: (offset: number) => void;
  onDayModeChange: (mode: 7 | 3) => void;
  onEdit?: (course: Course) => void;
}
```

组件函数签名与内部状态，将：

```ts
export const CourseSchedule = memo(function CourseSchedule({ semesters, weekOffset, onWeekChange, onEdit }: Props) {
  const dt = useDesignTokens();
  const courses = useCourseStore((s) => s.courses);
  const deleteCourse = useCourseStore((s) => s.deleteCourse);
  const [dayMode, setDayMode] = useState<7 | 3>(7);
```

替换为：

```ts
export const CourseSchedule = memo(function CourseSchedule({
  semesters,
  weekOffset,
  dayMode,
  onWeekChange,
  onDayModeChange,
  onEdit,
}: Props) {
  const dt = useDesignTokens();
  const courses = useCourseStore((s) => s.courses);
  const deleteCourse = useCourseStore((s) => s.deleteCourse);
```

- [ ] **步骤 2：7天/3天 切换按钮改调 onDayModeChange**

将：

```tsx
          <TouchableOpacity
            onPress={() => {
              setOverride(null);
              setDayMode(7);
            }}
```

替换为：

```tsx
          <TouchableOpacity
            onPress={() => {
              setOverride(null);
              onDayModeChange(7);
            }}
```

将：

```tsx
          <TouchableOpacity
            onPress={() => {
              setOverride(null);
              setDayMode(3);
            }}
```

替换为：

```tsx
          <TouchableOpacity
            onPress={() => {
              setOverride(null);
              onDayModeChange(3);
            }}
```

- [ ] **步骤 3：HomeScreen 提升 dayMode 状态并传入**

`app/index.tsx`，在：

```ts
  const [weekOffset, setWeekOffset] = useState(0);
```

之后加：

```ts
  const [dayMode, setDayMode] = useState<7 | 3>(7);
```

将：

```tsx
        <CourseSchedule
          semesters={effectiveSemesters}
          weekOffset={weekOffset}
          onWeekChange={setWeekOffset}
          onEdit={handleEdit}
        />
```

替换为：

```tsx
        <CourseSchedule
          semesters={effectiveSemesters}
          weekOffset={weekOffset}
          dayMode={dayMode}
          onWeekChange={setWeekOffset}
          onDayModeChange={setDayMode}
          onEdit={handleEdit}
        />
```

- [ ] **步骤 4：运行类型检查**

运行：`npm run typecheck`
预期：无输出，退出码 0

- [ ] **步骤 5：Commit**

```bash
git add src/components/CourseSchedule.tsx app/index.tsx
git commit -m "refactor(schedule): dayMode 提升为 HomeScreen 受控状态

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### 任务 3：跳转按钮与数据流

**文件：**
- 修改：`src/components/CalendarView.tsx`
- 修改：`app/index.tsx`

- [ ] **步骤 1：CalendarView 增加 onJumpToWeek prop 与跳转按钮**

Props 接口，将：

```ts
interface Props {
  courses: Course[];
  semesters: Semester[];
}
```

替换为：

```ts
interface Props {
  courses: Course[];
  semesters: Semester[];
  onJumpToWeek: (date: Date) => void;
}
```

组件签名，将：

```ts
export const CalendarView = memo(function CalendarView({ courses, semesters }: Props) {
```

替换为：

```ts
export const CalendarView = memo(function CalendarView({ courses, semesters, onJumpToWeek }: Props) {
```

footer 块，将：

```tsx
            <View style={[styles.sheetFooter, { borderTopColor: dt.colors.border }]}>
              <TouchableOpacity onPress={hideSheet} style={styles.sheetCloseBtn}>
                <Text style={{ color: dt.colors.primary, fontSize: dt.fontSize.body, fontWeight: dt.fontWeight.subheading }}>
                  关闭
                </Text>
              </TouchableOpacity>
            </View>
```

替换为：

```tsx
            <View style={[styles.sheetFooter, { borderTopColor: dt.colors.border }]}>
              <TouchableOpacity onPress={hideSheet} style={styles.sheetCloseBtn}>
                <Text style={{ color: dt.colors.primary, fontSize: dt.fontSize.body, fontWeight: dt.fontWeight.subheading }}>
                  关闭
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onJumpToWeek(selectedDay.date)}
                style={[styles.jumpBtn, { backgroundColor: dt.colors.primary, borderRadius: dt.borderRadius.pill }]}
                activeOpacity={0.7}
              >
                <Text style={{ color: dt.colors.onPrimary, fontSize: dt.fontSize.body, fontWeight: dt.fontWeight.subheading }}>
                  跳转到周视图
                </Text>
              </TouchableOpacity>
            </View>
```

样式，将：

```ts
  sheetFooter: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
```

替换为：

```ts
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  jumpBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
```

- [ ] **步骤 2：HomeScreen 增加跳转处理与 date-fns import**

`app/index.tsx` 顶部，在 `import { View, TouchableOpacity } from 'react-native';` 之后加：

```ts
import { startOfWeek, differenceInCalendarDays } from 'date-fns';
```

在：

```ts
  const handleNewCourse = useCallback(() => {
    setEditingCourse(null);
    setTimeout(() => setCourseFormVisible(true), 0);
  }, []);
```

之后加：

```ts
  const handleJumpToWeek = useCallback((date: Date) => {
    const targetWeekStart = startOfWeek(date, { weekStartsOn: 1 });
    const todayWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const offset = differenceInCalendarDays(targetWeekStart, todayWeekStart) / 7;
    setWeekOffset(offset);
    setDayMode(7);
    setView('schedule');
  }, []);
```

将：

```tsx
        <CalendarView courses={courses} semesters={effectiveSemesters} />
```

替换为：

```tsx
        <CalendarView courses={courses} semesters={effectiveSemesters} onJumpToWeek={handleJumpToWeek} />
```

- [ ] **步骤 3：运行类型检查**

运行：`npm run typecheck`
预期：无输出，退出码 0

- [ ] **步骤 4：Commit**

```bash
git add src/components/CalendarView.tsx app/index.tsx
git commit -m "feat(calendar): 弹窗增加跳转到周视图按钮

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### 任务 4：Lint 与验证

- [ ] **步骤 1：运行 lint 与最终 typecheck**

运行：`npm run lint`
预期：无 error 输出（如出现与本改动无关的历史 warning，记录但不阻塞）

运行：`npm run typecheck`
预期：无输出，退出码 0

- [ ] **步骤 2：真机验证清单（留待用户执行）**

按规格「验证」一节：

1. 月视图点击日期 → 弹窗屏幕居中、仅淡入出现（无滑动/弹性动画）
2. 点击遮罩或「关闭」→ 仅淡出后消失
3. 弹窗点「跳转到周视图」→ 切换到周视图，显示目标日所在周（周一到周日完整可见）
4. 先在周视图切到 3 天模式 → 回月视图点某天跳转 → 自动回到 7 天模式
5. 跳转后 offset ≠ 0 时「返回本周」按钮出现，点击回到本周
6. 系统开启「减少动态效果」后，弹窗直接显示/隐藏

- [ ] **步骤 3：如有 lint 修复，commit**

```bash
git add <修复涉及的源文件>
git commit -m "chore: lint 修复

Co-Authored-By: Claude <noreply@anthropic.com>"
```

（仅当步骤 1 产生修复改动时执行；不要提交 `.idea/`、`.superpowers/`）
