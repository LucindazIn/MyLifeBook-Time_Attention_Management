import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { hasUserGeminiKey } from '@/lib/userGeminiKeyStorage';
import type { AppLanguage } from '@/types';
import { UserGeminiKeyRequiredModal } from '@/components/UserGeminiKeyRequiredModal';
import { registerGeminiKeyRequiredModalOpener } from '@/lib/geminiKeyModalBridge';

export type GeminiUserKeyContextValue = {
  /** Returns true if user has saved a key; otherwise opens the required-key modal and returns false. */
  ensureTierBAccess: () => boolean;
  openSettingsForUserGeminiKey: () => void;
};

const GeminiUserKeyContext = createContext<GeminiUserKeyContextValue | null>(null);

export function GeminiUserKeyProvider({
  children,
  language,
  openSettingsForUserGeminiKey,
}: {
  children: React.ReactNode;
  language: AppLanguage;
  openSettingsForUserGeminiKey: () => void;
}) {
  const [tierBModalOpen, setTierBModalOpen] = useState(false);

  const ensureTierBAccess = useCallback(() => {
    if (hasUserGeminiKey()) return true;
    setTierBModalOpen(true);
    return false;
  }, []);

  useEffect(() => {
    registerGeminiKeyRequiredModalOpener(() => setTierBModalOpen(true));
    return () => registerGeminiKeyRequiredModalOpener(null);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setTierBModalOpen(false);
    openSettingsForUserGeminiKey();
  }, [openSettingsForUserGeminiKey]);

  return (
    <GeminiUserKeyContext.Provider
      value={{ ensureTierBAccess, openSettingsForUserGeminiKey }}
    >
      {children}
      <UserGeminiKeyRequiredModal
        open={tierBModalOpen}
        onClose={() => setTierBModalOpen(false)}
        onOpenSettings={handleOpenSettings}
        language={language}
      />
    </GeminiUserKeyContext.Provider>
  );
}

export function useGeminiTierBAccess(): GeminiUserKeyContextValue {
  const ctx = useContext(GeminiUserKeyContext);
  if (!ctx) {
    throw new Error('useGeminiTierBAccess must be used within GeminiUserKeyProvider');
  }
  return ctx;
}
