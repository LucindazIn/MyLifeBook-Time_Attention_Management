export type EventType = 'meeting' | 'todo' | 'reminder';

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  endDate?: string; // ISO string
}

export interface EventLabel {
  text: string;
  color: string; // CSS color (e.g. #RRGGBB)
}

export interface ScheduleEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string; // ISO string
  endTime?: string; // ISO string
  type: EventType;
  completed?: boolean;
  recurrence?: RecurrenceRule;
  tags?: string[];
  label?: EventLabel;
  baseEventId?: string; // Used to link generated instances to their parent
  role?: string; // Optional role id (preset or custom, e.g. 'creator', 'custom:My Role')
  /** 一句意义，供回顾与 AI 叙事锚点 */
  meaning?: string;
  /** 星标：GTD/待办重点 */
  starred?: boolean;
  /** 高光：Life Book 叙事里程碑 */
  highlight?: boolean;
  /** 长期目标标签，可选，支持多选 */
  longTermGoals?: string[];
}

export interface DaySchedule {
  date: string; // YYYY-MM-DD
  name?: string; // The "whimsical" name
  events: ScheduleEvent[];
}

export type AppTheme = 'tech' | 'artsy' | 'anime' | 'minimalist' | 'nature' | 'retro';
export type AppLanguage = 'en' | 'zh';
export type TimeDisplayFormat = '12h' | '24h';

export interface CustomTag {
  id: string;
  icon: string;
  name: string;
}

export interface AppSettings {
  theme: AppTheme;
  language: AppLanguage;
  /** 议程等界面上的时钟展示：12 小时制（含 AM/PM）或 24 小时制 */
  timeDisplay: TimeDisplayFormat;
  hasCompletedOnboarding: boolean;
  /** 登录后是否已完成「选主题」一步（新用户登录后展示一次） */
  hasCompletedPostLoginTheme: boolean;
  customTags?: CustomTag[];
}
