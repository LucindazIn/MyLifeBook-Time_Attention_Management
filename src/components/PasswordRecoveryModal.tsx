import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppLanguage } from '@/types';
import { cn } from '@/lib/utils';

const PIN_LEN = 6;

interface PasswordRecoveryModalProps {
  isOpen: boolean;
  language: AppLanguage;
  onSubmitNewPin: (pin: string) => Promise<{ error?: { message?: string } }>;
}

export const PasswordRecoveryModal: React.FC<PasswordRecoveryModalProps> = ({
  isOpen,
  language,
  onSubmitNewPin,
}) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const labels = {
    title: language === 'zh' ? '设置新登录密码' : 'Set New Login Pin',
    subtitle: language === 'zh' ? '请输入新的6位数字密码。' : 'Enter A New 6-Digit Pin.',
    pin: language === 'zh' ? '新密码' : 'New Pin',
    confirm: language === 'zh' ? '确认新密码' : 'Confirm New Pin',
    submit: language === 'zh' ? '保存' : 'Save',
    submitting: language === 'zh' ? '保存中…' : 'Saving…',
    mismatch:
      language === 'zh' ? '两次输入的密码不一致。' : 'The Two Pins Do Not Match.',
    invalid: language === 'zh' ? '请输入6位数字。' : 'Enter Exactly 6 Digits.',
  };

  const handleSubmit = async () => {
    if (!/^\d{6}$/.test(pin)) {
      setError(labels.invalid);
      return;
    }
    if (pin !== confirmPin) {
      setError(labels.mismatch);
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      const { error: err } = await onSubmitNewPin(pin);
      if (err?.message) {
        setError(err.message);
      } else {
        setPin('');
        setConfirmPin('');
      }
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none"
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
                <span className="w-10" aria-hidden />
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-foreground">{labels.subtitle}</p>
                <Input
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LEN))}
                  placeholder={labels.pin}
                  className="border-border focus:border-accent text-center text-lg tracking-[0.4em]"
                  type="text"
                  inputMode="numeric"
                  maxLength={PIN_LEN}
                  autoComplete="new-password"
                  autoFocus
                />
                <Input
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LEN))}
                  placeholder={labels.confirm}
                  className="border-border focus:border-accent text-center text-lg tracking-[0.4em]"
                  type="text"
                  inputMode="numeric"
                  maxLength={PIN_LEN}
                  autoComplete="new-password"
                />
                {error && <div className="text-sm text-red-600">{error}</div>}
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={pin.length !== PIN_LEN || confirmPin.length !== PIN_LEN || isSubmitting}
                  aria-busy={isSubmitting}
                  className={cn('w-full rounded-xl py-6', isSubmitting && 'pointer-events-none')}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin shrink-0" aria-hidden />
                      {labels.submitting}
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4 mr-2 shrink-0" aria-hidden />
                      {labels.submit}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
