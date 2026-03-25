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

  return {
    theme: (raw.theme ?? 'artsy') as AppTheme,
    language,
    timeDisplay,
    hasCompletedOnboarding: raw.hasCompletedOnboarding ?? false,
    customTags: raw.customTags as CustomTag[] | undefined,
  };
}
