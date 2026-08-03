/**
 * 教务系统地点信息格式化工具
 *
 * 将原始格式 "周范围 星期 节次 校区 教室 教师" 重新组织为：
 * "校区 教室（时间信息 教师; ...）" — 按教室分组合并，教室前置
 *
 * 示例：
 *   输入: "1~14周 周一 第一节~第二节 长安校区 教西C1-203 张永红; 14周 周三 第一节~第二节 长安校区 实验大楼A315 王琳"
 *   输出: "长安校区 教西C1-203（1~14周 周一 第一节~第二节 张永红）; 长安校区 实验大楼A315（14周 周三 第一节~第二节 王琳）"
 */

const CAMPUS_KEYWORDS_ORDERED = ['长安校区', '翠华校区', '友谊校区', '太仓校区'];

/** 判断字符串是否像中文姓名（2-4个汉字） */
function looksLikeChineseName(text: string): boolean {
  return /^[一-鿿]{2,4}$/.test(text);
}

interface ParsedSegment {
  timeInfo: string;
  campus: string;
  building: string;
  teacher: string;
}

/**
 * 解析单个地点段落，提取时间信息、校区、教室、教师
 * 段落格式: "{周范围} {星期} {节次} {校区} {教室} {教师}"
 */
function parseSegment(segment: string): ParsedSegment | null {
  // 找到校区关键词位置
  let campusIdx = -1;
  let foundCampus = '';

  for (const kw of CAMPUS_KEYWORDS_ORDERED) {
    const idx = segment.indexOf(kw);
    if (idx >= 0 && (campusIdx < 0 || idx < campusIdx)) {
      campusIdx = idx;
      foundCampus = kw;
    }
  }

  if (campusIdx < 0) {
    return null; // 无法识别校区，保留原样
  }

  const timeInfo = segment.slice(0, campusIdx).trim();
  const rightPart = segment.slice(campusIdx + foundCampus.length).trim();

  // 分割右侧部分：教室 + 教师（教师总是在最后）
  const parts = rightPart.split(/\s+/).filter(Boolean);
  let building: string;
  let teacher = '';

  if (parts.length >= 2 && looksLikeChineseName(parts[parts.length - 1])) {
    teacher = parts[parts.length - 1];
    building = parts.slice(0, -1).join(' ');
  } else if (parts.length === 1 && looksLikeChineseName(parts[0])) {
    // 只有教师名，没有教室
    teacher = parts[0];
    building = '';
  } else {
    building = rightPart;
  }

  return { timeInfo, campus: foundCampus, building, teacher };
}

/**
 * 将教务系统原始地点字符串格式化为展示友好的格式
 * 按「校区 + 教室」分组，教室前置，时间/教师信息放括号内
 */
export function formatLocationForDisplay(location?: string): string {
  if (!location) return '';

  const segments = location.split(/[;；]/).map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return location;

  // 解析所有段落，无法解析的保留原样
  const parsed: ParsedSegment[] = [];
  for (const seg of segments) {
    const result = parseSegment(seg);
    if (result) {
      parsed.push(result);
    } else {
      // 无法解析的段落原样保留，作为独立组
      parsed.push({ timeInfo: '', campus: '', building: seg, teacher: '' });
    }
  }

  // 按「校区 + 教室」分组
  const groups = new Map<string, ParsedSegment[]>();
  for (const seg of parsed) {
    const key = seg.campus ? `${seg.campus} ${seg.building}` : seg.building;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(seg);
  }

  // 构建输出
  const results: string[] = [];
  for (const [key, segs] of groups) {
    // 检查是否为无法解析的原样内容
    if (!segs[0].campus && !segs[0].timeInfo) {
      results.push(key);
      continue;
    }

    const details = segs.map((s) => {
      let detail = s.timeInfo;
      if (s.teacher) {
        detail += ` ${s.teacher}`;
      }
      return detail;
    });

    results.push(`${key}（${details.join('; ')}）`);
  }

  return results.join('; ');
}
