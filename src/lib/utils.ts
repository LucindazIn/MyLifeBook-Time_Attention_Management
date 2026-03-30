import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { AppTheme, AppLanguage } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const THEMED_NAMES: Record<AppTheme, Record<AppLanguage, string[]>> = {
  tech: {
    en: [
      "System Boot", "Hello World", "Binary Dreams", "Quantum Leap", "Neural Network",
      "Cyber Horizon", "Digital Frontier", "Code & Coffee", "Algorithm of Life", "Future State",
      "Data Stream", "Logic Gate", "Pixel Perfect", "Virtual Reality", "Tech Noir"
    ],
    zh: [
      "系统启动", "你好世界", "二进制之梦", "量子飞跃", "神经网络",
      "赛博地平线", "数字前沿", "代码与咖啡", "生命算法", "未来状态",
      "数据流", "逻辑门", "像素完美", "虚拟现实", "科技黑色"
    ]
  },
  artsy: {
    en: [
      "A Fresh Start", "Unwritten Story", "Canvas of Time", "New Horizons", "Morning Light",
      "Quiet Moments", "Open Possibilities", "Serendipity", "Blank Slate", "Daybreak",
      "Infinite Potential", "A New Chapter", "Silent Morning", "Waiting for Magic", "Clean Slate",
      "Beginning", "First Light", "Morning Dew", "Untouched", "Potential Energy",
      "Today is Yours", "Make it Count", "Breathe In", "Focus & Flow", "Gentle Rhythm",
      "Steady Pace", "Clear Mind", "Bright Outlook", "Calm Waters"
    ],
    zh: [
      "新的开始", "未写的故事", "时间的画布", "新地平线", "晨光",
      "静谧时刻", "无限可能", " serendipity (机缘巧合)", "空白石板", "破晓",
      "无限潜力", "新篇章", "寂静的早晨", "等待魔法", "重新开始",
      "开端", "第一缕光", "晨露", "未触碰", "势能",
      "今天是你的", "让它有意义", "深呼吸", "专注与流动", "温柔的节奏",
      "稳健的步伐", "清澈的心灵", "光明的展望", "平静的水面"
    ]
  },
  anime: {
    en: [
      "Isekai Adventure", "Hero's Journey", "School Days", "Magic Hour", "Power Level 9000",
      "Nakama Forever", "Training Arc", "Slice of Life", "Final Form", "Hidden Village",
      "Spirit World", "Mecha Sunrise", "Kawaii Morning", "Senpai Noticed", "Epic Quest"
    ],
    zh: [
      "异世界冒险", "英雄之旅", "校园日常", "逢魔时刻", "战斗力9000",
      "永远的伙伴", "修行篇章", "生活切片", "最终形态", "隐世之村",
      "灵界", "机甲日出", "可爱的早晨", "前辈注意到了", "史诗任务"
    ]
  },
  minimalist: {
    en: [
      "Focus", "Essence", "Clarity", "Space", "Breathe",
      "Simple", "Pure", "Light", "Calm", "Order",
      "Balance", "Zen", "Now", "Present", "Core"
    ],
    zh: [
      "专注", "本质", "清晰", "空间", "呼吸",
      "简单", "纯粹", "光", "平静", "秩序",
      "平衡", "禅", "当下", "此刻", "核心"
    ]
  },
  nature: {
    en: [
      "Forest Whisper", "Ocean Breeze", "Mountain Peak", "River Flow", "Sunlit Path",
      "Blooming Flower", "Rainy Day", "Starry Night", "Green Leaf", "Wilderness",
      "Desert Wind", "Snowy Peak", "Autumn Leaves", "Spring Bud", "Summer Rain"
    ],
    zh: [
      "森林低语", "海风", "山峰", "河流", "阳光小径",
      "盛开的花", "雨天", "星夜", "绿叶", "荒野",
      "沙漠之风", "雪峰", "秋叶", "春芽", "夏雨"
    ]
  },
  retro: {
    en: [
      "Vintage Vibes", "Old School", "Classic Hits", "Neon Lights", "Cassette Tape",
      "Vinyl Record", "Arcade Game", "Polaroid", "Typewriter", "Jukebox",
      "Disco Ball", "Roller Skates", "Drive-in Movie", "Diner Coffee", "Road Trip"
    ],
    zh: [
      "复古氛围", "老派", "经典金曲", "霓虹灯", "磁带",
      "黑胶唱片", "街机游戏", "拍立得", "打字机", "点唱机",
      "迪斯科球", "旱冰鞋", "汽车电影院", "餐馆咖啡", "公路旅行"
    ]
  }
};

export function getRandomDayName(theme: AppTheme = 'artsy', language: AppLanguage = 'en'): string {
  const names = THEMED_NAMES[theme][language];
  return names[Math.floor(Math.random() * names.length)];
}

const FALLBACK_ACCENT_HEX = '#6366F1';

/** Resolved `--app-accent` as hex for storing event label colors (e.g. when modal opens). */
export function getThemeAccentHex(): string {
  if (typeof document === 'undefined') return FALLBACK_ACCENT_HEX;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--app-accent').trim();
  if (/^#[0-9A-Fa-f]{6}$/i.test(raw)) return raw;
  if (/^#[0-9A-Fa-f]{3}$/i.test(raw) && raw.length === 4) {
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return FALLBACK_ACCENT_HEX;
}
