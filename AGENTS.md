# AGENTS.md

OpenCode entry point for this repo. Pair with `DESIGN.md` (authoritative spec),
`REQUIREMENTS.md` (legacy v1.1.6 reference), and `CLAUDE.md` (Claude-Code-oriented
summary). This file covers only high-signal facts an agent would otherwise miss.

## Project status — Phase 8 complete (2026-07-03)

All 8 phases of `DESIGN.md §9` have been implemented. The app compiles, typechecks,
and lints cleanly. No tests exist yet — there is no test runner configured.

## Verification commands

```bash
npx tsc --noEmit           # TypeScript strict type-check (passes, exit 0)
npx eslint .               # ESLint with flat config + eslint-config-expo (passes, exit 0)
npx expo-doctor            # SDK compatibility checks (18/18, exit 0)
npm run typecheck          # alias for tsc --noEmit
npm run lint               # alias for expo lint (uses ESLint under the hood)
```

`npx expo start` can start the Metro bundler but **no device/emulator is available
in this environment** — runtime testing requires a physical Android device or emulator.

## Source of truth

- `DESIGN.md` — authoritative spec (v2.0 remake, dated 2026-07-03). Resolve conflicts here.
- `REQUIREMENTS.md` — original v1.1.6 behavior. **`§5 现有实现附录` references a
  *different* repo** (`soaring-schedule-expo`); its line counts and function indexes
  describe the old codebase, NOT this one. Don't treat those paths/line numbers as
  existing here.
- `CLAUDE.md` — Claude-Code-oriented summary of DESIGN.md. OpenCode reads this file
  (AGENTS.md) instead; keep them reconciled, not duplicated.
- No `opencode.json` exists. `.opencode/skills/` holds **generic process skills**
  (TDD, writing-plans, systematic-debugging, design, etc.), not project-specific ones.

## Quick architecture

```
app/          — Expo Router file-based routing (3 tabs: 课表/课表管理/设置)
src/types/    — Data model: Semester, Course, TimeSlot, RepeatRule, etc.
src/stores/   — Zustand: courseStore + settingsStore (AsyncStorage persist)
src/utils/    — scheduleDate, timeConflict, jwxtParser, widgetData, dataBackup
src/hooks/    — useSnackbar (global Zustand snackbar), useWidgetDataSync
src/components/ — 9 UI components (all Paper-based, dark mode aware)
widgets/      — Android Widget (react-native-android-widget)
plugins/      — withHonorWidget (Honor device compat)
```

## Hard constraints — don't reintroduce (from DESIGN.md §2)

- No Task/待办 feature — removed from types, stores, and UI.
- React Native Paper 5.x **only** — no MUI.
- No `secondaryColor`/`accentColor` in settingsStore.
- Android only — no iOS consideration.
- NWPU教务系统 import stays hardcoded (URL `https://ecampus.nwpu.edu.cn/`) — no abstract import-source layer.
- Full app-wide dark mode via Paper theming (widget reads dark mode independently).
- Snackbar for all non-destructive feedback; `Alert.alert()` reserved for delete
  confirmations only (semester/course delete, format data).

## Persistence & cross-store coupling

AsyncStorage is the **only** persistence layer. Match these keys exactly:

- `soaring-schedule-courses` — courseStore (Zustand + persist)
- `soaring-schedule-settings` — settingsStore (Zustand + persist, includes semesters)
- `@soaring_schedule:widget_data` — widget snapshot
- `@soaring_schedule:dark_mode` — widget's independent dark-mode flag

Two Zustand stores with one-way coupling (settingsStore reaches into courseStore;
never the reverse):

- `settingsStore.deleteSemester()` → `courseStore.deleteCoursesBySemester()`
- `settingsStore.updateSemester()` → `courseStore.adjustCoursesForSemester()` (on week/section shrink)
- `settingsStore.formatData()` → `courseStore.clearAllCourses()`

See DESIGN.md §5 for the full store contract.

## Known quirks & gotchas

- **No babel.config.js** — reanimated 4.x (SDK 54) doesn't need the Babel plugin.
  Modern Expo auto-applies `babel-preset-expo`. Don't re-add babel.config.js unless
  you have a specific reason.
- **expo-file-system 19 new API** — uses `File`/`Directory`/`Paths.cache` classes
  (not the old `writeAsStringAsync`/`readAsStringAsync`/`cacheDirectory` functions).
  See `src/utils/dataBackup.ts` for examples.
- **Paper Text has `variant`, RN Text does not** — components import `Text` from
  `react-native-paper` to use `variant="titleLarge"` etc. Keep this consistent.
- **Widget ColorProp is `#${string}`** — `string` is not assignable to `ColorProp`
  in react-native-android-widget. Cast with `as \`#${string}\``.
- **Widget path alias**: `@/widgets/*` maps to `./widgets/*` (separate from `@/*`
  which maps to `./src/*`). Defined in `tsconfig.json` paths.
- **Theme styles pattern**: components with many hardcoded colors use
  `createThemedStyles(theme)` factories + `useMemo`. Simple cases use inline
  `theme.colors.*` directly. Both approaches coexist — don't force one style.
- **npm script `tsc` is named `typecheck`** — avoids conflict with
  `node_modules/.bin/tsc` (expo-doctor flags the collision). Use `npm run typecheck`
  or `npx tsc --noEmit` directly.
