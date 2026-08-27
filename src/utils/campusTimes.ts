import type { Campus, SectionTime, Semester } from '@/types';

export type YouyiSeason = 'summer' | 'winter';

// 长安校区 13 节（原 SemesterForm.tsx 中「长安校区」预设）
export const CHANGAN_SECTION_TIMES: SectionTime[] = [
  { start: '08:30', end: '09:15' },
  { start: '09:25', end: '10:10' },
  { start: '10:30', end: '11:15' },
  { start: '11:25', end: '12:10' },
  { start: '12:20', end: '13:05' },
  { start: '13:05', end: '13:50' },
  { start: '14:00', end: '14:45' },
  { start: '14:55', end: '15:40' },
  { start: '16:00', end: '16:45' },
  { start: '16:55', end: '17:40' },
  { start: '19:00', end: '19:45' },
  { start: '19:55', end: '20:40' },
  { start: '20:40', end: '21:25' },
];

// 友谊校区夏季 12 节（原「友谊校区夏季」预设，5月1日–9月30日使用）
export const YOUYI_SUMMER_TIMES: SectionTime[] = [
  { start: '08:00', end: '08:50' },
  { start: '09:00', end: '09:50' },
  { start: '10:10', end: '11:00' },
  { start: '11:10', end: '12:00' },
  { start: '12:20', end: '13:05' },
  { start: '13:05', end: '13:50' },
  { start: '14:30', end: '15:20' },
  { start: '15:30', end: '16:20' },
  { start: '16:40', end: '17:30' },
  { start: '17:40', end: '18:30' },
  { start: '19:30', end: '20:20' },
  { start: '20:30', end: '21:20' },
];

// 友谊校区冬季 12 节（原「友谊校区冬季」预设，10月1日–4月30日使用）
export const YOUYI_WINTER_TIMES: SectionTime[] = [
  { start: '08:00', end: '08:50' },
  { start: '09:00', end: '09:50' },
  { start: '10:10', end: '11:00' },
  { start: '11:10', end: '12:00' },
  { start: '12:20', end: '13:05' },
  { start: '13:05', end: '13:50' },
  { start: '14:00', end: '14:50' },
  { start: '15:00', end: '15:50' },
  { start: '16:10', end: '17:00' },
  { start: '17:10', end: '18:00' },
  { start: '19:00', end: '19:50' },
  { start: '20:00', end: '20:50' },
];

/** 按校区返回预设：友谊 → 夏主冬辅；长安 → 仅一套 */
export function applyCampusPreset(campus: Campus): {
  sectionTimes: SectionTime[];
  altSectionTimes?: SectionTime[];
} {
  if (campus === '友谊') {
    return { sectionTimes: YOUYI_SUMMER_TIMES, altSectionTimes: YOUYI_WINTER_TIMES };
  }
  return { sectionTimes: CHANGAN_SECTION_TIMES };
}

export function sectionTimesEqual(a: SectionTime[], b: SectionTime[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((t, i) => t.start === b[i].start && t.end === b[i].end);
}

/** 5月1日–9月30日（含端点）→ summer；其余（10月1日–4月30日）→ winter */
export function getYouyiSeasonForDate(date: Date): YouyiSeason {
  const md = (date.getMonth() + 1) * 100 + date.getDate();
  return md >= 501 && md <= 930 ? 'summer' : 'winter';
}

/** 统一入口：非友谊/无辅套 → sectionTimes；友谊 → 按日期选夏或冬 */
export function getSectionTimesForDate(semester: Semester, date: Date): SectionTime[] {
  if (semester.campus !== '友谊' || !semester.altSectionTimes) {
    return semester.sectionTimes;
  }
  return getYouyiSeasonForDate(date) === 'summer'
    ? semester.sectionTimes
    : semester.altSectionTimes;
}

/**
 * 查找显示的连续日期序列中时间表更替的位置。
 * 返回 i：更替发生在 days[i-1] 与 days[i] 之间；
 * i === 0：更替发生在 days[0] 前一天与 days[0] 之间（竖线画在首列左缘）；
 * 无更替 → null。
 */
export function findSeasonBoundary(days: Date[]): number | null {
  if (days.length === 0) return null;
  const before = new Date(days[0].getTime() - 24 * 60 * 60 * 1000);
  if (getYouyiSeasonForDate(before) !== getYouyiSeasonForDate(days[0])) {
    return 0;
  }
  for (let i = 1; i < days.length; i++) {
    if (getYouyiSeasonForDate(days[i - 1]) !== getYouyiSeasonForDate(days[i])) {
      return i;
    }
  }
  return null;
}

/**
 * 旧数据迁移（幂等）：识别旧「友谊校区夏季/冬季」预设并补全两套时间。
 * 无变化时返回原引用，调用方可用 `migrated !== semesters` 判断是否需要写回。
 */
export function migrateSemesters(semesters: Semester[]): Semester[] {
  let changed = false;
  const migrated = semesters.map((s): Semester => {
    if (s.campus === '友谊') return s;
    if (sectionTimesEqual(s.sectionTimes, YOUYI_SUMMER_TIMES)) {
      changed = true;
      return {
        ...s,
        campus: '友谊',
        sectionTimes: YOUYI_SUMMER_TIMES,
        altSectionTimes: YOUYI_WINTER_TIMES,
      };
    }
    if (sectionTimesEqual(s.sectionTimes, YOUYI_WINTER_TIMES)) {
      changed = true;
      return {
        ...s,
        campus: '友谊',
        sectionTimes: YOUYI_SUMMER_TIMES,
        altSectionTimes: YOUYI_WINTER_TIMES,
      };
    }
    return s;
  });
  return changed ? migrated : semesters;
}
