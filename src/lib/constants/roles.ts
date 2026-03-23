/**
 * Preset roles for ScheduleEvent.role.
 * Used in AddEventModal and calendar filter/highlight.
 */
export interface PresetRole {
  id: string;
  nameZh: string;
  nameEn: string;
  description: string;
  color: string; // CSS color for calendar and chips
}

export const PRESET_ROLES: PresetRole[] = [
  {
    id: 'nurturer',
    nameZh: '守护者',
    nameEn: 'Nurturer',
    description: '照顾他人、家庭与关系',
    color: '#EC4899', // pink
  },
  {
    id: 'creator',
    nameZh: '创作者',
    nameEn: 'Creator',
    description: '创作、表达与产出',
    color: '#F59E0B', // amber / warm
  },
  {
    id: 'scholar',
    nameZh: '学者',
    nameEn: 'Scholar',
    description: '学习、研究与深度思考',
    color: '#6366F1', // indigo / cool
  },
  {
    id: 'explorer',
    nameZh: '探索者',
    nameEn: 'Explorer',
    description: '探索、尝试与发现',
    color: '#10B981', // emerald
  },
  {
    id: 'connector',
    nameZh: '链接者',
    nameEn: 'Connector',
    description: '连接人与事、协作与沟通',
    color: '#8B5CF6', // violet
  },
  {
    id: 'visionary',
    nameZh: '愿景者',
    nameEn: 'Visionary',
    description: '方向、战略与愿景',
    color: '#06B6D4', // cyan
  },
  {
    id: 'retreater',
    nameZh: '静修者',
    nameEn: 'Retreater',
    description: '休息、内省与恢复',
    color: '#84CC16', // lime
  },
  {
    id: 'challenger',
    nameZh: '挑战者',
    nameEn: 'Challenger',
    description: '突破、挑战与成长',
    color: '#EF4444', // red
  },
  {
    id: 'grinder',
    nameZh: '执行者',
    nameEn: 'Grinder',
    description: '执行、落地与推进',
    color: '#64748B', // slate / neutral
  },
];

export function getPresetRole(id: string): PresetRole | undefined {
  return PRESET_ROLES.find((r) => r.id === id);
}

export function getRoleColor(roleId: string): string {
  const preset = getPresetRole(roleId);
  if (preset) return preset.color;
  if (roleId.startsWith('custom:')) {
    const seed = roleId.slice(7).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const hue = seed % 360;
    return `hsl(${hue}, 55%, 45%)`;
  }
  return 'var(--app-muted)';
}

export function getRoleDisplayName(roleId: string, language: 'zh' | 'en'): string {
  const preset = getPresetRole(roleId);
  if (preset) return language === 'zh' ? preset.nameZh : preset.nameEn;
  if (roleId.startsWith('custom:')) return roleId.slice(7).trim() || roleId;
  return roleId;
}
