// 上课提醒排程逻辑验证脚本(Node 环境运行,无需启动 App)
// 运行方式:npx tsx scripts/verify-reminder-scheduler.ts
/// <reference types="node" />

import {
  computeReminderOccurrences,
  formatReminderBody,
  formatReminderLeadMinutes,
  MAX_REMINDERS,
} from '@/utils/reminderScheduler';
import { AssessmentMethod, RepeatRule, type Course, type Semester } from '@/types';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`PASS ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL ${label}\n  expected: ${e}\n  actual:   ${a}`);
  }
}

// 2026-09-21 是周一;学期覆盖 3 周(9/21–10/11)
const semester: Semester = {
  id: 's1',
  name: '2026 秋',
  startDate: '2026-09-21',
  endDate: '2026-10-11',
  weekCount: 3,
  sectionCount: 2,
  sectionTimes: [
    { start: '08:00', end: '08:45' },
    { start: '08:50', end: '09:35' },
  ],
  campus: '长安',
};

let courseId = 0;
function makeCourse(slot: Partial<Course['timeSlots'][number]> & { dayOfWeek: number }): Course {
  courseId += 1;
  return {
    id: `c${courseId}`,
    name: '测试课程',
    semesterId: 's1',
    timeSlots: [{ weekRange: '1-3', repeatRule: RepeatRule.ALL, classSections: [1], ...slot }],
    code: '',
    location: '',
    credits: 2,
    teacher: '',
    assessmentMethod: AssessmentMethod.EXAM,
    notes: '',
    color: '#4285f4',
  };
}

const NOW = new Date(2026, 8, 24, 8, 0); // 2026-09-24(周四)08:00

void (async () => {
  // 1. 文案:含/不含地点
  check(
    'body-with-location',
    formatReminderBody('高等数学', 10, '教西C1-203'),
    '高等数学将在10分钟后开始,上课地点为教西C1-203,请做好准备',
  );
  check('body-no-location', formatReminderBody('高等数学', 10), '高等数学将在10分钟后开始,请做好准备');

  // 2. 周五课程 → 触发时间为上课前 10 分钟
  const friday = makeCourse({ dayOfWeek: 5 });
  const occ = computeReminderOccurrences([friday], [semester], 10, NOW);
  check('friday-count', occ.length, 3);
  check(
    'friday-first-trigger',
    occ[0]!.triggerDate.toISOString(),
    new Date(2026, 8, 25, 7, 50).toISOString(),
  );
  check('friday-first-id', occ[0]!.identifier, 'reminder-c1-0-2026-09-25');

  // 3. 已过时刻不排程
  const lateNow = new Date(2026, 8, 25, 8, 5);
  check('past-trigger-skipped', computeReminderOccurrences([friday], [semester], 10, lateNow).length, 2);

  // 4. 单双周:ODD 在 1/3 周出现
  const odd = makeCourse({ dayOfWeek: 6, repeatRule: RepeatRule.ODD });
  const oddOcc = computeReminderOccurrences([odd], [semester], 10, NOW);
  check('odd-count', oddOcc.length, 2);
  check('odd-dates', oddOcc.map((o) => o.triggerDate.getDate()), [26, 10]);

  // 5. 周次范围 2-3
  const range = makeCourse({ dayOfWeek: 6, weekRange: '2-3' });
  check('week-range-count', computeReminderOccurrences([range], [semester], 10, NOW).length, 2);

  // 6. 友谊校区:夏季 9/25 用主时间表、冬季 10/2 用辅时间表
  const youyi: Semester = {
    ...semester,
    id: 's2',
    campus: '友谊',
    sectionTimes: [{ start: '08:00', end: '08:45' }],
    altSectionTimes: [{ start: '14:00', end: '14:45' }],
  };
  const youyiCourse = makeCourse({ dayOfWeek: 5 });
  const youyiOcc = computeReminderOccurrences(
    [{ ...youyiCourse, semesterId: 's2' }],
    [youyi],
    10,
    NOW,
  );
  check('youyi-summer-trigger', youyiOcc[0]!.triggerDate.getHours(), 7);
  check('youyi-winter-trigger', youyiOcc[1]!.triggerDate.getHours(), 13);

  // 7. 已结束学期不排程
  const pastSemester: Semester = {
    ...semester,
    id: 's3',
    startDate: '2026-01-05',
    endDate: '2026-01-31',
  };
  const pastCourse = { ...makeCourse({ dayOfWeek: 5 }), semesterId: 's3' };
  check(
    'past-semester-skipped',
    computeReminderOccurrences([pastCourse], [pastSemester], 10, NOW).length,
    0,
  );

  // 8. 提前 60 分钟档:08:00 课 → 07:00 触发;标签格式
  const lead60 = computeReminderOccurrences([friday], [semester], 60, NOW);
  check('lead-60-trigger', lead60[0]!.triggerDate.toISOString(), new Date(2026, 8, 25, 7, 0).toISOString());
  check('lead-label-10', formatReminderLeadMinutes(10), '10 分钟');
  check('lead-label-60', formatReminderLeadMinutes(60), '1 小时');
  check('lead-label-120', formatReminderLeadMinutes(120), '2 小时');

  // 9. 上限保护常量
  check('max-reminders-constant', MAX_REMINDERS, 400);

  if (failures > 0) {
    console.error(`\n${failures} 项失败`);
    process.exit(1);
  }
  console.log('\n全部通过');
})();
