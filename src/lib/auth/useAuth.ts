import { useEffect, useState, useRef } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authCallbackError, setAuthCallbackError] = useState<string | null>(null);
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

    // Handle callback errors in hash (e.g. otp_expired) and avoid infinite re-trigger on refresh.
    const hashError = parseHashError();
    if (hashError) {
      setAuthCallbackError(hashError);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    // Support future PKCE/code flow: if `?code=` exists, exchange it for session (once per load to avoid duplicate requests in Strict Mode / re-mounts).
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
        setAuthCallbackError(msg.includes('expired') || msg.includes('invalid') ? 'Email link is invalid or has expired. Please request a new link.' : msg);
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

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession) setAuthCallbackError(null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string, options?: { captchaToken?: string }) => {
    const redirectTo = window.location.origin;
    const result = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        ...(options?.captchaToken && { captchaToken: options.captchaToken }),
      },
    });
    return result;
  };

  const verifyEmailOtp = async (email: string, token: string) => {
    return supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
  };

  const signOut = async () => supabase.auth.signOut();

  return { session, user, isLoading, signInWithEmail, verifyEmailOtp, signOut, authCallbackError, clearAuthCallbackError: () => setAuthCallbackError(null) };
}
