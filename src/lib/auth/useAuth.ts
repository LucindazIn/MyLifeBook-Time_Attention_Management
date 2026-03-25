import { useEffect, useState, useRef, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authCallbackError, setAuthCallbackError] = useState<string | null>(null);
  const [passwordRecoveryPending, setPasswordRecoveryPending] = useState(false);
  const codeExchangeAttemptedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const parseHashError = () => {
      const hash = window.location.hash || '';
      if (!hash.startsWith('#')) return null;
      const params = new URLSearchParams(hash.slice(1));
      const errorCode = params.get('error_code') || params.get('error') || null;
      const errorDesc = params.get('error_description') || null;
      if (!errorCode) return null;

      if (errorCode === 'otp_expired') {
        return 'Email link is invalid or has expired. Please request a new link.';
      }
      return errorDesc ? decodeURIComponent(errorDesc.replace(/\+/g, ' ')) : `Authentication error: ${errorCode}`;
    };

    const hashError = parseHashError();
    if (hashError) {
      setAuthCallbackError(hashError);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const exchangeIfNeeded = async () => {
      if (!code) return;
      if (codeExchangeAttemptedRef.current) return;
      codeExchangeAttemptedRef.current = true;
      try {
        await supabase.auth.exchangeCodeForSession(code);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setAuthCallbackError(
          msg.includes('expired') || msg.includes('invalid')
            ? 'Email link is invalid or has expired. Please request a new link.'
            : msg,
        );
      } finally {
        url.searchParams.delete('code');
        window.history.replaceState(null, '', url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '') + url.hash);
      }
    };

    exchangeIfNeeded()
      .catch(() => {})
      .finally(() => {
        supabase.auth.getSession().then(({ data }) => {
          if (!mounted) return;
          setSession(data.session ?? null);
          setUser(data.session?.user ?? null);
          if (data.session) setAuthCallbackError(null);
          setIsLoading(false);
        });
      });

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecoveryPending(true);
      }
      if (event === 'SIGNED_OUT') {
        setPasswordRecoveryPending(false);
      }
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession) setAuthCallbackError(null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const redirectTo = typeof window !== 'undefined' ? window.location.origin : '';

  const signUpWithPassword = async (email: string, password: string, options?: { captchaToken?: string }) => {
    return supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        ...(options?.captchaToken && { captchaToken: options.captchaToken }),
      },
    });
  };

  const signInWithPassword = async (email: string, password: string, options?: { captchaToken?: string }) => {
    return supabase.auth.signInWithPassword({
      email,
      password,
      options: options?.captchaToken ? { captchaToken: options.captchaToken } : undefined,
    });
  };

  const resetPasswordForEmail = async (email: string, options?: { captchaToken?: string }) => {
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo,
      ...(options?.captchaToken && { captchaToken: options.captchaToken }),
    });
  };

  const completePasswordRecovery = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) {
      setPasswordRecoveryPending(false);
    }
    return { error: error ?? undefined };
  }, []);

  const signOut = async () => supabase.auth.signOut();

  return {
    session,
    user,
    isLoading,
    signUpWithPassword,
    signInWithPassword,
    resetPasswordForEmail,
    completePasswordRecovery,
    passwordRecoveryPending,
    signOut,
    authCallbackError,
    clearAuthCallbackError: () => setAuthCallbackError(null),
  };
}
