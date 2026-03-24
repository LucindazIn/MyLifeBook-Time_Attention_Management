import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { KeyRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AppLanguage } from '@/types';

const DOCS_URL = 'https://aistudio.google.com/apikey';

export interface UserGeminiKeyRequiredModalProps {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  language: AppLanguage;
}

export const UserGeminiKeyRequiredModal: React.FC<UserGeminiKeyRequiredModalProps> = ({
  open,
  onClose,
  onOpenSettings,
  language,
}) => {
  const isZh = language === 'zh';

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="w-full max-w-md rounded-3xl shadow-2xl p-6 pointer-events-auto border"
              style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
              role="dialog"
              aria-labelledby="user-gemini-key-title"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 shrink-0" style={{ color: 'var(--app-accent)' }} />
                  <h2 id="user-gemini-key-title" className="text-lg font-semibold" style={{ color: 'var(--app-text)' }}>
                    {isZh ? '需要你的 Gemini API Key' : 'Your Gemini API Key Is Required'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-full hover:opacity-80"
                  style={{ color: 'var(--app-muted)' }}
                  aria-label={isZh ? '关闭' : 'Close'}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm mb-3" style={{ color: 'var(--app-muted)' }}>
                {isZh
                  ? '聊天助手、随机日程、AI 总结与人生章节使用你的密钥与配额；密钥仅保存在本机浏览器，不会上传到开发者服务器。'
                  : 'Chat, random schedule, AI summaries, and Life Book chapters use your key and quota. Your key stays in this browser only—not sent to our servers.'}
              </p>
              <p className="text-sm mb-4" style={{ color: 'var(--app-muted)' }}>
                {isZh ? '获取方式：打开 Google AI Studio，登录后创建 API Key，复制到「设置」中粘贴保存。' : 'Get a key: open Google AI Studio, sign in, create an API key, then paste it in Settings.'}{' '}
                <a
                  href={DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                  style={{ color: 'var(--app-accent)' }}
                >
                  {isZh ? '打开 AI Studio' : 'Open AI Studio'}
                </a>
              </p>
              <div className="flex flex-col gap-2">
                <Button type="button" className="w-full rounded-xl" onClick={onOpenSettings}>
                  {isZh ? '去设置填写' : 'Open Settings'}
                </Button>
                <Button type="button" variant="outline" className="w-full rounded-xl" onClick={onClose}>
                  {isZh ? '稍后' : 'Not Now'}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
