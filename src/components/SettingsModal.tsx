import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Globe, Palette, Check, UserCircle2, LogIn, LogOut, Clock } from 'lucide-react';
import { AppSettings, AppTheme, AppLanguage, TimeDisplayFormat } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  user?: { email?: string } | null;
  onSignIn?: () => void;
  onSignOut?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  user,
  onSignIn,
  onSignOut,
}) => {
  const THEME_TEXT: Record<AppLanguage, Record<AppTheme, { label: string; desc: string }>> = {
    en: {
      tech: { label: 'Tech & Future', desc: 'Cyberpunk, Code' },
      artsy: { label: 'Artsy & Literary', desc: 'Poetry, Art' },
      anime: { label: 'Anime & ACG', desc: 'Vibrant, 2D' },
      minimalist: { label: 'Minimalist', desc: 'Clean, Zen' },
      nature: { label: 'Nature', desc: 'Organic, Earthy' },
      retro: { label: 'Retro', desc: 'Vintage, Classic' },
    },
    zh: {
      tech: { label: '科技未来', desc: '赛博、代码风格' },
      artsy: { label: '文艺范', desc: '诗歌、艺术气质' },
      anime: { label: '二次元', desc: '动漫、ACG 风格' },
      minimalist: { label: '极简主义', desc: '干净、留白、禅意' },
      nature: { label: '自然系', desc: '森林、山川、绿色' },
      retro: { label: '复古怀旧', desc: '经典、老派风格' },
    },
  };

  const themes: { id: AppTheme; label: string; desc: string }[] =
    (Object.keys(THEME_TEXT[settings.language]) as AppTheme[]).map((id) => ({
      id,
      label: THEME_TEXT[settings.language][id].label,
      desc: THEME_TEXT[settings.language][id].desc,
    }));

  const handleThemeSelect = (theme: AppTheme) => {
    onUpdateSettings({ ...settings, theme });
  };

  const handleLanguageSelect = (language: AppLanguage) => {
    onUpdateSettings({ ...settings, language });
  };

  const handleTimeDisplaySelect = (timeDisplay: TimeDisplayFormat) => {
    onUpdateSettings({ ...settings, timeDisplay });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="w-full max-w-[33.87rem] rounded-[2rem] shadow-2xl p-0 pointer-events-auto border overflow-hidden flex flex-col max-h-[85vh]" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
              
              {/* Header */}
              <div className="p-6 pb-4 flex items-center justify-between border-b" style={{ borderColor: 'var(--app-border)' }}>
                <h2 className="text-xl font-serif font-bold" style={{ color: 'var(--app-text)' }}>
                  {settings.language === 'zh' ? '设置' : 'Settings'}
                </h2>
                <button onClick={onClose} className="p-2 rounded-full transition-colors hover:opacity-80" style={{ color: 'var(--app-muted)' }}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-8">

                {/* Account Section */}
                <section>
                  <div className="flex items-center gap-2 mb-4 font-medium text-foreground">
                    <UserCircle2 className="w-4 h-4 text-accent" />
                    {settings.language === 'zh' ? '账号' : 'Account'}
                  </div>
                  {user ? (
                    <div className="flex items-center justify-between p-3 bg-field rounded-xl border border-border">
                      <div>
                        <p className="text-sm font-medium text-foreground">{user.email}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {settings.language === 'zh' ? '已登录，数据自动同步' : 'Signed in · data syncing'}
                        </p>
                      </div>
                      {onSignOut && (
                        <button
                          onClick={onSignOut}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 transition-colors ml-3"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          {settings.language === 'zh' ? '退出' : 'Sign out'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-field rounded-xl border border-border">
                      <p className="text-sm text-muted-foreground">
                        {settings.language === 'zh' ? '登录以跨设备同步数据' : 'Sign in to sync across devices'}
                      </p>
                      {onSignIn && (
                        <button
                          onClick={() => { onSignIn(); onClose(); }}
                          className="flex items-center gap-1.5 text-xs font-medium text-accent hover:opacity-80 transition-colors ml-3 flex-shrink-0"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          {settings.language === 'zh' ? '登录' : 'Sign in'}
                        </button>
                      )}
                    </div>
                  )}
                </section>

                {/* Language Section */}
                <section>
                  <div className="flex items-center gap-2 mb-4 font-medium text-foreground">
                    <Globe className="w-4 h-4 text-accent" />
                    {settings.language === 'zh' ? '语言' : 'Language'}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleLanguageSelect('en')}
                      className={cn(
                        "flex items-center justify-center gap-2 p-3 rounded-xl border transition-all",
                        settings.language === 'en'
                          ? "bg-accent/20 border-accent text-accent ring-1 ring-accent"
                          : "bg-field border-border text-foreground hover:border-accent"
                      )}
                    >
                      <span>English</span>
                      {settings.language === 'en' && <Check className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={() => handleLanguageSelect('zh')}
                      className={cn(
                        "flex items-center justify-center gap-2 p-3 rounded-xl border transition-all",
                        settings.language === 'zh'
                          ? "bg-accent/20 border-accent text-accent ring-1 ring-accent"
                          : "bg-field border-border text-foreground hover:border-accent"
                      )}
                    >
                      <span>中文</span>
                      {settings.language === 'zh' && <Check className="w-3 h-3" />}
                    </button>
                  </div>
                </section>

                {/* Time display */}
                <section>
                  <div className="flex items-center gap-2 mb-4 font-medium text-foreground">
                    <Clock className="w-4 h-4 text-accent" />
                    {settings.language === 'zh' ? '时间显示' : 'Time Display'}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleTimeDisplaySelect('12h')}
                      className={cn(
                        'flex items-center justify-center gap-2 p-3 rounded-xl border transition-all',
                        settings.timeDisplay === '12h'
                          ? 'bg-accent/20 border-accent text-accent ring-1 ring-accent'
                          : 'bg-field border-border text-foreground hover:border-accent'
                      )}
                    >
                      <span>{settings.language === 'zh' ? '12 小时制' : '12 Hour'}</span>
                      {settings.timeDisplay === '12h' && <Check className="w-3 h-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTimeDisplaySelect('24h')}
                      className={cn(
                        'flex items-center justify-center gap-2 p-3 rounded-xl border transition-all',
                        settings.timeDisplay === '24h'
                          ? 'bg-accent/20 border-accent text-accent ring-1 ring-accent'
                          : 'bg-field border-border text-foreground hover:border-accent'
                      )}
                    >
                      <span>{settings.language === 'zh' ? '24 小时制' : '24 Hour'}</span>
                      {settings.timeDisplay === '24h' && <Check className="w-3 h-3" />}
                    </button>
                  </div>
                </section>

                {/* Theme Section */}
                <section>
                  <div className="flex items-center gap-2 mb-4 font-medium text-foreground">
                    <Palette className="w-4 h-4 text-accent" />
                    {settings.language === 'zh' ? '风格主题' : 'Theme & Vibe'}
                  </div>
                  <div className="grid grid-cols-1 gap-2 px-1">
                    {themes.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => handleThemeSelect(theme.id)}
                        className={cn(
                          "flex items-center p-3 rounded-xl border transition-all text-left",
                          settings.theme === theme.id
                            ? "bg-accent/20 border-accent ring-1 ring-accent ring-inset"
                            : "bg-field border-border hover:border-accent hover:bg-surface"
                        )}
                      >
                        <div className="flex-1">
                          <div className={cn("font-medium", settings.theme === theme.id ? "text-accent" : "text-foreground")}>
                            {theme.label}
                          </div>
                          <div className="text-xs text-muted-foreground">{theme.desc}</div>
                        </div>
                        {settings.theme === theme.id && (
                          <div className="w-5 h-5 bg-accent rounded-full flex items-center justify-center text-white">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </section>

              </div>
              
              <div className="p-6 pt-2 border-t flex-shrink-0" style={{ borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                <Button onClick={onClose} className="w-full rounded-xl py-6">
                  {settings.language === 'zh' ? '完成' : 'Done'}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
