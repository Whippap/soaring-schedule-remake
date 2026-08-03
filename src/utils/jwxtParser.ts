import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import type { Course, SectionTime, Semester, TimeSlot } from '@/types';
import { AssessmentMethod, IMPORT_COLORS, RepeatRule } from '@/types';
import { formatLocationForDisplay } from '@/utils/locationFormat';

export interface RawCourse {
  name: string;
  code?: string;
  credits?: number;
  teacher?: string;
  assessmentMethod?: string;
  scheduleText: string;
  location?: string;
  dataSemester?: string;
}

export interface RawSemester {
  name: string;
  dataSemester: string;
}

export interface ParsedData {
  semesters: RawSemester[];
  courses: RawCourse[];
}

const ONLINE_KEYWORDS = ['网课', '线上', '在线'];

const CHINESE_NUM_MAP: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
  十一: 11, 十二: 12, 十三: 13, 十四: 14, 十五: 15, 十六: 16,
  十七: 17, 十八: 18, 十九: 19, 二十: 20, 二十一: 21, 二十二: 22,
};

export function chineseNumToArabic(chinese: string): number {
  if (CHINESE_NUM_MAP[chinese]) {
    return CHINESE_NUM_MAP[chinese];
  }
  const n = parseInt(chinese, 10);
  return Number.isNaN(n) ? 0 : n;
}

const DAY_MAP: Record<string, number> = {
  周一: 1, 周二: 2, 周三: 3, 周四: 4, 周五: 5, 周六: 6, 周日: 7, 星期一: 1, 星期二: 2,
  星期三: 3, 星期四: 4, 星期五: 5, 星期六: 6, 星期日: 7, 星期天: 7,
};

const CAMPUS_KEYWORDS = ['长安校区', '翠华校区', '友谊校区', '太仓校区', '长安', '翠华', '友谊', '太仓'];

const LOCATION_PATTERNS: RegExp[] = [
  /(长安校区|翠华校区|友谊校区|太仓校区)\s*([^\s,;，；]+)/,
  /(长安|翠华|友谊|太仓)\s*校区\s*([^\s,;，；]+)/,
  /(\S+楼)\s*([^\s,;，；]+)/,
  /(\S+教学楼)\s*([^\s,;，；]+)/,
  /([ABCEFGSTU教]\s*\d+[-\d]*)/,
  /(\d+室)/,
  /(\d+教室)/,
];

function parseDayOfWeek(text: string): number | null {
  for (const [keyword, value] of Object.entries(DAY_MAP)) {
    if (text.includes(keyword)) {
      return value;
    }
  }
  return null;
}

function parseRepeatRule(text: string): RepeatRule {
  if (text.includes('单周') || text.includes('(单)') || text.includes('（单）')) {
    return RepeatRule.ODD;
  }
  if (text.includes('双周') || text.includes('(双)') || text.includes('（双）')) {
    return RepeatRule.EVEN;
  }
  return RepeatRule.ALL;
}

function parseClassSections(text: string): number[] {
  const chineseRangeMatch = text.match(/第(十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|一|二|三|四|五|六|七|八|九|十)节[~至\-—]?第?(十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|一|二|三|四|五|六|七|八|九|十)?节/);
  if (chineseRangeMatch) {
    const start = chineseNumToArabic(chineseRangeMatch[1]);
    const end = chineseRangeMatch[2] ? chineseNumToArabic(chineseRangeMatch[2]) : start;
    if (start && end && start <= end) {
      return rangeArray(start, end);
    }
  }

  const arabicRangeWithDi = text.match(/第(\d+)[节~至\-](?:第)?(\d+)节/);
  if (arabicRangeWithDi) {
    const start = parseInt(arabicRangeWithDi[1], 10);
    const end = parseInt(arabicRangeWithDi[2], 10);
    if (start >= 1 && end >= 1 && start <= end) {
      return rangeArray(start, end);
    }
  }

  const arabicRangeNoDi = text.match(/(\d+)[节~至\-](\d+)节/);
  if (arabicRangeNoDi) {
    const start = parseInt(arabicRangeNoDi[1], 10);
    const end = parseInt(arabicRangeNoDi[2], 10);
    if (start >= 1 && end >= 1 && start <= end) {
      return rangeArray(start, end);
    }
  }

  const commaWithDi = text.match(/第((?:\d+,)*\d+)节/);
  if (commaWithDi) {
    return commaWithDi[1].split(',').map((n) => parseInt(n, 10)).filter((n) => n >= 1);
  }

  const commaNoDi = text.match(/((?:\d+,)*\d+)节/);
  if (commaNoDi) {
    return commaNoDi[1].split(',').map((n) => parseInt(n, 10)).filter((n) => n >= 1);
  }

  const chineseSingle = text.match(/第(十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|一|二|三|四|五|六|七|八|九|十)节/);
  if (chineseSingle) {
    const n = chineseNumToArabic(chineseSingle[1]);
    if (n) {
      return [n];
    }
  }

  const arabicSingleWithDi = text.match(/第(\d+)节/);
  if (arabicSingleWithDi) {
    const n = parseInt(arabicSingleWithDi[1], 10);
    if (n >= 1) {
      return [n];
    }
  }

  const arabicSingleNoDi = text.match(/(\d+)节/);
  if (arabicSingleNoDi) {
    const n = parseInt(arabicSingleNoDi[1], 10);
    if (n >= 1) {
      return [n];
    }
  }

  return [];
}

function rangeArray(start: number, end: number): number[] {
  const arr: number[] = [];
  for (let i = start; i <= end; i++) {
    arr.push(i);
  }
  return arr;
}

export function parseScheduleText(scheduleText: string): TimeSlot[] {
  if (!scheduleText) {
    return [{ weekRange: '1-16', repeatRule: RepeatRule.ALL, dayOfWeek: 1, classSections: [1] }];
  }

  const cleaned = scheduleText
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const segments = cleaned.split(/[;；]/).map((s) => s.trim()).filter(Boolean);

  const slots: TimeSlot[] = [];

  for (const segment of segments) {
    if (ONLINE_KEYWORDS.some((kw) => segment.includes(kw))) {
      continue;
    }

    const dayOfWeek = parseDayOfWeek(segment);
    if (!dayOfWeek) {
      continue;
    }

    const dayPos = findDayPosition(segment);
    const weekPart = dayPos >= 0 ? segment.slice(0, dayPos) : segment;
    const restPart = dayPos >= 0 ? segment.slice(dayPos) : '';

    const classSections = parseClassSections(restPart || segment);
    if (classSections.length === 0) {
      continue;
    }

    const repeatRule = parseRepeatRule(segment);
    const weekRanges = extractWeekRanges(weekPart);

    for (const wr of weekRanges) {
      slots.push({ weekRange: wr, repeatRule, dayOfWeek, classSections });
    }
  }

  if (slots.length === 0) {
    return [{ weekRange: '1-16', repeatRule: RepeatRule.ALL, dayOfWeek: 1, classSections: [1] }];
  }

  return mergeSlots(slots);
}

function findDayPosition(text: string): number {
  let pos = -1;
  for (const keyword of Object.keys(DAY_MAP)) {
    const idx = text.indexOf(keyword);
    if (idx >= 0 && (pos < 0 || idx < pos)) {
      pos = idx;
    }
  }
  return pos;
}

function extractWeekRanges(weekPart: string): string[] {
  let converted = weekPart
    .replace(/第(十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|二十一|二十二|一|二|三|四|五|六|七|八|九|十)周/g, (_, cn) => `${chineseNumToArabic(cn)}`)
    .replace(/周/g, '');

  converted = converted.trim();
  if (!converted) {
    return ['1-16'];
  }

  const parts = converted.split(',');
  const ranges: string[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    const rangeMatch = trimmed.match(/(\d{1,3})[~至\-—](\d{1,3})/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (start >= 1 && start <= 53 && end >= 1 && end <= 53 && start <= end) {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
      }
      continue;
    }
    const singleMatch = trimmed.match(/(\d{1,3})/);
    if (singleMatch) {
      const n = parseInt(singleMatch[1], 10);
      if (n >= 1 && n <= 53) {
        ranges.push(`${n}`);
      }
    }
  }

  return ranges.length > 0 ? ranges : ['1-16'];
}

function mergeSlots(slots: TimeSlot[]): TimeSlot[] {
  const groups = new Map<string, TimeSlot[]>();
  for (const slot of slots) {
    const key = `${slot.dayOfWeek}:${slot.classSections.join(',')}:${slot.repeatRule}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(slot);
  }

  const merged: TimeSlot[] = [];
  for (const group of groups.values()) {
    const intervals = group.map((s) => {
      const weeks = parseWeeksToList(s.weekRange);
      return { min: weeks.length ? Math.min(...weeks) : 0, max: weeks.length ? Math.max(...weeks) : 0, slot: s };
    });
    intervals.sort((a, b) => a.min - b.min);

    const mergedIntervals: { min: number; max: number }[] = [];
    for (const iv of intervals) {
      const last = mergedIntervals[mergedIntervals.length - 1];
      if (last && iv.min <= last.max + 1) {
        last.max = Math.max(last.max, iv.max);
      } else {
        mergedIntervals.push({ min: iv.min, max: iv.max });
      }
    }

    for (const iv of mergedIntervals) {
      merged.push({
        weekRange: iv.min === iv.max ? `${iv.min}` : `${iv.min}-${iv.max}`,
        repeatRule: group[0].repeatRule,
        dayOfWeek: group[0].dayOfWeek,
        classSections: group[0].classSections,
      });
    }
  }
  return merged;
}

function parseWeeksToList(weekRange: string): number[] {
  const weeks: number[] = [];
  for (const part of weekRange.split(',')) {
    const trimmed = part.trim();
    const dashIndex = trimmed.indexOf('-');
    if (dashIndex >= 0) {
      const s = parseInt(trimmed.slice(0, dashIndex), 10);
      const e = parseInt(trimmed.slice(dashIndex + 1), 10);
      if (!Number.isNaN(s) && !Number.isNaN(e)) {
        for (let w = s; w <= e; w++) weeks.push(w);
      }
    } else {
      const n = parseInt(trimmed, 10);
      if (!Number.isNaN(n)) weeks.push(n);
    }
  }
  return weeks;
}

export function enhanceExtractedData(rawData: ParsedData): ParsedData {
  const enhanced: RawCourse[] = [];
  for (const course of rawData.courses) {
    const allText = `${course.name} ${course.teacher ?? ''} ${course.scheduleText}`;
    if (ONLINE_KEYWORDS.some((kw) => allText.includes(kw))) {
      continue;
    }

    let location = course.location;
    if (!location && course.scheduleText) {
      for (const pattern of LOCATION_PATTERNS) {
        const match = course.scheduleText.match(pattern);
        if (match) {
          location = match[0].trim();
          break;
        }
      }
    }

    let teacher = course.teacher;
    if (teacher) {
      const teachers = teacher.split(/[,，、]/).filter(Boolean);
      if (teachers.length > 15) {
        teacher = `${teachers.slice(0, 15).join('、')} 等`;
      }
    }

    enhanced.push({ ...course, location, teacher });
  }
  return { semesters: rawData.semesters, courses: enhanced };
}

export function convertToCourses(
  parsedCourses: RawCourse[],
  semesterId: string,
  targetDataSemester?: string,
): Course[] {
  const filtered = targetDataSemester
    ? parsedCourses.filter((c) => c.dataSemester === targetDataSemester)
    : parsedCourses;

  const courses: Course[] = [];
  let colorIndex = 0;

  for (const raw of filtered) {
    const timeSlots = parseScheduleText(raw.scheduleText);
    if (timeSlots.length === 0) {
      continue;
    }

    let assessmentMethod: AssessmentMethod | undefined;
    if (raw.assessmentMethod) {
      if (raw.assessmentMethod.includes('考试')) {
        assessmentMethod = AssessmentMethod.EXAM;
      } else if (raw.assessmentMethod.includes('考察')) {
        assessmentMethod = AssessmentMethod.INSPECTION;
      }
    }

    const course: Course = {
      id: uuidv4(),
      name: raw.name,
      semesterId,
      timeSlots,
      code: raw.code || undefined,
      location: formatLocationForDisplay(raw.location) || undefined,
      credits: raw.credits,
      teacher: raw.teacher || undefined,
      assessmentMethod,
      notes: undefined,
      color: IMPORT_COLORS[colorIndex % IMPORT_COLORS.length],
    };
    colorIndex++;
    courses.push(course);
  }

  return courses;
}

export function calculateMaxWeekFromCourses(courses: Course[]): number {
  let max = 20;
  for (const course of courses) {
    for (const slot of course.timeSlots) {
      for (const part of slot.weekRange.split(',')) {
        const trimmed = part.trim();
        const dashIndex = trimmed.indexOf('-');
        const n = dashIndex >= 0 ? parseInt(trimmed.slice(dashIndex + 1), 10) : parseInt(trimmed, 10);
        if (!Number.isNaN(n) && n > max) max = n;
      }
    }
  }
  return max;
}

export function calculateMaxSectionFromCourses(courses: Course[]): number {
  let max = 10;
  for (const course of courses) {
    for (const slot of course.timeSlots) {
      const slotMax = Math.max(...slot.classSections);
      if (slotMax > max) max = slotMax;
    }
  }
  return max;
}

export function parseJwxtHtml(html: string): ParsedData {
  const semesters: RawSemester[] = [];
  const semesterOptionRe = /<option[^>]*value=["']([^"']+)["'][^>]*>([^<]+)<\/option>/g;
  let semMatch;
  while ((semMatch = semesterOptionRe.exec(html)) !== null) {
    semesters.push({ dataSemester: semMatch[1], name: semMatch[2].trim() });
  }
  if (semesters.length === 0) {
    semesters.push({ name: '2025-2026春', dataSemester: '2025-2026-2' });
  }

  const courses: RawCourse[] = [];
  const trRe = /<tr[^>]*class=["'][^"']*lessonInfo[^"']*["'][^>]*>([\s\S]*?)<\/tr>/g;
  let trMatch;
  while ((trMatch = trRe.exec(html)) !== null) {
    const trContent = trMatch[1];
    const nameMatch = trContent.match(/class=["'][^"']*showSchedules[^"']*["'][^>]*>([^<]+)/);
    const h3Match = trContent.match(/<h3[^>]*>([^<]+)<\/h3>/);
    const name = (nameMatch?.[1] ?? h3Match?.[1] ?? '').trim();
    if (name.length < 2) continue;

    const codeMatch = trContent.match(/\[([A-Za-z0-9]+)\]/);
    const creditsMatch = trContent.match(/学分\(([\d.]+)\)/);
    const teacherMatch = trContent.match(/(?:授课教师|教师)[：:]([^<]+)/);
    const assessmentMatch = trContent.match(/(考试|考察)/);
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let tdMatch;
    let scheduleText = '';
    let location = '';
    while ((tdMatch = tdRe.exec(trContent)) !== null) {
      const tdText = tdMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      if (tdText.includes('第') && (tdText.includes('节') || tdText.includes('周'))) {
        scheduleText = tdText;
      }
      for (const kw of CAMPUS_KEYWORDS) {
        if (tdText.includes(kw)) {
          location = tdText;
        }
      }
    }

    if (!scheduleText) {
      const allTds = [...trContent.matchAll(tdRe)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
      scheduleText = allTds.slice(-2).join(' ') || trContent.replace(/<[^>]+>/g, '');
    }

    if (scheduleText.includes('网课')) continue;

    courses.push({
      name,
      code: codeMatch?.[1],
      credits: creditsMatch ? parseFloat(creditsMatch[1]) : undefined,
      teacher: teacherMatch?.[1]?.trim(),
      assessmentMethod: assessmentMatch?.[1],
      scheduleText,
      location: location || undefined,
    });
  }

  if (courses.length === 0) {
    const h3Re = /<h3[^>]*>([^<]+)<\/h3>/g;
    const showSchedRe = /class=["'][^"']*showSchedules[^"']*["'][^>]*>([^<]+)/g;
    const foundNames = new Set<string>();
    let m;
    while ((m = h3Re.exec(html)) !== null) {
      if (m[1].trim().length >= 2) foundNames.add(m[1].trim());
    }
    while ((m = showSchedRe.exec(html)) !== null) {
      if (m[1].trim().length >= 2) foundNames.add(m[1].trim());
    }
    for (const name of foundNames) {
      courses.push({
        name,
        scheduleText: '1-16周 周一 第1-2节',
      });
    }
  }

  return { semesters, courses };
}

export function buildSemesterFromData(
  dataSemester: string,
  name: string,
  existingSectionTimes: SectionTime[],
): Omit<Semester, 'id'> {
  return {
    name,
    startDate: '',
    endDate: '',
    weekCount: 20,
    sectionCount: existingSectionTimes.length || 13,
    sectionTimes: existingSectionTimes.length > 0 ? existingSectionTimes : buildDefaultSectionTimes(13),
  };
}

export function computeMaxWeekAndSection(
  rawCourses: RawCourse[],
): { maxWeek: number; maxSection: number } {
  let maxWeek = 16;
  let maxSection = 8;
  for (const raw of rawCourses) {
    const slots = parseScheduleText(raw.scheduleText);
    for (const slot of slots) {
      for (const part of slot.weekRange.split(',')) {
        const trimmed = part.trim();
        const dashIndex = trimmed.indexOf('-');
        const n = dashIndex >= 0 ? parseInt(trimmed.slice(dashIndex + 1), 10) : parseInt(trimmed, 10);
        if (!Number.isNaN(n) && n > maxWeek) maxWeek = n;
      }
      const slotMax = Math.max(...slot.classSections);
      if (slotMax > maxSection) maxSection = slotMax;
    }
  }
  return { maxWeek, maxSection };
}

export function buildDefaultSectionTimes(count: number): SectionTime[] {
  const times: SectionTime[] = [];
  let cursor = 8 * 60;
  for (let i = 0; i < count; i++) {
    const start = cursor;
    const end = start + 45;
    times.push({ start: formatTime(start), end: formatTime(end) });
    cursor = end + 10;
    if (i === 3) cursor += 80;
  }
  return times;
}

function formatTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const m = (totalMinutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
