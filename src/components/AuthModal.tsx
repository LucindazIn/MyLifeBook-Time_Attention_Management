import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, ArrowRight } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppLanguage } from '@/types';
import { cn } from '@/lib/utils';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  language: AppLanguage;
  onSendMagicLink: (email: string, options?: { captchaToken?: string }) => Promise<{ error: any }>;
  onVerifyOtp: (email: string, token: string) => Promise<{ error: any }>;
  errorMessage?: string | null;
  onSkip?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, language, onSendMagicLink, onVerifyOtp, errorMessage, onSkip }) => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const verifyingRef = useRef(false);
  const turnstileRef = useRef<{ reset: () => void } | null>(null);

  const labels = {
    title: language === 'zh' ? '登录以同步' : 'Sign in to sync',
    subtitle: language === 'zh' ? '用邮箱登录即可跨设备同步你的日程。' : 'Use email to sync your schedule across devices.',
    placeholder: language === 'zh' ? '邮箱地址' : 'Email address',
    send: language === 'zh' ? '发送验证码' : 'Send code',
    sent: language === 'zh' ? '已发送到' : 'Sent to',
    tip: language === 'zh'
      ? '请输入邮件中的验证码。'
      : 'Enter the verification code from your email.',
    verify: language === 'zh' ? '验证' : 'Verify',
    resend: language === 'zh' ? '重新发送' : 'Resend',
    otpPlaceholder: language === 'zh' ? '验证码' : 'Verification code',
  };

  const handleSend = async () => {
    const v = email.trim();
    if (!v) return;
    if (sendingRef.current) return;
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setError(language === 'zh' ? '请先完成人机验证' : 'Please complete the verification first');
      return;
    }
    sendingRef.current = true;
    setIsSending(true);
    setError(null);
    try {
      const { error } = await onSendMagicLink(v, { captchaToken: captchaToken || undefined });
      if (error) {
        setError(error.message || 'Failed to send code');
        turnstileRef.current?.reset();
        setCaptchaToken(null);
      } else {
        setSentTo(v);
        setOtp('');
      }
    } finally {
      setIsSending(false);
      sendingRef.current = false;
    }
  };

  const handleVerify = async () => {
    if (!sentTo || !otp.trim()) return;
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setIsVerifying(true);
    setError(null);
    try {
      const { error } = await onVerifyOtp(sentTo, otp.trim());
      if (error) {
        setError(
          language === 'zh'
            ? '验证码错误或已过期，请重新获取。'
            : 'Invalid or expired code. Please request a new one.',
        );
      }
    } finally {
      setIsVerifying(false);
      verifyingRef.current = false;
    }
  };

  const handleResend = () => {
    setSentTo(null);
    setOtp('');
    setError(null);
    turnstileRef.current?.reset();
    setCaptchaToken(null);
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
            <div className="w-full max-w-[31.36rem] rounded-[2rem] shadow-2xl p-0 pointer-events-auto border overflow-hidden" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
              <div className="p-6 pb-4 flex items-center justify-between border-b" style={{ borderColor: 'var(--app-border)' }}>
                <h2 className="text-xl font-serif font-bold text-foreground">{labels.title}</h2>
                {onClose && (
                  <button onClick={onClose} className="p-2 hover:bg-field rounded-full transition-colors">
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                )}
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-foreground">{labels.subtitle}</p>

                {sentTo ? (
                  <>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <div className="text-sm text-emerald-800 font-medium">
                        {labels.sent} <span className="font-semibold">{sentTo}</span>
                      </div>
                      <div className="mt-1 text-xs text-emerald-700">{labels.tip}</div>
                    </div>

                    {errorMessage && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        {language === 'zh' ? `登录失败：${errorMessage}` : `Sign-in failed: ${errorMessage}`}
                      </div>
                    )}

                    <Input
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 12))}
                      placeholder={labels.otpPlaceholder}
                      className="border-border focus:border-accent text-center text-lg tracking-[0.4em]"
                      type="text"
                      inputMode="numeric"
                      maxLength={12}
                      autoFocus
                    />

                    {error && <div className="text-sm text-red-600">{error}</div>}

                    <Button
                      onClick={handleVerify}
                      disabled={otp.length < 6 || isVerifying}
                      className={cn('w-full rounded-xl py-6', isVerifying && 'opacity-80 pointer-events-none')}
                    >
                      <ArrowRight className="w-4 h-4 mr-2" />
                      {labels.verify}
                    </Button>

                    <button
                      type="button"
                      onClick={handleResend}
                      className="w-full text-center text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
                    >
                      {labels.resend}
                    </button>
                  </>
                ) : (
                  <>
                    {errorMessage && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        {language === 'zh'
                          ? `登录失败：${errorMessage}`
                          : `Sign-in failed: ${errorMessage}`}
                      </div>
                    )}

                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={labels.placeholder}
                        className="pl-9 border-border focus:border-accent"
                        type="email"
                        autoFocus
                      />
                    </div>

                    {TURNSTILE_SITE_KEY && (
                      <div className="flex justify-center">
                        <Turnstile
                          ref={turnstileRef}
                          siteKey={TURNSTILE_SITE_KEY}
                          onSuccess={(token) => setCaptchaToken(token)}
                          onExpire={() => setCaptchaToken(null)}
                          options={{ theme: 'light', size: 'normal' }}
                        />
                      </div>
                    )}

                    {error && (
                      <div className="text-sm text-red-600">{error}</div>
                    )}

                    <Button
                      onClick={handleSend}
                      disabled={!email.trim() || isSending || (!!TURNSTILE_SITE_KEY && !captchaToken)}
                      className={cn("w-full rounded-xl py-6", isSending && "opacity-80 pointer-events-none")}
                    >
                      <ArrowRight className="w-4 h-4 mr-2" />
                      {labels.send}
                    </Button>

                    {onSkip && (
                      <button
                        type="button"
                        onClick={onSkip}
                        className="w-full text-center text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
                      >
                        {language === 'zh' ? '暂时跳过' : 'Skip for now'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

