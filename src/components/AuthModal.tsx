import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppLanguage } from '@/types';
import { cn } from '@/lib/utils';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';
const PIN_LEN = 6;

/** Footer links: 忘记密码 / 新用户注册 / 暂时跳过 — hover & active feedback */
const authFooterLinkClass =
  'shrink-0 rounded px-1 py-0.5 text-muted-foreground transition-colors duration-150 hover:text-accent active:text-accent/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30';

export type AuthFormMode = 'login' | 'register' | 'forgot';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  language: AppLanguage;
  onSignIn: (
    email: string,
    pin: string,
    options?: { captchaToken?: string },
  ) => Promise<{ error?: { message?: string } }>;
  onSignUp: (
    email: string,
    pin: string,
    options?: { captchaToken?: string },
  ) => Promise<{ error?: { message?: string } }>;
  onResetPassword: (
    email: string,
    options?: { captchaToken?: string },
  ) => Promise<{ error?: { message?: string } }>;
  errorMessage?: string | null;
  onSkip?: () => void;
}

function mapAuthError(raw: string, language: AppLanguage): string {
  const msg = raw.toLowerCase();
  if (/email not confirmed|confirm your email/i.test(raw)) {
    return language === 'zh'
      ? '请先确认邮箱：打开注册时收到的邮件中的链接。'
      : 'Please Confirm Your Email Using The Link In Your Inbox.';
  }
  if (/invalid login|invalid credentials|wrong password/i.test(raw)) {
    return language === 'zh' ? '邮箱或密码不正确。' : 'Invalid Email Or Pin.';
  }
  if (/rate limit|429|too many/i.test(msg)) {
    return language === 'zh'
      ? '尝试次数过多，请稍后再试。'
      : 'Too Many Attempts. Please Try Again Later.';
  }
  if (/captcha|verification process failed/i.test(msg)) {
    return language === 'zh'
      ? '人机验证失败，请重试。'
      : 'Human Verification Failed. Please Try Again.';
  }
  if (/smtp|mail|535|sending/i.test(msg)) {
    return language === 'zh'
      ? '邮件发送失败，请稍后重试或检查 Supabase SMTP 配置。'
      : 'Email Could Not Be Sent. Check Supabase SMTP Or Try Later.';
  }
  return raw;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  language,
  onSignIn,
  onSignUp,
  onResetPassword,
  errorMessage,
  onSkip,
}) => {
  const [mode, setMode] = useState<AuthFormMode>('login');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [registerSent, setRegisterSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const sendingRef = useRef(false);
  const turnstileRef = useRef<{ reset: () => void } | null>(null);

  const labels = {
    title: language === 'zh' ? '登录以同步' : 'Sign In To Sync',
    subtitleRegister:
      language === 'zh'
        ? '使用邮箱与6位数字密码注册；注册后请查收邮件并点击确认链接。'
        : 'Register With Email And A 6-Digit Pin. Then Confirm Your Email.',
    subtitleLogin:
      language === 'zh'
        ? '使用邮箱与6位数字密码登录以跨设备同步。'
        : 'Sign In With Email And Your 6-Digit Pin To Sync Across Devices.',
    subtitleForgot:
      language === 'zh'
        ? '我们将向你的邮箱发送重置链接；请通过邮件中的链接设置新密码。'
        : 'We Will Email You A Link To Set A New Pin.',
    placeholderEmail: language === 'zh' ? '邮箱地址' : 'Email Address',
    passwordLabel: language === 'zh' ? '6位数字密码' : '6-Digit Pin',
    confirmLabel: language === 'zh' ? '确认密码' : 'Confirm Pin',
    login: language === 'zh' ? '登录' : 'Sign In',
    register: language === 'zh' ? '注册' : 'Register',
    forgot: language === 'zh' ? '忘记密码' : 'Forgot Password',
    backToLogin: language === 'zh' ? '返回登录' : 'Back To Sign In',
    needAccount: language === 'zh' ? '新用户注册' : 'Sign Up',
    skipForNow: language === 'zh' ? '暂时跳过' : 'Skip For Now',
    haveAccount: language === 'zh' ? '已有账号？去登录' : 'Have An Account? Sign In',
    sendReset: language === 'zh' ? '发送重置邮件' : 'Send Reset Email',
    sending: language === 'zh' ? '处理中…' : 'Working…',
    registerHint:
      language === 'zh'
        ? '请查收邮件（可能在垃圾信箱）并点击确认链接，下次可以用邮箱与密码登录。'
        : 'Check Your Email (It May Be In Spam) And Click The Confirmation Link. Next Time You Can Sign In With Email And Password.',
    resetHint:
      language === 'zh'
        ? '若该邮箱已注册，你将收到一封重置邮件；请查收垃圾邮件箱。'
        : 'If The Email Is Registered, You Will Receive A Reset Link. Check Spam Folder.',
    sendingHint:
      language === 'zh'
        ? '使用人数较多，请耐心等待'
        : 'High Traffic Right Now, Please Wait A Moment',
    backAfterMail: language === 'zh' ? '返回登录' : 'Back To Sign In',
  };

  const captchaRequired = !!TURNSTILE_SITE_KEY;
  const canSubmit =
    email.trim().length > 0 &&
    (!captchaRequired || !!captchaToken) &&
    (mode === 'register'
      ? /^\d{6}$/.test(pin) && pin === confirmPin
      : mode === 'forgot'
        ? true
        : /^\d{6}$/.test(pin));

  const handleSubmit = async () => {
    const v = email.trim();
    if (!v) return;
    if (mode === 'register') {
      if (!/^\d{6}$/.test(pin)) {
        setError(language === 'zh' ? '请输入6位数字密码。' : 'Enter Exactly 6 Digits.');
        return;
      }
      if (pin !== confirmPin) {
        setError(language === 'zh' ? '两次输入的密码不一致。' : 'Pins Do Not Match.');
        return;
      }
    }
    if (mode === 'login' && !/^\d{6}$/.test(pin)) {
      setError(language === 'zh' ? '请输入6位数字密码。' : 'Enter Exactly 6 Digits.');
      return;
    }
    if (sendingRef.current) return;
    if (captchaRequired && !captchaToken) {
      setError(language === 'zh' ? '请先完成人机验证' : 'Please Complete The Verification First');
      return;
    }
    sendingRef.current = true;
    setIsSending(true);
    setError(null);
    try {
      const opts = captchaToken ? { captchaToken } : undefined;
      if (mode === 'login') {
        const { error: err } = await onSignIn(v, pin, opts);
        if (err?.message) {
          setError(mapAuthError(err.message, language));
        }
      } else if (mode === 'register') {
        const { error: err } = await onSignUp(v, pin, opts);
        if (err?.message) {
          setError(mapAuthError(err.message, language));
        } else {
          setRegisterSent(true);
        }
      } else {
        const { error: err } = await onResetPassword(v, opts);
        if (err?.message) {
          setError(mapAuthError(err.message, language));
        } else {
          setResetSent(true);
        }
      }
    } finally {
      setIsSending(false);
      sendingRef.current = false;
    }
  };

  const switchMode = (m: AuthFormMode) => {
    setMode(m);
    setError(null);
    setPin('');
    setConfirmPin('');
    setRegisterSent(false);
    setResetSent(false);
    turnstileRef.current?.reset();
    setCaptchaToken(null);
  };

  const subtitle =
    mode === 'register'
      ? labels.subtitleRegister
      : mode === 'forgot'
        ? labels.subtitleForgot
        : labels.subtitleLogin;

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
            <div
              className="w-full max-w-[31.36rem] rounded-[2rem] shadow-2xl p-0 pointer-events-auto border overflow-hidden"
              style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
            >
              <div
                className="p-6 pb-4 flex items-center justify-between border-b"
                style={{ borderColor: 'var(--app-border)' }}
              >
                <h2 className="text-xl font-serif font-bold text-foreground">{labels.title}</h2>
                {onClose && (
                  <button onClick={onClose} className="p-2 hover:bg-field rounded-full transition-colors">
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                )}
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-foreground">{subtitle}</p>

                {registerSent ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      {labels.registerHint}
                    </div>
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="w-full text-center text-sm text-muted-foreground transition-colors hover:text-accent active:text-accent/75"
                    >
                      {labels.backAfterMail}
                    </button>
                  </div>
                ) : resetSent ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      {labels.resetHint}
                    </div>
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="w-full text-center text-sm text-muted-foreground transition-colors hover:text-accent active:text-accent/75"
                    >
                      {labels.backAfterMail}
                    </button>
                  </div>
                ) : (
                  <>
                    {errorMessage && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        {language === 'zh' ? `登录失败：${errorMessage}` : `Sign-In Failed: ${errorMessage}`}
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                        <Input
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder={labels.placeholderEmail}
                          className="pl-9 border-border focus:border-accent"
                          type="email"
                          autoComplete="email"
                          autoFocus
                        />
                      </div>

                      {mode !== 'forgot' && (
                        <>
                          <Input
                            value={pin}
                            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LEN))}
                            placeholder={labels.passwordLabel}
                            className="border-border focus:border-accent text-center text-lg tracking-[0.4em]"
                            type="text"
                            inputMode="numeric"
                            maxLength={PIN_LEN}
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                          />
                          {mode === 'register' && (
                            <Input
                              value={confirmPin}
                              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LEN))}
                              placeholder={labels.confirmLabel}
                              className="border-border focus:border-accent text-center text-lg tracking-[0.4em]"
                              type="text"
                              inputMode="numeric"
                              maxLength={PIN_LEN}
                              autoComplete="new-password"
                            />
                          )}
                        </>
                      )}
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

                    {error && <div className="text-sm text-red-600">{error}</div>}

                    <div className="space-y-2">
                      <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!canSubmit || isSending}
                        aria-busy={isSending}
                        aria-describedby={isSending ? 'auth-send-hint' : undefined}
                        className={cn('w-full rounded-xl py-6', isSending && 'pointer-events-none')}
                      >
                        {isSending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin shrink-0" aria-hidden />
                            {labels.sending}
                          </>
                        ) : (
                          <>
                            <ArrowRight className="w-4 h-4 mr-2 shrink-0" aria-hidden />
                            {mode === 'login'
                              ? labels.login
                              : mode === 'register'
                                ? labels.register
                                : labels.sendReset}
                          </>
                        )}
                      </Button>
                      {isSending && (
                        <p
                          id="auth-send-hint"
                          className="text-xs text-center leading-snug"
                          style={{ color: 'var(--app-muted)' }}
                        >
                          {labels.sendingHint}
                        </p>
                      )}
                    </div>

                    <div
                      className={
                        mode === 'login'
                          ? 'w-full text-xs sm:text-sm'
                          : 'flex flex-row flex-wrap justify-center items-center gap-x-2 sm:gap-x-4 gap-y-1 text-center text-xs sm:text-sm'
                      }
                    >
                      {mode === 'login' && (
                        <div className="grid w-full grid-cols-3 items-center gap-x-1 gap-y-2">
                          <div className="flex min-w-0 justify-end">
                            <button
                              type="button"
                              onClick={() => switchMode('forgot')}
                              className={cn(authFooterLinkClass, 'max-w-full text-right')}
                            >
                              {labels.forgot}
                            </button>
                          </div>
                          <div className="flex min-w-0 justify-center px-0.5">
                            <button
                              type="button"
                              onClick={() => switchMode('register')}
                              className={cn(authFooterLinkClass, 'text-center')}
                            >
                              {labels.needAccount}
                            </button>
                          </div>
                          <div className="flex min-w-0 justify-start">
                            {onSkip ? (
                              <button type="button" onClick={onSkip} className={cn(authFooterLinkClass, 'text-left')}>
                                {labels.skipForNow}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      )}
                      {mode === 'register' && (
                        <>
                          <button
                            type="button"
                            onClick={() => switchMode('login')}
                            className={authFooterLinkClass}
                          >
                            {labels.haveAccount}
                          </button>
                          {onSkip && (
                            <>
                              <span className="text-muted-foreground/40 select-none shrink-0" aria-hidden>
                                ·
                              </span>
                              <button type="button" onClick={onSkip} className={authFooterLinkClass}>
                                {labels.skipForNow}
                              </button>
                            </>
                          )}
                        </>
                      )}
                      {mode === 'forgot' && (
                        <>
                          <button
                            type="button"
                            onClick={() => switchMode('login')}
                            className={authFooterLinkClass}
                          >
                            {labels.backToLogin}
                          </button>
                          {onSkip && (
                            <>
                              <span className="text-muted-foreground/40 select-none shrink-0" aria-hidden>
                                ·
                              </span>
                              <button type="button" onClick={onSkip} className={authFooterLinkClass}>
                                {labels.skipForNow}
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>

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
