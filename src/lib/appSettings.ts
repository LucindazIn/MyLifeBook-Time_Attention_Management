import type { AppLanguage, AppSettings, AppTheme, CustomTag, TimeDisplayFormat } from '@/types';

export function normalizeAppSettings(
  raw: Partial<AppSettings> & Record<string, unknown>
): AppSettings {
  const language = (raw.language ?? 'en') as AppLanguage;
  const timeDisplay: TimeDisplayFormat =
    raw.timeDisplay === '12h' || raw.timeDisplay === '24h'
      ? raw.timeDisplay
      : language === 'zh'
        ? '24h'
        : '12h';

  const hasCompletedOnboarding = raw.hasCompletedOnboarding ?? false;
  /** 旧版已在引导里选过主题：本地无此字段且已完成引导 → 视为已选过，避免老用户再弹窗 */
  const hasCompletedPostLoginTheme =
    raw.hasCompletedPostLoginTheme !== undefined
      ? Boolean(raw.hasCompletedPostLoginTheme)
      : hasCompletedOnboarding;

  return {
    theme: (raw.theme ?? 'artsy') as AppTheme,
    language,
    timeDisplay,
    hasCompletedOnboarding,
    hasCompletedPostLoginTheme,
    customTags: raw.customTags as CustomTag[] | undefined,
  };
}
