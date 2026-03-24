import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Globe, Palette, Check, UserCircle2, LogIn, LogOut, KeyRound } from 'lucide-react';
import { AppSettings, AppTheme, AppLanguage } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { setUserGeminiKey, clearUserGeminiKey, hasUserGeminiKey } from '@/lib/userGeminiKeyStorage';

/** Set to `true` to show the user Gemini API Key block in Settings again. */
const SHOW_USER_GEMINI_KEY_SECTION = false;

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

  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [geminiKeySaved, setGeminiKeySaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setGeminiKeyInput('');
      setGeminiKeySaved(hasUserGeminiKey());
      if (
        SHOW_USER_GEMINI_KEY_SECTION &&
        typeof window !== 'undefined' &&
        window.location.hash === '#gemini'
      ) {
        requestAnimationFrame(() => {
          document.getElementById('settings-gemini')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        });
      }
    }
  }, [isOpen]);

  const handleSaveGeminiKey = () => {
    const v = geminiKeyInput.trim();
    if (!v) return;
    setUserGeminiKey(v);
    setGeminiKeyInput('');
    setGeminiKeySaved(true);
  };

  const handleClearGeminiKey = () => {
    clearUserGeminiKey();
    setGeminiKeyInput('');
    setGeminiKeySaved(false);
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
            <div className="w-full max-w-md rounded-[2rem] shadow-2xl p-0 pointer-events-auto border overflow-hidden flex flex-col max-h-[85vh]" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
              
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

                {/* Gemini API Key (user-owned) — hidden from UI; set SHOW_USER_GEMINI_KEY_SECTION to restore */}
                {SHOW_USER_GEMINI_KEY_SECTION && (
                  <section id="settings-gemini">
                    <div className="flex items-center gap-2 mb-4 font-medium text-foreground">
                      <KeyRound className="w-4 h-4 text-accent" />
                      {settings.language === 'zh' ? 'Gemini API Key（你的密钥）' : 'Your Gemini API Key'}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                      {settings.language === 'zh'
                        ? '密钥仅保存在本机浏览器，不会上传到开发者服务器。用于聊天、随机日程、AI 总结与人生章节；填写后也会优先用于当日名称与日记意义总结。'
                        : 'Stored only in this browser—not sent to our servers. Required for chat, random schedule, AI summaries, and Life Book; when set, it is also preferred for day names and journal summaries.'}
                    </p>
                    {geminiKeySaved && (
                      <p className="text-xs font-medium mb-2" style={{ color: 'var(--app-accent)' }}>
                        {settings.language === 'zh' ? '已在本机保存密钥' : 'A key is saved on this device'}
                      </p>
                    )}
                    <Input
                      type="password"
                      autoComplete="off"
                      value={geminiKeyInput}
                      onChange={(e) => setGeminiKeyInput(e.target.value)}
                      placeholder={
                        settings.language === 'zh'
                          ? '粘贴新的 API Key 后点保存'
                          : 'Paste API key, then Save'
                      }
                      className="rounded-xl mb-2"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="default"
                        className="flex-1 rounded-xl"
                        onClick={handleSaveGeminiKey}
                        disabled={!geminiKeyInput.trim()}
                      >
                        {settings.language === 'zh' ? '保存' : 'Save'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 rounded-xl"
                        onClick={handleClearGeminiKey}
                        disabled={!geminiKeySaved}
                      >
                        {settings.language === 'zh' ? '清除' : 'Clear'}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                        style={{ color: 'var(--app-accent)' }}
                      >
                        {settings.language === 'zh' ? '在 Google AI Studio 获取 Key' : 'Get A Key In Google AI Studio'}
                      </a>
                      {settings.language === 'zh'
                        ? '。建议为 Key 设置 API 限制以降低泄露风险。'
                        : '. Restrict your key in Google Cloud to reduce abuse if exposed.'}
                    </p>
                  </section>
                )}

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

                {/* Theme Section */}
                <section>
                  <div className="flex items-center gap-2 mb-4 font-medium text-foreground">
                    <Palette className="w-4 h-4 text-accent" />
                    {settings.language === 'zh' ? '风格主题' : 'Theme & Vibe'}
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {themes.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => handleThemeSelect(theme.id)}
                        className={cn(
                          "flex items-center p-3 rounded-xl border transition-all text-left",
                          settings.theme === theme.id
                            ? "bg-accent/20 border-accent ring-1 ring-accent"
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
