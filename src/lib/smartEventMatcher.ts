import type { EventType, ScheduleEvent } from '@/types';
import type { LongTermGoalMetaMap } from '@/lib/longTermGoalMetaStorage';

export type SmartGoalMatch = {
  goalName: string;
  mediumTermGoalId: string;
  score: number;
};

export type SmartTagMatch = {
  roleId?: string;
  eventTag?: string;
  type?: EventType;
  score: number;
};

type KeywordRule = {
  roleId: string;
  tags: string[];
  keywords: string[];
};

const ROLE_RULES: KeywordRule[] = [
  {
    roleId: 'creator',
    tags: ['创作', '自媒体', '写作', '音乐', '审美', '内容', '作品', '拍摄', '剪辑'],
    keywords: ['写', '创作', '内容', '自媒体', 'b站', '小红书', '视频', '音乐', '审美', '作品', '拍摄', '剪辑', '发布', '选题', '脚本'],
  },
  {
    roleId: 'scholar',
    tags: ['学习', '输入', '阅读', '韩语'],
    keywords: ['学习', '复习', '单词', '韩语', '阅读', '课程', '研究', '输入', '笔记', '读书', '例句'],
  },
  {
    roleId: 'challenger',
    tags: ['健身', '运动', '挑战'],
    keywords: ['健身', '训练', '有氧', '力量', '跑步', '运动', '减重', '体重', '瑜伽', '拉伸'],
  },
  {
    roleId: 'visionary',
    tags: ['复盘', '规划', '目标'],
    keywords: ['复盘', '规划', '计划', '目标', 'routine', '规则', '未来', '整理', '总结', '校准'],
  },
  {
    roleId: 'connector',
    tags: ['社交', '关系', 'coffeechat'],
    keywords: ['朋友', '聊天', 'coffee', 'coffeechat', '社交', '沟通', '链接', '约', '见面'],
  },
  {
    roleId: 'retreater',
    tags: ['休息', '恢复', '散步'],
    keywords: ['休息', '睡', '恢复', '散步', '冥想', '放松', '低脑', '下午', '情绪', '独处'],
  },
  {
    roleId: 'nurturer',
    tags: ['家务', '关系', '照顾'],
    keywords: ['家务', '做饭', '清理', '家庭', '照顾', '整理房间', '收纳'],
  },
  {
    roleId: 'explorer',
    tags: ['探索', '体验', '出门'],
    keywords: ['探索', '体验', '出门', '逛', '尝试', '旅行', '城市', '灵感'],
  },
  {
    roleId: 'grinder',
    tags: ['执行', '工作', '推进'],
    keywords: ['工作', '推进', '处理', '执行', '交付', 'remote', '任务', 'deadline', '项目'],
  },
];

const TYPE_RULES: Array<{ type: EventType; keywords: string[] }> = [
  { type: 'meeting', keywords: ['会议', '开会', 'meeting', '沟通', '同步', '对齐', 'coffeechat', '聊天', '见面'] },
  { type: 'reminder', keywords: ['提醒', '记得', '缴费', '预约', 'deadline', '到期'] },
  { type: 'todo', keywords: [] },
];

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '');
}

function eventText(event: ScheduleEvent): string {
  return normalizeText(
    [
      event.title,
      event.description,
      event.meaning,
      event.label?.text,
      ...(event.tags ?? []),
      ...(event.longTermGoals ?? []),
    ]
      .filter(Boolean)
      .join(' ')
  );
}

function tokenScore(text: string, candidate: string): number {
  const normalized = normalizeText(candidate);
  if (!normalized) return 0;
  if (text.includes(normalized)) return Math.min(6, Math.max(2, Math.floor(normalized.length / 2)));
  return 0;
}

function keywordScore(text: string, keywords: string[]): number {
  return keywords.reduce((score, keyword) => score + tokenScore(text, keyword), 0);
}

function pickBestEventTag(text: string, options: string[], fallbackTags: string[]): string | undefined {
  let best = '';
  let bestScore = 0;
  for (const tag of options) {
    const score = tokenScore(text, tag);
    if (score > bestScore) {
      best = tag;
      bestScore = score;
    }
  }
  if (best) return best;

  for (const rule of ROLE_RULES) {
    const score = keywordScore(text, rule.keywords);
    if (score <= 0) continue;
    const matched = rule.tags.find((tag) => options.includes(tag)) || rule.tags[0];
    if (matched) return matched;
  }

  return fallbackTags.find((tag) => options.includes(tag)) || fallbackTags[0];
}

export function smartMatchGoal(event: ScheduleEvent, goalNames: string[], metaMap: LongTermGoalMetaMap): SmartGoalMatch | null {
  const text = eventText(event);
  let best: SmartGoalMatch | null = null;

  for (const goalName of goalNames) {
    const goalScore = tokenScore(text, goalName);
    const mediumGoals = metaMap[goalName]?.mediumTermGoals ?? [];
    for (const medium of mediumGoals) {
      const mediumScore = tokenScore(text, medium.title);
      const score = goalScore + mediumScore * 2;
      if (score > (best?.score ?? 0)) {
        best = { goalName, mediumTermGoalId: medium.id, score };
      }
    }
  }

  if (best && best.score >= 2) return best;
  return null;
}

export function smartMatchTags(event: ScheduleEvent, roleOptions: string[], eventTagOptions: string[]): SmartTagMatch | null {
  const text = eventText(event);
  let bestRoleId = '';
  let bestRoleScore = 0;
  for (const rule of ROLE_RULES) {
    if (!roleOptions.includes(rule.roleId)) continue;
    const score = keywordScore(text, rule.keywords);
    if (score > bestRoleScore) {
      bestRoleId = rule.roleId;
      bestRoleScore = score;
    }
  }

  const type =
    TYPE_RULES.find((rule) => rule.keywords.length > 0 && keywordScore(text, rule.keywords) > 0)?.type ??
    event.type ??
    'todo';

  const roleTags = ROLE_RULES.find((rule) => rule.roleId === bestRoleId)?.tags ?? [];
  const eventTag = pickBestEventTag(text, eventTagOptions, roleTags);
  const score = bestRoleScore + (eventTag ? 2 : 0) + (type ? 1 : 0);

  if (score <= 1) return null;
  return {
    ...(bestRoleId ? { roleId: bestRoleId } : {}),
    ...(eventTag ? { eventTag } : {}),
    type,
    score,
  };
}
