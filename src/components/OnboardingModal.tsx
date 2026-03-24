import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppTheme, AppLanguage, AppSettings } from '@/types';
import { Button } from '@/components/ui/button';
import { Check, Palette, Globe, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingModalProps {
  onComplete: (settings: AppSettings) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete }) => {
  const [step, setStep] = useState<'language' | 'theme'>('language');
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [theme, setTheme] = useState<AppTheme>('artsy');

  const handleLanguageSelect = (lang: AppLanguage) => {
    setLanguage(lang);
    setStep('theme');
  };

  const handleThemeSelect = (t: AppTheme) => {
    setTheme(t);
  };

  const handleFinish = () => {
    onComplete({
      language,
      theme,
      hasCompletedOnboarding: true
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
      >
        <div className="p-8">
          <AnimatePresence mode="wait">
            {step === 'language' ? (
              <motion.div
                key="language"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center mx-auto text-accent mb-4">
                    <Globe className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-serif font-bold text-foreground">Welcome</h2>
                  <p className="text-muted-foreground">Choose your preferred language</p>
                </div>

                <div className="grid gap-3">
                  <button
                    onClick={() => handleLanguageSelect('en')}
                    className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-accent hover:bg-field transition-all group"
                  >
                    <span className="font-medium text-foreground">English</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent" />
                  </button>
                  <button
                    onClick={() => handleLanguageSelect('zh')}
                    className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-accent hover:bg-field transition-all group"
                  >
                    <span className="font-medium text-foreground">中文 (Chinese)</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent" />
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="theme"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center mx-auto text-accent mb-4">
                    <Palette className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-serif font-bold text-foreground">
                    {language === 'zh' ? '选择风格' : 'Pick a Vibe'}
                  </h2>
                  <p className="text-muted-foreground">
                    {language === 'zh' ? '这将影响每日名称与小组件的风格' : 'This will inspire your daily names & widgets'}
                  </p>
                </div>

                <div className="grid gap-3 max-h-[60vh] overflow-y-auto">
                  {(language === 'zh'
                    ? [
                        { id: 'tech', label: '科技未来', desc: '赛博、代码、创新' },
                        { id: 'artsy', label: '文艺范', desc: '诗歌、经典艺术、优雅' },
                        { id: 'anime', label: '二次元', desc: '动漫、ACG、梦幻' },
                        { id: 'minimalist', label: '极简主义', desc: '干净、简约、禅意' },
                        { id: 'nature', label: '自然系', desc: '有机、平静、大地气息' },
                        { id: 'retro', label: '复古怀旧', desc: '经典、老派、怀旧' }
                      ]
                    : [
                        { id: 'tech', label: 'Tech & Future', desc: 'Cyberpunk, Code, Innovation' },
                        { id: 'artsy', label: 'Artsy & Literary', desc: 'Poetry, Classic Art, Elegance' },
                        { id: 'anime', label: 'Anime & ACG', desc: 'Vibrant, Dreamy, 2D World' },
                        { id: 'minimalist', label: 'Minimalist', desc: 'Clean, Simple, Zen' },
                        { id: 'nature', label: 'Nature', desc: 'Organic, Calm, Earthy' },
                        { id: 'retro', label: 'Retro', desc: 'Vintage, Nostalgic, Classic' }
                      ]
                  ).map((option) => (
                    <button
                      key={option.id}
                      onClick={() => handleThemeSelect(option.id as AppTheme)}
                      className={cn(
                        "relative flex items-center p-4 rounded-xl border transition-all text-left",
                        theme === option.id 
                          ? "border-accent bg-accent/20 ring-1 ring-accent" 
                          : "border-border hover:border-accent hover:bg-field"
                      )}
                    >
                      <div className="flex-1">
                        <div className="font-medium text-foreground">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.desc}</div>
                      </div>
                      {theme === option.id && (
                        <div className="w-5 h-5 bg-accent rounded-full flex items-center justify-center text-white">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                <Button 
                  onClick={handleFinish}
                  className="w-full py-6 text-lg rounded-xl bg-accent hover:opacity-90 text-white shadow-lg"
                >
                  {language === 'zh' ? '开始使用' : 'Get Started'}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
