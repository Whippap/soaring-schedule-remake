// 教务解析器行为验证脚本（Node 环境下运行，无需启动 App）
// 运行方式：npx tsx scripts/verify-jwxt-parser.ts
// 说明：jwxtParser 顶层 import 'react-native-get-random-values' 仅 RN 环境需要，
// 在 Node 下通过 Module._load 打桩跳过；Node 20 自带 globalThis.crypto，uuid 可正常工作。
// TS 6.0 起 @types 不再自动包含，需显式引用 node 类型（见 microsoft/TypeScript#62195）。
/// <reference types="node" />
import Module from 'module';

const origLoad = (Module as any)._load;
(Module as any)._load = function (request: string, parent: any, isMain: boolean) {
  if (request === 'react-native-get-random-values') return {};
  return origLoad.call(this, request, parent, isMain);
};

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

const BUPOIKE_HTML = [
  '<table>',
  '<tr class="lessonInfo" data-semester="362">',
  '<td class="courseInfo" data-course="科研训练与学科竞赛[U05P61001]">',
  '<p class="showSchedules">科研训练与学科竞赛</p>',
  '<p>U05P61001<i class="operator"></i>实践实训<i class="operator"></i>机电学院</p>',
  '<p><span class="span-gap">学分(2)</span><span class="span-gap">总课时(32)</span><span class="span-gap">已安排课时(0)</span></p>',
  '<p>必修&nbsp;&nbsp;其他</p>',
  '<p>授课教师：冯硕(2024072007)</p>',
  '</td>',
  '<td class="text"><p class="inner">2024级学生</p></td>',
  '<td>不排课</td>',
  '<td><div class="remark">备注：<br></div></td>',
  '</tr>',
  '</table>',
].join('');

const REAL_ROW_HTML = [
  '<table>',
  '<tr class="lessonInfo" data-semester="362">',
  '<td class="courseInfo" data-course="机械设计Ⅰ[U05M11010]">',
  '<p class="showSchedules">机械设计Ⅰ</p>',
  '<p>U05M11010<i class="operator"></i>理论课<i class="operator"></i>机电学院</p>',
  '<p><span class="span-gap">学分(3.5)</span><span class="span-gap">总课时(56)</span><span class="span-gap">已安排课时(56)</span></p>',
  '<p>必修&nbsp;&nbsp;考试</p>',
  '<p>授课教师：李洲洋(2008010095)</p>',
  '</td>',
  '<td class="text"><p class="inner">2024级学生</p></td>',
  '<td>1-14周 周一 第七节~第八节 友谊校区 诚字楼210（李洲洋）</td>',
  '<td><div class="remark">备注：<br></div></td>',
  '</tr>',
  '</table>',
].join('');

async function main() {
  const {
    parseScheduleText,
    parseJwxtHtml,
    isUnscheduledCourse,
    convertToCourses,
    enhanceExtractedData,
  } = await import('@/utils/jwxtParser');

  console.log('== parseScheduleText ==');
  check('空文本返回空数组', parseScheduleText(''), []);
  check('不排课拼接文本返回空数组', parseScheduleText('不排课 备注：'), []);
  check(
    '正常课表文本解析',
    parseScheduleText('1-14周 周一 第七节~第八节'),
    [{ weekRange: '1-14', repeatRule: '', dayOfWeek: 1, classSections: [7, 8] }],
  );

  console.log('== isUnscheduledCourse / convertToCourses / enhanceExtractedData ==');
  check('空 scheduleText 判定为不排课', isUnscheduledCourse({ name: 'x', scheduleText: '' }), true);
  check('不排课拼接文本判定为不排课', isUnscheduledCourse({ name: 'x', scheduleText: '不排课 备注：' }), true);
  check(
    '正常课表文本判定为排课',
    isUnscheduledCourse({ name: 'x', scheduleText: '1-14周 周一 第七节~第八节' }),
    false,
  );
  const converted = convertToCourses(
    [
      { name: '科研训练与学科竞赛', code: 'U05P61001', scheduleText: '' },
      { name: '机械设计Ⅰ', code: 'U05M11010', scheduleText: '1-14周 周一 第七节~第八节' },
    ],
    'sem1',
  );
  check('convertToCourses 跳过不排课课程', converted.length, 1);
  check('convertToCourses 保留排课课程', converted[0]?.name, '机械设计Ⅰ');
  const enhanced = enhanceExtractedData({
    semesters: [],
    courses: [{ name: '科研训练与学科竞赛', scheduleText: '' }],
  });
  check('enhanceExtractedData 保留不排课课程供 UI 展示', enhanced.courses.length, 1);

  console.log('== parseJwxtHtml ==');
  const bupaike = parseJwxtHtml(BUPOIKE_HTML);
  check('不排课行课程数', bupaike.courses.length, 1);
  check('不排课行课程名', bupaike.courses[0]?.name, '科研训练与学科竞赛');
  check('不排课行课程代码', bupaike.courses[0]?.code, 'U05P61001');
  check('不排课行 scheduleText 为空', bupaike.courses[0]?.scheduleText, '');

  const real = parseJwxtHtml(REAL_ROW_HTML);
  check('真实行课程数', real.courses.length, 1);
  check('真实行 scheduleText 含时间', real.courses[0]?.scheduleText?.includes('1-14周') ?? false, true);
  check('真实行 location 含校区', real.courses[0]?.location?.includes('友谊校区'), true);

  const empty = parseJwxtHtml('<div><h3>机械设计Ⅰ</h3></div>');
  check('无 lessonInfo 行时不伪造课程', empty.courses.length, 0);

  if (failures > 0) {
    console.log(`\n${failures} 个用例失败`);
    process.exit(1);
  }
  console.log('\n全部用例通过');
}

void main();
