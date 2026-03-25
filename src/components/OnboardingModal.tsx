import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLanguage, AppSettings } from '@/types';
import { Globe, ArrowRight, LogIn, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

export type OnboardingAuthIntent = 'login' | 'register' | 'skip';

interface OnboardingModalProps {
  onComplete: (settings: AppSettings, authIntent: OnboardingAuthIntent) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete }) => {
  const [step, setStep] = useState<'language' | 'account'>('language');
  const [language, setLanguage] = useState<AppLanguage>('en');

  const handleLanguageSelect = (lang: AppLanguage) => {
    setLanguage(lang);
    setStep('account');
  };

  const finish = (authIntent: OnboardingAuthIntent) => {
    onComplete(
      {
        language,
        theme: 'artsy',
        hasCompletedOnboarding: true,
        hasCompletedPostLoginTheme: false,
        timeDisplay: language === 'zh' ? '24h' : '12h',
      },
      authIntent,
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-[31.36rem] rounded-[2rem] shadow-2xl overflow-hidden border" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
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
                key="account"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center mx-auto text-accent mb-4">
                    <LogIn className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-serif font-bold text-foreground">
                    {language === 'zh' ? '选择账号' : 'Choose Your Account'}
                  </h2>
                  <p className="text-muted-foreground">
                    {language === 'zh'
                      ? '登录以同步日程，或注册新账号；也可稍后在设置中登录。'
                      : 'Sign In To Sync Your Schedule, Register A New Account, Or Continue Later In Settings.'}
                  </p>
                </div>

                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={() => finish('login')}
                    className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-accent hover:bg-field transition-all group"
                  >
                    <span className="flex items-center gap-3 font-medium text-foreground">
                      <LogIn className="w-5 h-5 text-muted-foreground group-hover:text-accent shrink-0" />
                      {language === 'zh' ? '登录' : 'Sign In'}
                    </span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent" />
                  </button>
                  <button
                    type="button"
                    onClick={() => finish('register')}
                    className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-accent hover:bg-field transition-all group"
                  >
                    <span className="flex items-center gap-3 font-medium text-foreground">
                      <UserPlus className="w-5 h-5 text-muted-foreground group-hover:text-accent shrink-0" />
                      {language === 'zh' ? '注册' : 'Sign Up'}
                    </span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent" />
                  </button>
                  <button
                    type="button"
                    onClick={() => finish('skip')}
                    className={cn(
                      'w-full text-center text-sm py-2 rounded-lg text-muted-foreground',
                      'transition-colors hover:text-accent',
                    )}
                  >
                    {language === 'zh' ? '暂时跳过' : 'Skip For Now'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
