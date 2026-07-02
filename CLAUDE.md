# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**翱翔课表 (Soaring Schedule)** is a course schedule management app for Northwestern Polytechnical University (NWPU) students. It is built with React Native + Expo (SDK 54), targets Android, and operates fully offline with AsyncStorage as the sole persistence layer.

See `DESIGN.md` for the full design specification — this file covers architecture and workflow, not every feature detail.

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React Native 0.81.5 + Expo SDK 54 |
| Language | TypeScript (strict mode) |
| Routing | Expo Router (file-based) |
| State | Zustand 5.x |
| Storage | `@react-native-async-storage/async-storage` |
| UI | React Native Paper 5.x (single UI library) |
| WebView | `react-native-webview` 13.x |
| Dates | `date-fns` 4.x |
| Widget | `react-native-android-widget` |
| Build | EAS Build |

## Key Design Decisions

- **No MUI** — React Native Paper only, for unified design and smaller bundle
- **No Task (待办) feature** — removed from types, stores, and UI
- **Full dark mode** — app-wide via Paper's theming, not just Widget
- **No `secondaryColor`/`accentColor`** — removed from settingsStore
- **Android only** — no iOS consideration
- **NWPU-specific** —教务 system import stays hardcoded, no abstract import source layer
- **Snackbar replaces Alert.alert()** — for all non-destructive feedback; Alert reserved for delete confirm only

## Commands

```bash
# Start the Expo dev server
npx expo start

# Start with clearing cache
npx expo start -c

# Lint
npx eslint . --ext .ts,.tsx

# Type-check
npx tsc --noEmit

# Build APK (configured in eas.json: development / preview / production)
eas build --platform android --profile preview

# Run a single test (when tests are added)
npx jest --testPathPattern=<test-file-name>
```

## Architecture

### Routing (file-based via Expo Router)

```
app/
├── _layout.tsx     # Root layout: bottom Tab navigator (课表 / 课表管理 / 设置)
├── index.tsx       # Home: weekly grid schedule + course form + widget sync
├── schedule.tsx    # Course management: course list + semester management
└── settings.tsx    # Settings: import / theme / widget preview / backup / debug
```

Three tabs: **课表** (home schedule view), **课表管理** (course/semester management), **设置** (settings).

### Data Flow

```
AsyncStorage
    ├── courseStore (Zustand + persist)     → "soaring-schedule-courses"
    ├── settingsStore (Zustand + persist)   → "soaring-schedule-settings" (includes semesters)
    └── widget data                         → "@soaring_schedule:widget_data"

courseStore.deleteCoursesBySemester() ← called by settingsStore.deleteSemester()
courseStore.adjustCoursesForSemester() ← called by settingsStore.updateSemester() on week/section shrink
courseStore.clearAllCourses()          ← called by settingsStore.formatData()
```

**Two Zustand stores** with cross-store coupling:
- `courseStore` — CRUD for courses, conflict detection, semester-scoped deletion/adjustment
- `settingsStore` — semesters CRUD, app settings (themeColor, darkMode), data format/reset

### Key Data Model

- **Semester** — the time anchor. Defines start/end dates, week count, daily section count, and per-section start/end times. Courses always belong to a semester.
- **Course** — name, semesterId, one or more `TimeSlot`s, plus optional metadata (code, location, teacher, credits, assessment method, color).
- **TimeSlot** — `weekRange` (e.g. "1-16"), `repeatRule` (ALL/ODD/EVEN), `dayOfWeek` (1=Mon), `classSections` (array of section numbers).
- **SectionTime** — per-section start/end time (e.g. "08:30"-"09:15"), stored inside the Semester.

### Component Map

| Component | File | Role |
|-----------|------|------|
| `CourseSchedule` | `src/components/CourseSchedule.tsx` | Weekly grid: days as columns, sections as rows, courses as spanning blocks |
| `CourseForm` | `src/components/CourseForm.tsx` | Add/edit course form with time slot management, week picker, section picker |
| `CourseList` | `src/components/CourseList.tsx` | FlatList of courses filterable by semester |
| `CourseImportWizard` | `src/components/CourseImportWizard.tsx` | 2-step state machine: WebView → select semester → import |
| `JwxtWebView` | `src/components/JwxtWebView.tsx` | WebView loading NWPU教务系统, injects JS to scrape course data |
| `TimeTableEditor` | `src/components/TimeTableEditor.tsx` | Edit per-semester section times with presets |
| `SemesterForm` | `src/components/SemesterForm.tsx` | Create/edit semester metadata |
| `CalendarView` | `src/components/CalendarView.tsx` | Monthly calendar with course dots only (no Task feature) |
| `WidgetPreview` | `src/components/WidgetPreview.tsx` | Inline Widget preview for settings page |

### Critical Utility Modules

- **`src/utils/scheduleDate.ts`** — `findSemesterForDate()`, `getWeekNumberForDate()`, `isWeekInRange()`, `matchesRepeatRule()`.
- **`src/utils/timeConflict.ts`** — `isTimeSlotConflict()`, `isCourseConflict()`.
- **`src/utils/jwxtParser.ts`** — `parseScheduleText()` (8 section-number formats), `enhanceExtractedData()`, `convertToCourses()`, `parseJwxtHtml()`.
- **`src/utils/widgetData.ts`** — Builds and persists widget data snapshot.
- **`src/utils/dataBackup.ts`** — JSON export/import with version field.

### Course Import Pipeline

1. `JwxtWebView` loads `https://ecampus.nwpu.edu.cn/` — user logs in and navigates to schedule page
2. Injected JS (`EXTRACT_DATA_SCRIPT`) scans DOM, extracts course data, posts back via `postMessage`
3. `jwxtParser.enhanceExtractedData()` — fills missing locations, truncates long teacher lists, filters online courses
4. `jwxtParser.parseScheduleText()` — parses schedule text into typed `TimeSlot[]`
5. `jwxtParser.convertToCourses()` — assembles full `Course` objects with color assignment
6. `CourseImportWizard` — user picks target semester, optionally overwrites, writes via `courseStore.addCourse()`

### Widget Architecture

- `useWidgetDataSync` Hook listens to course/semester changes, builds today's courses, saves to AsyncStorage, triggers widget re-render
- `widget-task-handler.tsx` handles widget lifecycle events (ADDED/UPDATE/CLICK)
- Widget auto-refreshes at next-class start time (timer managed within valid semester range only)
- `withHonorWidget.js` Expo plugin for Honor device compatibility

### Theming

- React Native Paper Provider wraps root layout in `app/_layout.tsx`
- `settingsStore.darkMode` chooses `MD3DarkTheme` / `MD3LightTheme` with custom `colors.primary`
- Widget reads dark mode independently via `@soaring_schedule:dark_mode`

## Error Handling Convention

- Use **React Native Paper `Snackbar`** (via global `useSnackbar()` hook) for all feedback: errors, success, warnings
- `Alert.alert()` reserved **only** for destructive confirmations: delete semester, delete course, format data