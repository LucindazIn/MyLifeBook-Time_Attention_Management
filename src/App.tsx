import React, { useState, useEffect, useRef, useMemo } from 'react';
import { format, addDays, subDays, isSameDay, isBefore, startOfDay, addYears, subYears, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, eachDayOfInterval } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, Grid, ChevronDown, Check, Settings, Search as SearchIcon, FilterX, BookOpen, Layers, Loader2 } from 'lucide-react';
import { SearchModal } from '@/components/SearchModal';
import { motion, AnimatePresence } from 'motion/react';
import { v4 as uuidv4 } from 'uuid';

import { Timeline } from '@/components/Timeline';
import { DayHeader } from '@/components/DayHeader';
import { AddEventModal } from '@/components/AddEventModal';
import { CalendarView } from '@/components/CalendarView';
import { YearView } from '@/components/YearView';
import { SurpriseWidgets } from '@/components/SurpriseWidgets';
import { OnboardingModal } from '@/components/OnboardingModal';
import { PostLoginThemeModal } from '@/components/PostLoginThemeModal';
import { SettingsModal } from '@/components/SettingsModal';
import { RoutineImportModal, type RoutineImportPlan } from '@/components/RoutineImportModal';
import { DailyJournal } from '@/components/DailyJournal';
import { AuthModal, type AuthFormMode } from '@/components/AuthModal';
import { PasswordRecoveryModal } from '@/components/PasswordRecoveryModal';
import { Button } from '@/components/ui/button';
import { ScheduleEvent, AppSettings, AppTheme, AppLanguage, CustomTag } from '@/types';
import { normalizeAppSettings } from '@/lib/appSettings';
import { cn, getRandomDayName } from '@/lib/utils';
import { expandRecurringEvents } from '@/lib/events';
import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase/client';
import { listAllEventsWithTags, upsertEventWithTags, softDeleteEvent } from '@/lib/repositories/eventsRepo';
import { listAllCompletions, setInstanceCompletion } from '@/lib/repositories/completionsRepo';
import { listAllDayMeta, upsertDayMeta, DayVibes as DayVibesData } from '@/lib/repositories/dayMetaRepo';
import { VIBE_ICON_URL } from '@/lib/vibeIcons';
import { listAllDailyQuotes, upsertDailyQuote } from '@/lib/repositories/dailyQuotesRepo';

import { ScheduleSuggestionModal } from '@/components/ScheduleSuggestionModal';
import { DayVibes } from '@/components/DayVibes';
import { CollectionView } from '@/components/CollectionView';
import { TagBatchEditorDrawer, type TagDraft } from '@/components/TagBatchEditorDrawer';
import { useTagAnalysisFilters } from '@/hooks/useTagAnalysisFilters';
import { getThemeAccentHex } from '@/lib/utils';
import { COLLECTION_SUBTITLES_ZH, COLLECTION_SUBTITLES_EN } from '@/lib/collectionSubtitles';
import { LifeBookView } from '@/components/LifeBookView';
import { GoalLinkingDrawer, type MediumTermGoalLinkDraft } from '@/components/GoalLinkingDrawer';
import { getLocalScheduleSuggestions } from '@/lib/scheduleLocalSuggestions';
import { getChapters, type SavedChapter } from '@/lib/chaptersStorage';
import { syncLifeBookChapters } from '@/lib/chapterSync';
import { syncCollectionClientState, schedulePushCollectionClientState } from '@/lib/collectionStateSync';
import { PRESET_ROLES, getPresetRole, getRoleDisplayName, getRoleColor } from '@/lib/constants/roles';
import {
  upsertRoleCatalogColor,
  addHiddenPresetRoleId,
  migrateRoleCatalogId,
  removeRoleCatalogEntry,
} from '@/lib/roleManagementStorage';
import {
  eventTouchesTag,
  applyTagRenameToEvent,
  stripTagFromEvent,
} from '@/lib/eventAnalyticsHelpers';
import { renameCustomTagInPool, removeCustomTagFromPool, isPresetEventLabel, touchCustomEventLabel } from '@/lib/customEventTagsStorage';
import { createSyncGenerationGuard } from '@/lib/syncGeneration';
import {
  loadLongTermGoalMeta,
  mergeLongTermGoalNames,
  saveLongTermGoalMeta,
} from '@/lib/longTermGoalMetaStorage';
import type { GoalLinkingFilterState } from '@/lib/goalLinkingQuery';

const AUTH_ERROR_AUTO_DISMISS_MS = 10_000;

function formatSyncErrorMessage(err: unknown, language: AppLanguage): string {
  let raw = '';
  if (err && typeof err === 'object' && err !== null) {
    const o = err as Record<string, unknown>;
    raw = String(o.message ?? o.error_description ?? o.details ?? '');
  }
  if (!raw.trim()) raw = String(err);
  if (/device_limit_reached/i.test(raw)) {
    return language === 'zh'
      ? '已达到可同时登录的设备数量上限，请在其他设备退出登录后再试。'
      : 'The Maximum Number Of Active Devices Has Been Reached. Sign Out On Another Device And Try Again.';
  }
  return raw.trim() || (language === 'zh' ? '同步失败' : 'Sync failed');
}

export default function App() {
  const {
    user,
    isLoading: authLoading,
    signUpWithPassword,
    signInWithPassword,
    resetPasswordForEmail,
    completePasswordRecovery,
    passwordRecoveryPending,
    signOut,
    authCallbackError,
    clearAuthCallbackError,
  } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  /** Bumps when chapter storage syncs or mutates so Life Book / 时间聚合 re-read local chapters. */
  const [chaptersTick, setChaptersTick] = useState(0);
  /** Bumps when collection-only local state (长期目标、封面、曲线等) syncs or mutates. */
  const [collectionStateTick, setCollectionStateTick] = useState(0);
  const [dailyQuotes, setDailyQuotes] = useState<Record<string, { text: string; author?: string }>>({});
  const [hasSkippedAuth, setHasSkippedAuth] = useState<boolean>(() => {
    return localStorage.getItem('feather_skipped_auth') === '1';
  });
  const [authModalInitialMode, setAuthModalInitialMode] = useState<AuthFormMode>('login');
  const prevUserForAuthModeRef = useRef(user);
  const [lastGenerateMode, setLastGenerateMode] = useState<'chill' | 'productive' | null>(null);
  const scheduleGenNonceRef = useRef(0);

  // Settings State
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('feather_settings');
    if (!saved) {
      return normalizeAppSettings({ theme: 'artsy', language: 'en', hasCompletedOnboarding: false });
    }
    return normalizeAppSettings(JSON.parse(saved));
  });

  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [dayNames, setDayNames] = useState<Record<string, { name: string; isManual: boolean; language?: AppLanguage }>>({});
  const [dayTags, setDayTags] = useState<Record<string, string>>({});
  const [journalEntries, setJournalEntries] = useState<Record<string, string>>({});
  const [dayVibesData, setDayVibesData] = useState<Record<string, DayVibesData>>({});
  const [completedInstances, setCompletedInstances] = useState<Record<string, boolean>>({});
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isRoutineImportOpen, setIsRoutineImportOpen] = useState(false);
  const [isRoutineImporting, setIsRoutineImporting] = useState(false);
  const [searchHighlightDates, setSearchHighlightDates] = useState<Set<string>>(new Set());
  
  // Schedule Generation State
  const [generatingMode, setGeneratingMode] = useState<'chill' | 'productive' | null>(null);
  const [suggestedEvents, setSuggestedEvents] = useState<ScheduleEvent[]>([]);
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const [isGoalLinkingOpen, setIsGoalLinkingOpen] = useState(false);
  const [isGoalLinkingSaving, setIsGoalLinkingSaving] = useState(false);
  const [goalLinkingFilters, setGoalLinkingFilters] = useState<GoalLinkingFilterState>({ range: 'month' });

  const [viewMode, setViewMode] = useState<'day' | 'month' | 'year' | 'collection' | 'lifeBook'>('day');
  const [viewModeBeforeCollection, setViewModeBeforeCollection] = useState<'day' | 'month' | 'year'>('day');
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [selectedFilterTag, setSelectedFilterTag] = useState<string | null>(null);
  const [selectedFilterRole, setSelectedFilterRole] = useState<string | null>(null);
  const [roleFilterMode, setRoleFilterMode] = useState<'all' | 'dim' | 'hide'>('dim');
  const [yearInputValue, setYearInputValue] = useState('');
  const [isBatchEditorOpen, setIsBatchEditorOpen] = useState(false);
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const { filters: tagFilters, setFilters: setTagFilters } = useTagAnalysisFilters({
    range: 'this_month',
    viewMode: 'untagged',
  });
  const menuGroupRef = useRef<HTMLDivElement>(null);
  const yearListScrollRef = useRef<HTMLDivElement>(null);

  const deviceIdRef = useRef<string>('');
  const syncGuardRef = useRef(createSyncGenerationGuard());
  useEffect(() => {
    const existing = localStorage.getItem('feather_device_id');
    if (existing) {
      deviceIdRef.current = existing;
      return;
    }
    const id = uuidv4();
    localStorage.setItem('feather_device_id', id);
    deviceIdRef.current = id;
  }, []);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('feather_settings', JSON.stringify(settings));
  }, [settings]);

  // Reusable full-data sync — called on login and on manual refresh
  const syncAllUserData = React.useCallback(async () => {
    if (!user) return;
    const generation = syncGuardRef.current.begin();
    const isStale = () => !syncGuardRef.current.isCurrent(generation);
    setIsSyncing(true);
    setAuthError(null);
    try {
      // Device cap: subscriptions.max_devices (default 10); enforced by register_device RPC.
      const deviceId = deviceIdRef.current;
      if (deviceId) {
        const { error } = await supabase.rpc('register_device', {
          device_id: deviceId,
          device_name: navigator.userAgent,
        });
        if (error?.code === 'device_limit_reached') throw error;
        // Other register_device errors (network, permissions) are non-fatal;
        // proceed with data sync regardless.
      }

      const [evts, comps, dayMeta, quotes] = await Promise.all([
        listAllEventsWithTags(supabase, user.id),
        listAllCompletions(supabase, user.id),
        listAllDayMeta(supabase, user.id),
        listAllDailyQuotes(supabase, user.id),
      ]);

      if (isStale()) return;

      setEvents(evts);
      setCompletedInstances(comps);
      setDayNames(dayMeta.dayNames);
      setDayTags(dayMeta.dayTags);
      setJournalEntries(dayMeta.journalEntries);
      setDayVibesData(dayMeta.dayVibes);
      setDailyQuotes(quotes);

      try {
        await syncLifeBookChapters(supabase, user.id, { isStale });
      } catch {
        // Chapter sync is best-effort; do not block main data sync
      }
      if (isStale()) return;
      try {
        await syncCollectionClientState(supabase, user.id, { isStale });
      } catch {
        // Collection local extensions sync is best-effort
      }
    } catch (e: unknown) {
      if (syncGuardRef.current.shouldFinalize(generation)) {
        setAuthError(formatSyncErrorMessage(e, settings.language));
      }
    } finally {
      if (syncGuardRef.current.shouldFinalize(generation)) {
        setIsSyncing(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Online-first sync: load all user data after login
  useEffect(() => {
    syncAllUserData();
  }, [syncAllUserData]);

  // Auto-sync when entering collection view (cross-device freshness)
  useEffect(() => {
    if (viewMode === 'collection' && user) {
      syncAllUserData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  // Pull Life Book chapters + collection-only state when opening 人生之书
  useEffect(() => {
    if (viewMode !== 'lifeBook' || !user) return;
    let cancelled = false;
    void Promise.all([
      syncLifeBookChapters(supabase, user.id, { isStale: () => cancelled }),
      syncCollectionClientState(supabase, user.id, { isStale: () => cancelled }),
    ]).catch(() => {});
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, user]);

  useEffect(() => {
    if (!authError) return;
    const id = window.setTimeout(() => setAuthError(null), AUTH_ERROR_AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [authError]);

  useEffect(() => {
    if (prevUserForAuthModeRef.current && !user) {
      setAuthModalInitialMode('login');
    }
    prevUserForAuthModeRef.current = user;
  }, [user]);

  useEffect(() => {
    const bump = () => setChaptersTick((t) => t + 1);
    window.addEventListener('feather-chapters-updated', bump);
    return () => window.removeEventListener('feather-chapters-updated', bump);
  }, []);

  useEffect(() => {
    const onCollectionState = (e: Event) => {
      setCollectionStateTick((t) => t + 1);
      const src = (e as CustomEvent<{ source?: string }>).detail?.source;
      if (user?.id && src === 'user') {
        schedulePushCollectionClientState(user.id);
      }
    };
    window.addEventListener('feather-collection-state-updated', onCollectionState);
    return () => window.removeEventListener('feather-collection-state-updated', onCollectionState);
  }, [user?.id]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuGroupRef.current && !menuGroupRef.current.contains(event.target as Node)) {
        setIsViewMenuOpen(false);
        setIsTimePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync document theme for CSS variables
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  // When year picker opens, scroll list to current year
  useEffect(() => {
    if (!isTimePickerOpen || viewMode !== 'year') return;
    const id = setTimeout(() => {
      const el = yearListScrollRef.current;
      if (!el) return;
      const y = currentDate.getFullYear();
      const min = new Date().getFullYear() - 120;
      const index = y - min;
      const rowHeight = 40;
      const viewportHeight = 200;
      el.scrollTop = Math.max(0, index * rowHeight - viewportHeight / 2 + rowHeight / 2);
    }, 50);
    return () => clearTimeout(id);
  }, [isTimePickerOpen, viewMode, currentDate]);

  // Sync year input when currentDate or viewMode changes (year/month views)
  useEffect(() => {
    if (viewMode === 'year' || viewMode === 'month') {
      setYearInputValue(String(currentDate.getFullYear()));
    }
  }, [viewMode, currentDate]);

  // Filter events for the current day using expandRecurringEvents
  const currentDayEvents = React.useMemo(() => {
    return expandRecurringEvents(events, currentDate, currentDate, completedInstances);
  }, [events, currentDate, completedInstances]);

  // Goals used in the last 28 days (for long-term goal suggestions in AddEventModal)
  const goalsUsedInLast28Days = React.useMemo(() => {
    const end = new Date();
    const start = subDays(end, 28);
    const expanded = expandRecurringEvents(events, start, end, completedInstances);
    const set = new Set<string>();
    expanded.forEach((e) => e.longTermGoals?.forEach((g) => set.add(g)));
    return Array.from(set);
  }, [events, completedInstances]);

  const longTermGoalMetaMap = React.useMemo(
    () => loadLongTermGoalMeta(),
    [collectionStateTick],
  );

  const longTermGoalNames = React.useMemo(
    () => mergeLongTermGoalNames(events),
    [events, collectionStateTick],
  );

  const dateKey = format(currentDate, 'yyyy-MM-dd');

  const chartFilters = React.useMemo(
    () => ({
      range: tagFilters.range,
      customStart: tagFilters.customStart,
      customEnd: tagFilters.customEnd,
    }),
    [tagFilters.range, tagFilters.customStart, tagFilters.customEnd],
  );

  const openBatchEditor = React.useCallback(() => {
    setTagFilters((prev) => ({ ...prev, viewMode: 'untagged' }));
    setIsBatchEditorOpen(true);
  }, [setTagFilters]);
  const currentDayName = dayNames[dateKey]?.name || '';
  const currentJournal = journalEntries[dateKey] || '';

  // Check if the current date is in the past (before today)
  const today = startOfDay(new Date());
  const isPast = isBefore(startOfDay(currentDate), today);

  // Keep refs for day meta fields to avoid stale closures in async effects
  const dayNamesRef = useRef(dayNames);
  const dayTagsRef = useRef(dayTags);
  const journalEntriesRef = useRef(journalEntries);
  const userRef = useRef(user);
  useEffect(() => {
    dayNamesRef.current = dayNames;
  }, [dayNames]);
  useEffect(() => {
    dayTagsRef.current = dayTags;
  }, [dayTags]);
  useEffect(() => {
    journalEntriesRef.current = journalEntries;
  }, [journalEntries]);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Default day name: random from dayNameRandomPools.json (same with or without events)
  useEffect(() => {
    const generateName = () => {
      const currentDayData = dayNamesRef.current[dateKey];
      
      // Don't overwrite if manual
      if (currentDayData?.isManual) return;

      // If name exists and language matches, don't touch it
      if (currentDayData?.name && currentDayData?.language === settings.language) return;

      const name = getRandomDayName(settings.theme, settings.language);
      setDayNames(prev => ({
        ...prev,
        [dateKey]: { name, isManual: false, language: settings.language }
      }));
      const currentUser = userRef.current;
      if (currentUser) {
        upsertDayMeta(supabase, currentUser.id, dateKey, {
          day_name: name,
          day_name_is_manual: false,
          day_name_language: settings.language,
          day_tag: dayTagsRef.current[dateKey] || null,
          journal: journalEntriesRef.current[dateKey] || null,
        }).catch(() => {});
      }
    };
    
    const timer = setTimeout(generateName, 1000);
    return () => clearTimeout(timer);
  }, [currentDayEvents, dateKey, settings.theme, settings.language]);

  const handleManualNameChange = (newName: string) => {
    setDayNames(prev => ({
      ...prev,
      [dateKey]: { name: newName, isManual: true, language: settings.language }
    }));
    if (user) {
      upsertDayMeta(supabase, user.id, dateKey, {
        day_name: newName,
        day_name_is_manual: true,
        day_name_language: settings.language,
        day_tag: dayTags[dateKey] || null,
        journal: journalEntries[dateKey] || null,
      }).catch(() => {});
    }
  };

  const handleSetDayTag = (tag: string) => {
    setDayTags(prev => ({
      ...prev,
      [dateKey]: tag
    }));
    if (user) {
      upsertDayMeta(supabase, user.id, dateKey, {
        day_name: dayNames[dateKey]?.name || null,
        day_name_is_manual: dayNames[dateKey]?.isManual || false,
        day_name_language: (dayNames[dateKey]?.language as any) || settings.language,
        day_tag: tag || null,
        journal: journalEntries[dateKey] || null,
      }).catch(() => {});
    }
  };

  const handleAddCustomTag = (tag: CustomTag) => {
    setSettings(prev => ({
      ...prev,
      customTags: [...(prev.customTags || []), tag]
    }));
  };

  const handleRemoveCustomTag = (id: string) => {
    setSettings(prev => ({
      ...prev,
      customTags: (prev.customTags || []).filter(t => t.id !== id)
    }));
  };

  const handleRandomDayName = () => {
    const name = getRandomDayName(settings.theme, settings.language);
    const hasEvents = currentDayEvents.length > 0;
    setDayNames(prev => ({
      ...prev,
      [dateKey]: { name, isManual: hasEvents, language: settings.language },
    }));
    if (user) {
      upsertDayMeta(supabase, user.id, dateKey, {
        day_name: name,
        day_name_is_manual: hasEvents,
        day_name_language: settings.language,
        day_tag: dayTags[dateKey] || null,
        journal: journalEntries[dateKey] || null,
      }).catch(() => {});
    }
  };

  const handleAddEvent = async (newEvent: ScheduleEvent) => {
    const isNewEvent = !events.some((e) => e.id === newEvent.id);
    if (user) {
      try {
        await upsertEventWithTags(supabase, user.id, newEvent, { isNewEvent });
      } catch (e: unknown) {
        alert(formatSyncErrorMessage(e, settings.language));
        throw e;
      }
    }
    setEvents(prev => {
      const existingIndex = prev.findIndex(e => e.id === newEvent.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = newEvent;
        return updated;
      }
      return [...prev, newEvent];
    });
    setIsAddModalOpen(false);
    setEditingEvent(null);
  };

  const handleImportRoutineEvents = async (plan: RoutineImportPlan) => {
    const importedEvents = plan.events;
    if (importedEvents.length === 0 || isRoutineImporting) return;
    setIsRoutineImporting(true);
    try {
      const mediumEntries = Object.entries(plan.mediumTermGoalsToCreate);
      if (mediumEntries.length > 0) {
        const currentMeta = loadLongTermGoalMeta();
        let nextMeta = currentMeta;
        let changed = false;
        const now = new Date().toISOString();
        for (const [goalName, mediumGoals] of mediumEntries) {
          const existing = nextMeta[goalName];
          if (!existing) continue;
          const currentMedium = existing.mediumTermGoals ?? [];
          const existingTitles = new Set(currentMedium.map((medium) => medium.title.trim()));
          const additions = mediumGoals.filter((medium) => !existingTitles.has(medium.title.trim()));
          if (additions.length === 0) continue;
          nextMeta = {
            ...nextMeta,
            [goalName]: {
              ...existing,
              lastAlignedAt: now,
              mediumTermGoals: [...currentMedium, ...additions],
            },
          };
          changed = true;
        }
        if (changed) {
          saveLongTermGoalMeta(nextMeta);
        }
      }

      if (user) {
        for (const event of importedEvents) {
          await upsertEventWithTags(supabase, user.id, event, { isNewEvent: true });
        }
      }
      importedEvents.forEach((event) => {
        const labelText = event.label?.text?.trim();
        if (labelText && !isPresetEventLabel(labelText)) {
          touchCustomEventLabel(labelText);
        }
      });
      setEvents((prev) => {
        const map = new Map(prev.map((event) => [event.id, event]));
        importedEvents.forEach((event) => map.set(event.id, event));
        return Array.from(map.values());
      });
      const mediumGoalCount = Object.values(plan.mediumTermGoalsToCreate).reduce((sum, items) => sum + items.length, 0);
      const warningCount = plan.warnings.length;
      const successMessage = settings.language === 'zh'
        ? [
            `导入成功：${importedEvents.length} 条日程。`,
            mediumGoalCount > 0 ? `新建 ${mediumGoalCount} 个中期目标。` : '',
            warningCount > 0 ? `${warningCount} 条日程的目标关联不完整，已先导入；请后续在「整理目标」里补充。` : '',
            ...plan.warnings.slice(0, 5),
          ].filter(Boolean).join('\n')
        : [
            `Import Complete: ${importedEvents.length} Events.`,
            mediumGoalCount > 0 ? `Created ${mediumGoalCount} Medium-Term Goals.` : '',
            warningCount > 0 ? `${warningCount} Events Have Incomplete Goal Links And Were Imported Anyway. Link Them Later In Goal Cleanup.` : '',
            ...plan.warnings.slice(0, 5),
          ].filter(Boolean).join('\n');
      alert(successMessage);
    } catch (e: unknown) {
      alert(formatSyncErrorMessage(e, settings.language));
      throw e;
    } finally {
      setIsRoutineImporting(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (user) {
      try {
        await softDeleteEvent(supabase, user.id, eventId);
      } catch (e: any) {
        alert(e?.message || 'Failed to delete event');
        return;
      }
    }
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    setCompletedInstances((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (k === eventId || k.startsWith(`${eventId}_`)) delete next[k];
      }
      return next;
    });
    setIsAddModalOpen(false);
    setEditingEvent(null);
  };

  const handleToggleComplete = async (id: string) => {
    // Check if it's a generated instance ID (contains an underscore)
    if (id.includes('_')) {
      const [eventId, instanceDate] = id.split('_');
      const next = !completedInstances[id];
      if (user) {
        try {
          await setInstanceCompletion(supabase, user.id, { eventId, instanceDate, completed: next });
        } catch (e: any) {
          alert(e?.message || 'Failed to update completion');
          return;
        }
      }
      setCompletedInstances(prev => ({ ...prev, [id]: next }));
    } else {
      const target = events.find(e => e.id === id);
      if (!target) return;
      const updated = { ...target, completed: !target.completed };
      if (user) {
        try {
          await upsertEventWithTags(supabase, user.id, updated);
        } catch (e: any) {
          alert(e?.message || 'Failed to update event');
          return;
        }
      }
      setEvents(prev => prev.map(e => (e.id === id ? updated : e)));
    }
  };

  const handleSaveJournal = (summary: string, forDateKey: string) => {
    setJournalEntries(prev => ({
      ...prev,
      [forDateKey]: summary
    }));
    if (user) {
      void upsertDayMeta(supabase, user.id, forDateKey, {
        day_name: dayNames[forDateKey]?.name || null,
        day_name_is_manual: dayNames[forDateKey]?.isManual || false,
        day_name_language: (dayNames[forDateKey]?.language as any) || settings.language,
        day_tag: dayTags[forDateKey] || null,
        journal: summary || null,
      })
        .catch((e: unknown) => {
          setAuthError(formatSyncErrorMessage(e, settings.language));
        });
    }
  };

  const handleSetVibes = (vibes: DayVibesData) => {
    setDayVibesData(prev => ({ ...prev, [dateKey]: vibes }));
    if (user) {
      upsertDayMeta(supabase, user.id, dateKey, {
        day_name: dayNames[dateKey]?.name || null,
        day_name_is_manual: dayNames[dateKey]?.isManual || false,
        day_name_language: (dayNames[dateKey]?.language as any) || settings.language,
        day_tag: dayTags[dateKey] || null,
        journal: journalEntries[dateKey] || null,
        energy_level: vibes.energy ?? null,
        mood_level: vibes.mood ?? null,
        focus_level: vibes.focus ?? null,
      }).catch(() => {});
    }
  };

  const handleGenerateSchedule = async (mode: 'chill' | 'productive') => {
    setLastGenerateMode(mode);
    setGeneratingMode(mode);
    try {
      scheduleGenNonceRef.current += 1;
      const seed = `${format(currentDate, 'yyyy-MM-dd')}-${mode}-${settings.language}-${scheduleGenNonceRef.current}`;
      const generatedEvents = getLocalScheduleSuggestions(mode, settings.language, { seed });

      const processedEvents = generatedEvents.map((e: any) => {
        const [startH, startM] = e.startTime.split(':').map(Number);
        const [endH, endM] = e.endTime.split(':').map(Number);
        
        const startD = new Date(currentDate);
        startD.setHours(startH, startM);
        
        const endD = new Date(currentDate);
        endD.setHours(endH, endM);
        
        return {
          ...e,
          id: uuidv4(),
          startTime: startD.toISOString(),
          endTime: endD.toISOString(),
          completed: false
        };
      });

      setSuggestedEvents(processedEvents);
      setIsSuggestionModalOpen(true);
    } catch (error) {
      console.error("Failed to generate schedule", error);
    } finally {
      setGeneratingMode(null);
    }
  };

  const handleConfirmSchedule = (selectedEvents: ScheduleEvent[]) => {
    setEvents(prev => [...prev, ...selectedEvents]);
    setIsSuggestionModalOpen(false);
    setSuggestedEvents([]);
  };

  const [collectionSubtitleIndex, setCollectionSubtitleIndex] = useState(0);

  useEffect(() => {
    if (viewMode !== 'collection') return;
    const id = window.setInterval(() => {
      setCollectionSubtitleIndex((i) => (i + 1) % COLLECTION_SUBTITLES_ZH.length);
    }, 8000);
    return () => window.clearInterval(id);
  }, [viewMode]);

  const handleRenameLongTermGoal = React.useCallback(
    async (oldName: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed || oldName === trimmed) return;
      const affected = events.filter((e) => e.longTermGoals?.includes(oldName));

      setEvents((prev) =>
        prev.map((e) => ({
          ...e,
          longTermGoals: e.longTermGoals?.map((g) => (g === oldName ? trimmed : g)),
        }))
      );

      if (user) {
        try {
          for (const e of affected) {
            const updated: ScheduleEvent = {
              ...e,
              longTermGoals: e.longTermGoals?.map((g) => (g === oldName ? trimmed : g)),
            };
            await upsertEventWithTags(supabase, user.id, updated);
          }
        } catch (err: unknown) {
          alert(formatSyncErrorMessage(err, settings.language));
        }
      }
    },
    [events, user, settings.language]
  );

  const handleMigrateEventRole = React.useCallback(
    async (oldId: string, newId: string) => {
      if (oldId === newId) return;
      const preset = getPresetRole(oldId);
      if (preset && newId.startsWith('custom:')) {
        upsertRoleCatalogColor(newId, preset.color);
      } else {
        migrateRoleCatalogId(oldId, newId);
      }
      const affected = events.filter((e) => e.role === oldId);
      for (const e of affected) {
        const updated: ScheduleEvent = { ...e, role: newId };
        if (user) {
          try {
            await upsertEventWithTags(supabase, user.id, updated);
          } catch (err: unknown) {
            alert(formatSyncErrorMessage(err, settings.language));
            throw err;
          }
        }
      }
      setEvents((prev) => prev.map((e) => (e.role === oldId ? { ...e, role: newId } : e)));
    },
    [events, user, settings.language]
  );

  const handleClearEventRole = React.useCallback(
    async (roleId: string) => {
      const affected = events.filter((e) => e.role === roleId);
      for (const e of affected) {
        const updated: ScheduleEvent = { ...e };
        delete updated.role;
        if (user) {
          try {
            await upsertEventWithTags(supabase, user.id, updated);
          } catch (err: unknown) {
            alert(formatSyncErrorMessage(err, settings.language));
            throw err;
          }
        }
      }
      setEvents((prev) =>
        prev.map((e) => {
          if (e.role !== roleId) return e;
          const next: ScheduleEvent = { ...e };
          delete next.role;
          return next;
        })
      );
      if (getPresetRole(roleId)) {
        addHiddenPresetRoleId(roleId);
      } else if (roleId.startsWith('custom:')) {
        removeRoleCatalogEntry(roleId);
      }
    },
    [events, user, settings.language]
  );

  const handleMigrateEventTag = React.useCallback(
    async (oldTag: string, newTag: string) => {
      const o = oldTag.trim();
      const n = newTag.trim();
      if (!o || !n || o === n) return;
      const affected = events.filter((e) => eventTouchesTag(e, o));
      for (const e of affected) {
        const updated = applyTagRenameToEvent(e, o, n);
        if (user) {
          try {
            await upsertEventWithTags(supabase, user.id, updated);
          } catch (err: unknown) {
            alert(formatSyncErrorMessage(err, settings.language));
            throw err;
          }
        }
      }
      setEvents((prev) => prev.map((e) => (eventTouchesTag(e, o) ? applyTagRenameToEvent(e, o, n) : e)));
      if (!isPresetEventLabel(o)) {
        renameCustomTagInPool(o, n);
      }
    },
    [events, user, settings.language]
  );

  const handleClearEventTag = React.useCallback(
    async (tag: string) => {
      const t = tag.trim();
      if (!t) return;
      const affected = events.filter((e) => eventTouchesTag(e, t));
      for (const e of affected) {
        const updated = stripTagFromEvent(e, t);
        if (user) {
          try {
            await upsertEventWithTags(supabase, user.id, updated);
          } catch (err: unknown) {
            alert(formatSyncErrorMessage(err, settings.language));
            throw err;
          }
        }
      }
      setEvents((prev) => prev.map((e) => (eventTouchesTag(e, t) ? stripTagFromEvent(e, t) : e)));
      if (!isPresetEventLabel(t)) {
        removeCustomTagFromPool(t);
      }
    },
    [events, user, settings.language]
  );

  const handleBatchSaveTags = React.useCallback(
    async (drafts: Map<string, TagDraft>) => {
      setIsBatchSaving(true);
      try {
        const updatedEvents: ScheduleEvent[] = [];
        for (const [persistId, draft] of drafts.entries()) {
          const base = events.find((e) => e.id === persistId);
          if (!base) continue;
          const updated: ScheduleEvent = { ...base };

          const baseRole = base.role?.trim() || '';
          const baseEventTag = base.label?.text?.trim() || base.tags?.[0]?.trim() || '';
          const baseType = base.type || '';
          const draftEventTag = draft.eventTag.trim();

          if (draft.roleId !== baseRole) {
            if (draft.roleId) updated.role = draft.roleId;
            else delete updated.role;
          }

          if (draftEventTag !== baseEventTag) {
            if (draftEventTag) {
              updated.label = { text: draftEventTag, color: base.label?.color || getThemeAccentHex() };
              if (!isPresetEventLabel(draftEventTag)) touchCustomEventLabel(draftEventTag);
            } else {
              delete updated.label;
            }
            delete updated.tags;
          }

          if (draft.type && draft.type !== baseType) {
            updated.type = draft.type;
          }

          if (user) {
            try {
              await upsertEventWithTags(supabase, user.id, updated);
            } catch (err: unknown) {
              alert(formatSyncErrorMessage(err, settings.language));
              throw err;
            }
          }
          updatedEvents.push(updated);
        }
        if (updatedEvents.length > 0) {
          setEvents((prev) => {
            const map = new Map(prev.map((e) => [e.id, e]));
            for (const u of updatedEvents) map.set(u.id, u);
            return Array.from(map.values());
          });
        }
      } finally {
        setIsBatchSaving(false);
      }
    },
    [events, user, settings.language],
  );

  /** Removes the goal from meta/tag pool and strips it from events' longTermGoals only — does not delete events. */
  const handleDeleteLongTermGoal = React.useCallback(
    async (goalName: string) => {
      const trimmed = goalName.trim();
      if (!trimmed) return;
      const deletedGoalMediumIds = new Set(
        (longTermGoalMetaMap[trimmed]?.mediumTermGoals ?? []).map((medium) => medium.id),
      );
      const affected = events.filter((e) => e.longTermGoals?.includes(trimmed));

      setEvents((prev) =>
        prev.map((e) => {
          const nextGoals = e.longTermGoals?.filter((g) => g !== trimmed);
          const next: ScheduleEvent = {
            ...e,
            longTermGoals: nextGoals && nextGoals.length > 0 ? nextGoals : undefined,
          };
          if (
            next.mediumTermGoalId &&
            (deletedGoalMediumIds.has(next.mediumTermGoalId) || !next.longTermGoals)
          ) {
            delete next.mediumTermGoalId;
          }
          return next;
        })
      );

      if (user) {
        try {
          for (const e of affected) {
            const nextGoals = e.longTermGoals?.filter((g) => g !== trimmed);
            const updated: ScheduleEvent = {
              ...e,
              longTermGoals: nextGoals && nextGoals.length > 0 ? nextGoals : undefined,
            };
            if (
              updated.mediumTermGoalId &&
              (deletedGoalMediumIds.has(updated.mediumTermGoalId) || !updated.longTermGoals)
            ) {
              delete updated.mediumTermGoalId;
            }
            await upsertEventWithTags(supabase, user.id, updated);
          }
        } catch (err: unknown) {
          alert(formatSyncErrorMessage(err, settings.language));
        }
      }
    },
    [events, longTermGoalMetaMap, user, settings.language]
  );

  const openGoalLinking = (range?: GoalLinkingFilterState['range']) => {
    if (range) {
      setGoalLinkingFilters({ range });
    } else if (viewMode === 'year') {
      setGoalLinkingFilters({ range: 'year' });
    } else if (viewMode === 'month') {
      setGoalLinkingFilters({ range: 'month' });
    } else {
      setGoalLinkingFilters({
        range: 'custom',
        customStart: dateKey,
        customEnd: dateKey,
      });
    }
    setIsGoalLinkingOpen(true);
  };

  const handleSaveGoalLinks = async (links: Map<string, MediumTermGoalLinkDraft>) => {
    setIsGoalLinkingSaving(true);
    try {
      const updatedEvents: ScheduleEvent[] = [];

      for (const [persistId, link] of links.entries()) {
        const base = events.find(e => e.id === persistId);
        if (!base) continue;

        const nextGoals = Array.from(new Set([...(base.longTermGoals || []), link.goalName].filter(Boolean)));
        const updated: ScheduleEvent = {
          ...base,
          longTermGoals: nextGoals,
          mediumTermGoalId: link.mediumTermGoalId,
        };
        if (user) {
          await upsertEventWithTags(supabase, user.id, updated);
        }
        updatedEvents.push(updated);
      }

      if (updatedEvents.length > 0) {
        setEvents(prev => {
          const map = new Map(prev.map(e => [e.id, e]));
          for (const event of updatedEvents) map.set(event.id, event);
          return Array.from(map.values());
        });
      }
    } catch (e: unknown) {
      alert(formatSyncErrorMessage(e, settings.language));
      throw e;
    } finally {
      setIsGoalLinkingSaving(false);
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      if (viewMode === 'year') {
        return direction === 'prev' ? subYears(prev, 1) : addYears(prev, 1);
      } else if (viewMode === 'month') {
        return direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1);
      } else {
        return direction === 'prev' ? subDays(prev, 1) : addDays(prev, 1);
      }
    });
  };

  const { uniqueTagsInView, tagCountsInView } = React.useMemo(() => {
    if (viewMode === 'day' || viewMode === 'collection' || viewMode === 'lifeBook') {
      return { uniqueTagsInView: [], tagCountsInView: {} as Record<string, number> };
    }

    let start, end;
    if (viewMode === 'month') {
      const monthStart = startOfMonth(currentDate);
      start = startOfWeek(monthStart);
      end = endOfWeek(endOfMonth(monthStart));
    } else {
      start = startOfYear(currentDate);
      end = endOfYear(currentDate);
    }

    const calendarDays = eachDayOfInterval({ start, end });
    const counts: Record<string, number> = {};
    for (const day of calendarDays) {
      const tag = dayTags[format(day, 'yyyy-MM-dd')];
      if (tag) counts[tag] = (counts[tag] || 0) + 1;
    }

    return {
      uniqueTagsInView: Object.keys(counts),
      tagCountsInView: counts,
    };
  }, [viewMode, currentDate, dayTags]);

  const uniqueRolesInView = React.useMemo(() => {
    if (viewMode === 'day') {
      const ids = new Set<string>();
      currentDayEvents.forEach(e => { if (e.role) ids.add(e.role); });
      return Array.from(ids);
    }
    let start: Date, end: Date;
    if (viewMode === 'month') {
      const monthStart = startOfMonth(currentDate);
      start = startOfWeek(monthStart);
      end = endOfWeek(endOfMonth(monthStart));
    } else {
      start = startOfYear(currentDate);
      end = endOfYear(currentDate);
    }
    const expanded = expandRecurringEvents(events, start, end, completedInstances);
    const roleIds = new Set<string>();
    expanded.forEach(e => { if (e.role) roleIds.add(e.role); });
    return Array.from(roleIds);
  }, [viewMode, currentDate, events, completedInstances, currentDayEvents]);

  const viewOptions: { id: 'year' | 'month' | 'day' | 'collection' | 'lifeBook'; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'year', label: settings.language === 'zh' ? '年视图' : 'Year View', icon: Grid },
    { id: 'month', label: settings.language === 'zh' ? '月视图' : 'Month View', icon: CalendarIcon },
    { id: 'day', label: settings.language === 'zh' ? '日视图' : 'Day View', icon: List },
    { id: 'collection', label: settings.language === 'zh' ? '时间聚合' : 'Time Synthesis', icon: Layers },
    { id: 'lifeBook', label: settings.language === 'zh' ? '人生之书' : 'Life Book', icon: BookOpen },
  ];

  const currentViewLabel = viewOptions.find(v => v.id === viewMode)?.label;
  const currentYearLabel = String(currentDate.getFullYear());
  const currentMonthLabel = format(
    currentDate,
    settings.language === 'zh' ? 'M月' : 'MMM',
    settings.language === 'zh' ? { locale: zhCN } : undefined
  );
  const leftDateTitle = viewMode === 'month'
    ? (settings.language === 'zh'
      ? `${currentDate.getFullYear()}年 ${format(currentDate, 'M月', { locale: zhCN })}`
      : format(currentDate, 'MMMM yyyy'))
    : (viewMode === 'year'
      ? (settings.language === 'zh' ? `${currentDate.getFullYear()}年` : format(currentDate, 'yyyy'))
      : '');

  const yearKpiAvg = React.useMemo((): { energy: number | null; mood: number | null; focus: number | null } | null => {
    if (viewMode !== 'year') return null;
    const y = currentDate.getFullYear();
    const prefix = `${y}-`;
    let energySum = 0, moodSum = 0, focusSum = 0;
    let energyN = 0, moodN = 0, focusN = 0;
    Object.entries(dayVibesData).forEach(([dateKey, v]: [string, DayVibesData]) => {
      if (!dateKey.startsWith(prefix)) return;
      if (v.energy != null) { energySum += v.energy; energyN++; }
      if (v.mood != null) { moodSum += v.mood; moodN++; }
      if (v.focus != null) { focusSum += v.focus; focusN++; }
    });
    return {
      energy: energyN > 0 ? Math.round(energySum / energyN) : null,
      mood: moodN > 0 ? Math.round(moodSum / moodN) : null,
      focus: focusN > 0 ? Math.round(focusSum / focusN) : null,
    };
  }, [viewMode, currentDate, dayVibesData]);

  const monthKpiAvg = React.useMemo((): { energy: number | null; mood: number | null; focus: number | null } | null => {
    if (viewMode !== 'month') return null;
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    let energySum = 0, moodSum = 0, focusSum = 0;
    let energyN = 0, moodN = 0, focusN = 0;
    Object.entries(dayVibesData).forEach(([dateKey, v]: [string, DayVibesData]) => {
      const d = new Date(dateKey + 'T00:00:00');
      if (d.getFullYear() !== y || d.getMonth() !== m) return;
      if (v.energy != null) { energySum += v.energy; energyN++; }
      if (v.mood != null) { moodSum += v.mood; moodN++; }
      if (v.focus != null) { focusSum += v.focus; focusN++; }
    });
    return {
      energy: energyN > 0 ? Math.round(energySum / energyN) : null,
      mood: moodN > 0 ? Math.round(moodSum / moodN) : null,
      focus: focusN > 0 ? Math.round(focusSum / focusN) : null,
    };
  }, [viewMode, currentDate, dayVibesData]);

  const timePickerTriggerLabel = viewMode === 'month'
    ? (settings.language === 'zh'
      ? `${currentYearLabel}年 · ${currentMonthLabel}`
      : `${currentMonthLabel} ${currentYearLabel}`)
    : (settings.language === 'zh' ? `${currentYearLabel}年` : currentYearLabel);

  const currentYear = new Date().getFullYear();
  const minYear = currentYear - 120;
  const maxYear = currentYear + 120;
  const minDateStr = `${minYear}-01-01`;
  const maxDateStr = `${maxYear}-12-31`;
  const yearOptions = Array.from({ length: maxYear - minYear + 1 }, (_, idx) => minYear + idx);
  const monthButtonLabels = Array.from({ length: 12 }, (_, idx) =>
    format(
      new Date(2000, idx, 1),
      settings.language === 'zh' ? 'M月' : 'MMM',
      settings.language === 'zh' ? { locale: zhCN } : undefined
    )
  );

  const handleYearSelect = (nextYear: number) => {
    const month = viewMode === 'month' ? currentDate.getMonth() : 0;
    setCurrentDate(new Date(nextYear, month, 1));
    if (viewMode === 'year') {
      setIsTimePickerOpen(false);
    }
  };

  const handleMonthPick = (monthIndex: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), monthIndex, 1));
    setIsTimePickerOpen(false);
  };

  const handleYearBlur = () => {
    const parsed = parseInt(yearInputValue, 10);
    if (!Number.isNaN(parsed) && parsed >= minYear && parsed <= maxYear) {
      const month = viewMode === 'month' ? currentDate.getMonth() : 0;
      setCurrentDate(new Date(parsed, month, 1));
      setYearInputValue(String(parsed));
    } else {
      setYearInputValue(String(currentDate.getFullYear()));
    }
  };

  const handleYearKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleYearBlur();
  };

  const handleGoToCurrentYear = () => {
    const y = new Date().getFullYear();
    setCurrentDate(new Date(y, 0, 1));
    setYearInputValue(String(y));
    setIsTimePickerOpen(false);
  };

  const handleGoToCurrentMonth = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setYearInputValue(String(now.getFullYear()));
    setIsTimePickerOpen(false);
  };

  const handleGoToToday = () => {
    setCurrentDate(startOfDay(new Date()));
  };

  const handleOnboardingComplete = (
    next: AppSettings,
    authIntent: 'login' | 'register' | 'skip',
  ) => {
    setSettings(normalizeAppSettings({ ...next } as Parameters<typeof normalizeAppSettings>[0]));
    if (authIntent === 'skip') {
      setHasSkippedAuth(true);
      localStorage.setItem('feather_skipped_auth', '1');
    } else {
      setHasSkippedAuth(false);
      localStorage.removeItem('feather_skipped_auth');
      setAuthModalInitialMode(authIntent === 'register' ? 'register' : 'login');
    }
  };

  const lifeBookChapters = useMemo(
    () => (viewMode === 'lifeBook' ? getChapters({ order: 'asc' }) : []),
    [viewMode, chaptersTick]
  );

  return (
    <div className="min-h-screen font-sans" style={{ background: 'var(--app-bg)', color: 'var(--app-text)' }}>
      {!settings.hasCompletedOnboarding && !passwordRecoveryPending && (
        <OnboardingModal onComplete={handleOnboardingComplete} />
      )}

      {user &&
        !authLoading &&
        !passwordRecoveryPending &&
        !settings.hasCompletedPostLoginTheme && (
          <PostLoginThemeModal
            language={settings.language}
            initialTheme={settings.theme}
            onComplete={(theme) => {
              setSettings((prev) =>
                normalizeAppSettings({
                  ...prev,
                  theme,
                  hasCompletedPostLoginTheme: true,
                } as Parameters<typeof normalizeAppSettings>[0]),
              );
            }}
          />
        )}

      <SettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
        user={user}
        onSignIn={() => {
          setHasSkippedAuth(false);
          localStorage.removeItem('feather_skipped_auth');
        }}
        onSignOut={signOut}
        onOpenRoutineImport={() => setIsRoutineImportOpen(true)}
      />

      <RoutineImportModal
        isOpen={isRoutineImportOpen}
        onClose={() => setIsRoutineImportOpen(false)}
        language={settings.language}
        longTermGoalNames={longTermGoalNames}
        longTermGoalMetaMap={longTermGoalMetaMap}
        onImport={handleImportRoutineEvents}
        isImporting={isRoutineImporting}
      />

      <AuthModal
        isOpen={!authLoading && !user && !hasSkippedAuth && settings.hasCompletedOnboarding}
        language={settings.language}
        initialMode={authModalInitialMode}
        errorMessage={authCallbackError}
        onSignIn={async (email, pin, options) => {
          clearAuthCallbackError();
          const { error } = await signInWithPassword(email, pin, options);
          return { error: error ?? undefined };
        }}
        onSignUp={async (email, pin, options) => {
          clearAuthCallbackError();
          const { error } = await signUpWithPassword(email, pin, options);
          if (error) {
            console.warn('[Auth] Supabase signUp:', { message: error.message });
          }
          return { error: error ?? undefined };
        }}
        onResetPassword={async (email, options) => {
          clearAuthCallbackError();
          const { error } = await resetPasswordForEmail(email, options);
          if (error) {
            console.warn('[Auth] Supabase resetPassword:', { message: error.message });
          }
          return { error: error ?? undefined };
        }}
        onSkip={() => {
          setHasSkippedAuth(true);
          localStorage.setItem('feather_skipped_auth', '1');
          clearAuthCallbackError();
        }}
      />

      <PasswordRecoveryModal
        isOpen={passwordRecoveryPending && !!user}
        language={settings.language}
        onSubmitNewPin={async (pin) => {
          const { error } = await completePasswordRecovery(pin);
          return { error: error ? { message: error.message } : undefined };
        }}
      />

      <div className="max-w-5xl lg:max-w-7xl mx-auto px-4 lg:px-8 py-8 md:py-12 min-h-screen flex flex-col">

        {authError && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
            {settings.language === 'zh' ? '同步失败：' : 'Sync failed: '} {authError}
          </div>
        )}
        {isSyncing && user && (
          <div
            className="mb-6 flex items-center gap-2 rounded-2xl border border-border bg-surface/80 px-4 py-3 text-foreground text-sm"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
            {settings.language === 'zh' ? '正在同步数据…' : 'Syncing data…'}
          </div>
        )}
        
        {/* Navigation Header — mobile: icon grid → view|date → tags; desktop: icons+tags | view+date */}
        <header className="flex flex-col mb-8 gap-0 relative z-30">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4 w-full min-w-0">
            {/* Left: mobile icon grid; desktop icon row + tag filter */}
            <div className="flex flex-col gap-2 flex-none w-full lg:flex-1 lg:min-w-0">
              <div className="grid grid-cols-4 gap-1 w-full lg:hidden justify-items-stretch">
                <div className="flex justify-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsSettingsModalOpen(true)}
                    className="rounded-full hover:bg-surface hover:shadow-sm transition-all text-muted-foreground hover:text-accent"
                  >
                    <Settings className="w-5 h-5" />
                  </Button>
                </div>
                <div className="flex justify-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (viewMode === 'collection') {
                        setViewMode(viewModeBeforeCollection);
                      } else {
                        setViewModeBeforeCollection(viewMode === 'day' || viewMode === 'month' || viewMode === 'year' ? viewMode : 'day');
                        setViewMode('collection');
                      }
                      setIsViewMenuOpen(false);
                      setIsTimePickerOpen(false);
                    }}
                    className={cn(
                      'rounded-full hover:bg-surface hover:shadow-sm transition-all',
                      viewMode === 'collection' ? 'text-accent bg-accent/20' : 'text-muted-foreground hover:text-accent'
                    )}
                    title={settings.language === 'zh' ? '时间聚合' : 'Time Synthesis'}
                  >
                    <Layers className="w-5 h-5" />
                  </Button>
                </div>
                <div className="flex justify-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (viewMode === 'lifeBook') {
                        setViewMode(viewModeBeforeCollection ?? 'day');
                      } else {
                        setViewModeBeforeCollection(viewMode === 'day' || viewMode === 'month' || viewMode === 'year' ? viewMode : 'day');
                        setViewMode('lifeBook');
                      }
                      setIsViewMenuOpen(false);
                      setIsTimePickerOpen(false);
                    }}
                    className={cn(
                      'rounded-full hover:bg-surface hover:shadow-sm transition-all',
                      viewMode === 'lifeBook' ? 'text-accent bg-accent/20' : 'text-muted-foreground hover:text-accent'
                    )}
                    title={settings.language === 'zh' ? '人生之书' : 'Life Book'}
                  >
                    <BookOpen className="w-5 h-5" />
                  </Button>
                </div>
                <div className="flex justify-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsSearchModalOpen(true)}
                    className="rounded-full hover:bg-surface hover:shadow-sm transition-all text-muted-foreground hover:text-accent"
                  >
                    <SearchIcon className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              <div className="hidden lg:flex items-center gap-2 flex-wrap">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSettingsModalOpen(true)}
                  className="rounded-full hover:bg-surface hover:shadow-sm transition-all text-muted-foreground hover:text-accent"
                >
                  <Settings className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (viewMode === 'collection') {
                      setViewMode(viewModeBeforeCollection);
                    } else {
                      setViewModeBeforeCollection(viewMode === 'day' || viewMode === 'month' || viewMode === 'year' ? viewMode : 'day');
                      setViewMode('collection');
                    }
                    setIsViewMenuOpen(false);
                    setIsTimePickerOpen(false);
                  }}
                  className={cn(
                    'rounded-full hover:bg-surface hover:shadow-sm transition-all',
                    viewMode === 'collection' ? 'text-accent bg-accent/20' : 'text-muted-foreground hover:text-accent'
                  )}
                  title={settings.language === 'zh' ? '时间聚合' : 'Time Synthesis'}
                >
                  <Layers className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (viewMode === 'lifeBook') {
                      setViewMode(viewModeBeforeCollection ?? 'day');
                    } else {
                      setViewModeBeforeCollection(viewMode === 'day' || viewMode === 'month' || viewMode === 'year' ? viewMode : 'day');
                      setViewMode('lifeBook');
                    }
                    setIsViewMenuOpen(false);
                    setIsTimePickerOpen(false);
                  }}
                  className={cn(
                    'rounded-full hover:bg-surface hover:shadow-sm transition-all',
                    viewMode === 'lifeBook' ? 'text-accent bg-accent/20' : 'text-muted-foreground hover:text-accent'
                  )}
                  title={settings.language === 'zh' ? '人生之书' : 'Life Book'}
                >
                  <BookOpen className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSearchModalOpen(true)}
                  className="rounded-full hover:bg-surface hover:shadow-sm transition-all text-muted-foreground hover:text-accent"
                >
                  <SearchIcon className="w-5 h-5" />
                </Button>

                <AnimatePresence>
                  {viewMode !== 'day' && uniqueTagsInView.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      className="flex items-center gap-1.5 flex-wrap"
                    >
                      {selectedFilterTag && (
                        <button
                          type="button"
                          onClick={() => setSelectedFilterTag(null)}
                          className="w-7 h-7 flex items-center justify-center rounded-full bg-field text-muted-foreground hover:bg-accent/15 active:bg-accent/25 transition-colors flex-shrink-0"
                          title={settings.language === 'zh' ? '清除筛选' : 'Clear filter'}
                        >
                          <FilterX className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {uniqueTagsInView.map(tag => {
                        const count = tagCountsInView[tag] ?? 0;
                        const isActive = selectedFilterTag === tag;
                        return (
                          <button
                            type="button"
                            key={tag}
                            onClick={() => setSelectedFilterTag(prev => prev === tag ? null : tag)}
                            className={cn(
                              'flex items-center gap-1 pl-1.5 pr-2 h-7 rounded-full text-sm transition-all flex-shrink-0',
                              isActive
                                ? 'bg-accent/20 ring-2 ring-accent shadow-sm'
                                : 'bg-field hover:bg-accent/15 active:bg-accent/25 hover:shadow-sm'
                            )}
                          >
                            <span>{tag}</span>
                            <span className={cn(
                              'text-[10px] font-semibold tabular-nums leading-none px-1 py-0.5 rounded-full',
                              isActive ? 'bg-accent/30 text-accent' : 'bg-field text-muted-foreground'
                            )}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                      {selectedFilterTag && (
                        <span className="text-xs text-accent font-medium pl-0.5">
                          {selectedFilterTag}{' '}
                          {settings.language === 'zh'
                            ? `· ${tagCountsInView[selectedFilterTag] ?? 0} 天`
                            : `· ${tagCountsInView[selectedFilterTag] ?? 0} day${(tagCountsInView[selectedFilterTag] ?? 0) !== 1 ? 's' : ''}`}
                        </span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* View + date: mobile date left / view right (DOM reverse); desktop view then date */}
            <div
              ref={menuGroupRef}
              className="flex flex-row-reverse lg:flex-row items-center gap-2 justify-between w-full min-w-0 lg:w-auto lg:justify-end lg:flex-wrap shrink-0"
            >
              <div className="relative shrink-0 z-[60]">
                <button
                  type="button"
                  onClick={() => {
                    setIsViewMenuOpen(!isViewMenuOpen);
                    setIsTimePickerOpen(false);
                  }}
                  className={cn(
                    'flex items-center gap-1 border px-2 sm:px-3 py-2 rounded-lg text-sm font-medium transition-colors min-w-0 max-w-[min(11rem,42vw)] justify-between',
                    isViewMenuOpen
                      ? 'border-accent bg-accent/20 text-accent'
                      : 'border-accent/35 bg-accent/5 text-foreground hover:bg-accent/15 hover:border-accent/55'
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {viewMode === 'year' && <Grid className="w-4 h-4 shrink-0 text-accent" />}
                    {viewMode === 'month' && <CalendarIcon className="w-4 h-4 shrink-0 text-accent" />}
                    {viewMode === 'day' && <List className="w-4 h-4 shrink-0 text-accent" />}
                    {viewMode === 'collection' && <Layers className="w-4 h-4 shrink-0 text-accent" />}
                    {viewMode === 'lifeBook' && <BookOpen className="w-4 h-4 shrink-0 text-accent" />}
                    <span className="truncate">{currentViewLabel}</span>
                  </div>
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 shrink-0 transition-transform',
                      isViewMenuOpen ? 'text-accent rotate-180' : 'text-muted-foreground'
                    )}
                  />
                </button>

                <AnimatePresence>
                  {isViewMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      className="absolute right-0 top-full z-[60] mt-2 w-48 max-h-[min(16rem,70vh)] overflow-y-auto overflow-x-hidden rounded-xl border border-accent/30 bg-accent/10 py-1 shadow-xl backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-accent/20"
                    >
                    {viewOptions.map((option) => (
                      <button
                        type="button"
                        key={option.id}
                        onClick={() => {
                          if (option.id === 'lifeBook') {
                            setViewModeBeforeCollection(viewMode === 'lifeBook' ? viewModeBeforeCollection : viewMode);
                          }
                          setViewMode(option.id);
                          setIsViewMenuOpen(false);
                          setIsTimePickerOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors',
                          viewMode === option.id
                            ? 'text-accent font-medium bg-accent/20'
                            : 'text-foreground hover:bg-accent/15 active:bg-accent/25'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <option.icon className={cn('w-4 h-4', viewMode === option.id ? 'text-accent' : 'text-muted-foreground')} />
                          {option.label}
                        </div>
                        {viewMode === option.id && <Check className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="min-w-0 flex-1 flex items-center justify-start gap-1">
            {viewMode === 'day' && (
              <div className="flex items-center gap-1 overflow-x-auto min-w-0 flex-1">
                <Button variant="ghost" size="icon" onClick={() => navigateDate('prev')} className="rounded-full hover:bg-accent/15 active:bg-accent/25 transition-all shrink-0">
                  <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                </Button>
                <input
                  type="date"
                  value={format(currentDate, 'yyyy-MM-dd')}
                  min={minDateStr}
                  max={maxDateStr}
                  onChange={e => {
                    if (e.target.value) setCurrentDate(new Date(e.target.value + 'T12:00:00'));
                  }}
                  className="text-sm font-medium text-foreground bg-transparent hover:bg-accent/15 active:bg-accent/25 px-2 sm:px-3 py-1.5 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-accent min-w-0"
                />
                <Button variant="ghost" size="icon" onClick={() => navigateDate('next')} className="rounded-full hover:bg-accent/15 active:bg-accent/25 transition-all shrink-0">
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </Button>
              </div>
            )}

            {viewMode !== 'day' && viewMode !== 'collection' && viewMode !== 'lifeBook' && (
              <div className="relative flex items-stretch shrink-0">
                <div
                  className={cn(
                    'flex min-w-0 items-stretch overflow-hidden rounded-lg transition-colors',
                    isTimePickerOpen ? 'bg-accent/20' : 'bg-accent/5 hover:bg-accent/15'
                  )}
                >
                  <div className="flex min-w-0 items-center">
                    {viewMode === 'year' ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        value={yearInputValue}
                        onChange={(e) => setYearInputValue(e.target.value.replace(/\D/g, ''))}
                        onBlur={handleYearBlur}
                        onKeyDown={handleYearKeyDown}
                        className="w-14 text-sm font-medium text-accent placeholder:text-accent/50 bg-transparent px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-accent"
                        placeholder={String(currentYear)}
                      />
                    ) : (
                      <>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={4}
                          value={yearInputValue}
                          onChange={(e) => setYearInputValue(e.target.value.replace(/\D/g, ''))}
                          onBlur={handleYearBlur}
                          onKeyDown={handleYearKeyDown}
                          className="w-14 min-w-[3.5rem] text-sm font-medium text-accent placeholder:text-accent/50 bg-transparent px-2 py-2 focus:outline-none focus:ring-1 focus:ring-accent"
                          placeholder={String(currentYear)}
                        />
                        <span className="text-sm font-medium text-accent pr-1 whitespace-nowrap">
                          {currentMonthLabel}
                        </span>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTimePickerOpen(prev => !prev);
                      setIsViewMenuOpen(false);
                    }}
                    className={cn(
                      'inline-flex shrink-0 items-center justify-center px-2 text-sm font-medium text-accent transition-colors',
                      !isTimePickerOpen && 'hover:bg-accent/15 active:bg-accent/25'
                    )}
                  >
                    <ChevronDown className={cn('w-4 h-4 transition-transform', isTimePickerOpen && 'rotate-180')} />
                  </button>
                </div>

                <AnimatePresence>
                  {isTimePickerOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="absolute right-0 max-sm:left-1/2 max-sm:-translate-x-1/2 sm:right-0 top-full z-[70] mt-2 w-[min(260px,calc(100vw-1.5rem))] rounded-xl border border-border/50 bg-surface/65 p-3 shadow-xl overflow-x-hidden backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-border/30"
                    >
                      <div className="space-y-3">
                        <div>
                          <button
                            type="button"
                            onClick={viewMode === 'year' ? handleGoToCurrentYear : handleGoToCurrentMonth}
                            className="w-full px-2.5 py-2 rounded-md text-sm font-medium text-accent bg-accent/10 hover:bg-accent/25 active:bg-accent/30 text-left border border-accent/60 mb-2 shrink-0 transition-colors"
                          >
                            {viewMode === 'year'
                              ? (settings.language === 'zh' ? '当前年' : 'Current year')
                              : (settings.language === 'zh' ? '当前月' : 'Current month')}
                          </button>
                          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                            {settings.language === 'zh' ? '年份' : 'Year'}
                          </label>
                          {viewMode === 'year' ? (
                            <div
                              ref={yearListScrollRef}
                              className="max-h-[min(200px,45vh)] min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y flex flex-col gap-0.5 [-webkit-overflow-scrolling:touch]"
                            >
                              {yearOptions.map((year) => {
                                const isActive = currentDate.getFullYear() === year;
                                return (
                                  <button
                                    key={year}
                                    onClick={() => handleYearSelect(year)}
                                    className={cn(
                                      "w-full px-2.5 py-2 rounded-md text-sm font-medium transition-colors text-left",
                                      isActive
                                        ? "bg-accent/20 text-accent ring-1 ring-accent"
                                        : "bg-transparent text-foreground hover:bg-accent/15 active:bg-accent/25"
                                    )}
                                  >
                                    {settings.language === 'zh' ? `${year}年` : year}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <select
                              value={currentDate.getFullYear()}
                              onChange={(e) => handleYearSelect(parseInt(e.target.value, 10))}
                              className="block w-auto max-w-[9rem] min-w-[7rem] text-sm font-medium text-accent bg-accent/10 hover:bg-accent/25 active:bg-accent/30 border border-accent/45 px-2.5 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-accent/60"
                            >
                              {yearOptions.map((year) => (
                                <option key={year} value={year}>
                                  {settings.language === 'zh' ? `${year}年` : year}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {viewMode === 'month' && (
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                              {settings.language === 'zh' ? '月份' : 'Month'}
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                              {monthButtonLabels.map((label, idx) => {
                                const isActive = currentDate.getMonth() === idx;
                                return (
                                  <button
                                    key={label}
                                    onClick={() => handleMonthPick(idx)}
                                    className={cn(
                                      "px-2 py-1.5 rounded-md text-xs font-medium transition-colors",
                                      isActive
                                        ? "bg-accent/20 text-accent ring-1 ring-accent"
                                        : "bg-accent/5 text-foreground hover:bg-accent/15 active:bg-accent/25 border border-transparent hover:border-accent/30"
                                    )}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
          </div>

            <div className="lg:hidden w-full">
              <AnimatePresence>
                {viewMode !== 'day' && uniqueTagsInView.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    className="flex items-center gap-1.5 flex-wrap"
                  >
                    {selectedFilterTag && (
                      <button
                        type="button"
                        onClick={() => setSelectedFilterTag(null)}
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-field text-muted-foreground hover:bg-accent/15 active:bg-accent/25 transition-colors flex-shrink-0"
                        title={settings.language === 'zh' ? '清除筛选' : 'Clear filter'}
                      >
                        <FilterX className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {uniqueTagsInView.map(tag => {
                      const count = tagCountsInView[tag] ?? 0;
                      const isActive = selectedFilterTag === tag;
                      return (
                        <button
                          type="button"
                          key={tag}
                          onClick={() => setSelectedFilterTag(prev => prev === tag ? null : tag)}
                          className={cn(
                            'flex items-center gap-1 pl-1.5 pr-2 h-7 rounded-full text-sm transition-all flex-shrink-0',
                            isActive
                              ? 'bg-accent/20 ring-2 ring-accent shadow-sm'
                              : 'bg-field hover:bg-accent/15 active:bg-accent/25 hover:shadow-sm'
                          )}
                        >
                          <span>{tag}</span>
                          <span className={cn(
                            'text-[10px] font-semibold tabular-nums leading-none px-1 py-0.5 rounded-full',
                            isActive ? 'bg-accent/30 text-accent' : 'bg-field text-muted-foreground'
                          )}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                    {selectedFilterTag && (
                      <span className="text-xs text-accent font-medium pl-0.5">
                        {selectedFilterTag}{' '}
                        {settings.language === 'zh'
                          ? `· ${tagCountsInView[selectedFilterTag] ?? 0} 天`
                          : `· ${tagCountsInView[selectedFilterTag] ?? 0} day${(tagCountsInView[selectedFilterTag] ?? 0) !== 1 ? 's' : ''}`}
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Row 2: 年/月/时间聚合/人生之书 — 整页居中 */}
          {viewMode !== 'day' && (
            <div className="w-full flex flex-col items-center justify-center mt-5 gap-1">
              {viewMode === 'year' || viewMode === 'month' ? (
                <div className="flex w-full justify-center px-2">
                  <div className="inline-flex items-center gap-0.5 sm:gap-1 max-w-full">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => navigateDate('prev')}
                      className="rounded-full shrink-0 h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground hover:text-accent hover:bg-accent/20 active:bg-accent/30"
                      aria-label={
                        viewMode === 'year'
                          ? (settings.language === 'zh' ? '上一年' : 'Previous Year')
                          : (settings.language === 'zh' ? '上一月' : 'Previous Month')
                      }
                    >
                      <ChevronLeft className="w-5 h-5 sm:w-5 sm:h-5" />
                    </Button>
                    <div className="text-xl md:text-3xl font-semibold tracking-tight text-foreground text-center px-1 sm:px-2 shrink-0">
                      {leftDateTitle}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => navigateDate('next')}
                      className="rounded-full shrink-0 h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground hover:text-accent hover:bg-accent/20 active:bg-accent/30"
                      aria-label={
                        viewMode === 'year'
                          ? (settings.language === 'zh' ? '下一年' : 'Next Year')
                          : (settings.language === 'zh' ? '下一月' : 'Next Month')
                      }
                    >
                      <ChevronRight className="w-5 h-5 sm:w-5 sm:h-5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-xl md:text-3xl font-semibold tracking-tight text-foreground">
                  {viewMode === 'lifeBook'
                    ? (settings.language === 'zh' ? '人生之书' : 'Life Book')
                    : viewMode === 'collection'
                      ? (settings.language === 'zh' ? '时间聚合' : 'Time Synthesis')
                      : leftDateTitle}
                </div>
              )}
              {viewMode === 'lifeBook' && (
                <p className="text-sm tracking-wide" style={{ color: 'var(--app-muted)' }}>
                  {settings.language === 'zh' ? '正在书写的人生故事' : 'the evolving story of who I am'}
                </p>
              )}
              {viewMode === 'collection' && (
                <p className="text-sm tracking-wide transition-opacity duration-500" style={{ color: 'var(--app-muted)' }}>
                  {settings.language === 'zh'
                    ? COLLECTION_SUBTITLES_ZH[collectionSubtitleIndex % COLLECTION_SUBTITLES_ZH.length]
                    : COLLECTION_SUBTITLES_EN[collectionSubtitleIndex % COLLECTION_SUBTITLES_EN.length]}
                </p>
              )}
              {viewMode === 'year' && yearKpiAvg && (
                <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-0.5 text-sm" style={{ color: 'var(--app-muted)' }}>
                  <span className="inline-flex items-center gap-1"><img src={VIBE_ICON_URL.energy} alt="" className="vibe-kpi-icon w-4 h-4" /> {settings.language === 'zh' ? '能量' : 'Energy'} {yearKpiAvg.energy != null ? yearKpiAvg.energy : '–'}</span>
                  <span className="inline-flex items-center gap-1"><img src={VIBE_ICON_URL.mood} alt="" className="vibe-kpi-icon w-4 h-4" /> {settings.language === 'zh' ? '心情' : 'Mood'} {yearKpiAvg.mood != null ? yearKpiAvg.mood : '–'}</span>
                  <span className="inline-flex items-center gap-1"><img src={VIBE_ICON_URL.focus} alt="" className="vibe-kpi-icon w-4 h-4" /> {settings.language === 'zh' ? '专注' : 'Focus'} {yearKpiAvg.focus != null ? yearKpiAvg.focus : '–'}</span>
                </div>
              )}
              {viewMode === 'month' && monthKpiAvg && (
                <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-0.5 text-sm" style={{ color: 'var(--app-muted)' }}>
                  <span className="inline-flex items-center gap-1"><img src={VIBE_ICON_URL.energy} alt="" className="vibe-kpi-icon w-4 h-4" /> {settings.language === 'zh' ? '能量' : 'Energy'} {monthKpiAvg.energy != null ? monthKpiAvg.energy : '–'}</span>
                  <span className="inline-flex items-center gap-1"><img src={VIBE_ICON_URL.mood} alt="" className="vibe-kpi-icon w-4 h-4" /> {settings.language === 'zh' ? '心情' : 'Mood'} {monthKpiAvg.mood != null ? monthKpiAvg.mood : '–'}</span>
                  <span className="inline-flex items-center gap-1"><img src={VIBE_ICON_URL.focus} alt="" className="vibe-kpi-icon w-4 h-4" /> {settings.language === 'zh' ? '专注' : 'Focus'} {monthKpiAvg.focus != null ? monthKpiAvg.focus : '–'}</span>
                </div>
              )}
            </div>
          )}
        </header>

        {/* Main Content */}
        <main className="flex-1 relative z-10 flex flex-col min-h-0">
          <AnimatePresence mode="wait">
            {viewMode === 'collection' && (
              <motion.div
                key="collection-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="py-8"
              >
                <CollectionView
                  events={events}
                  dayTags={dayTags}
                  dayNames={dayNames}
                  dayVibes={dayVibesData}
                  completedInstances={completedInstances}
                  language={settings.language}
                  timeDisplay={settings.timeDisplay}
                  journalEntries={journalEntries}
                  onRenameLongTermGoal={handleRenameLongTermGoal}
                  onDeleteLongTermGoal={handleDeleteLongTermGoal}
                  onMigrateEventRole={handleMigrateEventRole}
                  onClearEventRole={handleClearEventRole}
                  onMigrateEventTag={handleMigrateEventTag}
                  onClearEventTag={handleClearEventTag}
                  onOpenBatchEditor={openBatchEditor}
                  onOpenGoalLinking={() => openGoalLinking('month')}
                  chartFilters={chartFilters}
                  onChartFiltersChange={(next) => setTagFilters((prev) => ({ ...prev, ...next }))}
                  userId={user?.id ?? null}
                  collectionStateRevision={collectionStateTick}
                />
              </motion.div>
            )}

            {viewMode === 'lifeBook' && (
              <motion.div
                key="lifebook-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="flex flex-1 flex-col min-h-[60vh] max-md:min-h-[calc(60vh*1.2)] py-8"
              >
                <LifeBookView
                  chapters={lifeBookChapters}
                  events={events}
                  completedInstances={completedInstances}
                  language={settings.language}
                  onClose={() => setViewMode(viewModeBeforeCollection ?? 'day')}
                  userDisplayName={user?.email?.split('@')[0] ?? undefined}
                  storageRevision={collectionStateTick}
                />
              </motion.div>
            )}

            {viewMode === 'year' && (
              <motion.div
                key="year-view"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="py-8"
              >
                <YearView 
                  currentDate={currentDate}
                  onMonthSelect={(date) => {
                    setCurrentDate(date);
                    setViewMode('month');
                  }}
                  events={events}
                  dayTags={dayTags}
                  completedInstances={completedInstances}
                  selectedFilterTag={selectedFilterTag}
                  selectedFilterRole={selectedFilterRole}
                  roleFilterMode={roleFilterMode}
                  getRoleColor={getRoleColor}
                  highlightDates={searchHighlightDates}
                  language={settings.language}
                  dayVibes={dayVibesData}
                />
              </motion.div>
            )}

            {viewMode === 'month' && (
              <motion.div
                key="month-view"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="py-8"
              >
                <CalendarView 
                  currentDate={currentDate} 
                  onDateSelect={(date) => {
                    setCurrentDate(date);
                    setViewMode('day');
                  }}
                  events={events}
                  dayNames={dayNames}
                  dayTags={dayTags}
                  completedInstances={completedInstances}
                  selectedFilterTag={selectedFilterTag}
                  selectedFilterRole={selectedFilterRole}
                  roleFilterMode={roleFilterMode}
                  getRoleColor={getRoleColor}
                  highlightDates={searchHighlightDates}
                  language={settings.language}
                  dayVibes={dayVibesData}
                />
              </motion.div>
            )}

            {viewMode === 'day' && (
              <motion.div
                key="day-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <DayHeader 
                  date={currentDate} 
                  dayName={currentDayName}
                  onRandomDayName={handleRandomDayName}
                  onNameChange={handleManualNameChange}
                  language={settings.language}
                  currentTag={dayTags[dateKey]}
                  onSelectTag={handleSetDayTag}
                  customTags={settings.customTags}
                  onAddCustomTag={handleAddCustomTag}
                  onRemoveCustomTag={handleRemoveCustomTag}
                />

                {/*
                  Layout:
                  Past   mobile:  每日意义 → DayVibes → 日程表
                  Past   desktop: 每日意义（上）| DayVibes（右） / 日程表（下）
                  Current/Future mobile:  DayVibes → 日程表 → 每日意义
                  Current/Future desktop: 日程表（上）| DayVibes（右） / 每日意义（下）
                */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:items-start">
                  {/* DayVibes: desktop 右列固定；mobile 顺序随 isPast (row-start 显式定位) */}
                  <div className={cn(
                    "space-y-4 md:col-start-3 md:row-start-1 md:row-span-2 md:sticky md:top-4",
                    isPast ? "row-start-2" : "row-start-3"
                  )}>
                    <DayVibes
                      dateKey={dateKey}
                      energy={dayVibesData[dateKey]?.energy}
                      mood={dayVibesData[dateKey]?.mood}
                      focus={dayVibesData[dateKey]?.focus}
                      language={settings.language}
                      onChange={handleSetVibes}
                    />
                    {!isPast && (
                      <SurpriseWidgets
                        theme={settings.theme}
                        language={settings.language}
                        dateKey={dateKey}
                        quoteStore={user ? {
                          get: async (dk) => dailyQuotes[dk] || null,
                          set: async (dk, q) => {
                            await upsertDailyQuote(supabase, user.id, dk, q);
                            setDailyQuotes(prev => ({ ...prev, [dk]: q }));
                          }
                        } : undefined}
                      />
                    )}
                  </div>

                  {/* 每日意义: past → row1；current → row2(mobile)/row2(desktop) */}
                  <div className={cn(
                    "md:col-span-2 md:col-start-1 min-w-0",
                    isPast ? "row-start-1 md:row-start-1" : "row-start-2 md:row-start-2"
                  )}>
                    <DailyJournal
                      key={dateKey}
                      date={currentDate}
                      entryDateKey={dateKey}
                      events={currentDayEvents}
                      initialSummary={currentJournal}
                      onSave={handleSaveJournal}
                      language={settings.language}
                      isPast={isPast}
                      dayName={dayNames[dateKey]?.name}
                      dayNameIsManual={dayNames[dateKey]?.isManual}
                      dayTag={dayTags[dateKey]}
                      energy={dayVibesData[dateKey]?.energy}
                      mood={dayVibesData[dateKey]?.mood}
                      focus={dayVibesData[dateKey]?.focus}
                    />
                  </div>

                  {/* 日程表: past → row3(mobile)/row2(desktop)；current → row1(mobile)/row1(desktop) */}
                  <div className={cn(
                    "bg-surface/90 backdrop-blur-xl w-full min-w-0 rounded-2xl md:rounded-[2.5rem] px-3 py-4 md:p-10 shadow-xl border border-border min-h-0 md:min-h-[400px] max-md:max-h-[min(70vh,560px)] max-md:overflow-y-auto overscroll-y-contain md:col-span-2 md:col-start-1",
                    isPast ? "row-start-3 md:row-start-2" : "row-start-1 md:row-start-1"
                  )} style={{ boxShadow: 'var(--app-card-shadow)' }}>
                    <Timeline
                      events={currentDayEvents}
                      onAddEvent={() => { setEditingEvent(null); setIsAddModalOpen(true); }}
                      onEventClick={(e) => {
                        const baseEvent = events.find(ev => ev.id === (e.baseEventId || e.id));
                        setEditingEvent(baseEvent || e);
                        setIsAddModalOpen(true);
                      }}
                      onToggleComplete={handleToggleComplete}
                      language={settings.language}
                      timeDisplay={settings.timeDisplay}
                      onGenerateSchedule={isPast ? undefined : handleGenerateSchedule}
                      generatingMode={generatingMode}
                      selectedFilterRole={selectedFilterRole}
                      roleFilterMode={roleFilterMode}
                      getRoleColor={getRoleColor}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="mt-12 text-center text-muted-foreground text-xs font-light space-y-1 leading-relaxed">
          <p>© 2026 My Life Book</p>
          <p>
            Have Fun With Developer{' '}
            <a
              href="https://www.lucindazin.us.ci"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline-offset-2 hover:underline"
            >
              Lucinda
            </a>
          </p>
        </footer>
      </div>

      <AddEventModal 
        isOpen={isAddModalOpen} 
        onClose={() => { setIsAddModalOpen(false); setEditingEvent(null); }} 
        onAdd={handleAddEvent}
        onDelete={handleDeleteEvent}
        selectedDate={currentDate}
        language={settings.language}
        initialEvent={editingEvent}
        events={events}
        goalsUsedInLast28Days={goalsUsedInLast28Days}
        collectionStateRevision={collectionStateTick}
      />

      <GoalLinkingDrawer
        isOpen={isGoalLinkingOpen}
        onClose={() => setIsGoalLinkingOpen(false)}
        events={events}
        allEvents={events}
        goalNames={longTermGoalNames}
        metaMap={longTermGoalMetaMap}
        anchorDate={currentDate}
        filters={goalLinkingFilters}
        completedInstances={completedInstances}
        language={settings.language}
        onFiltersChange={setGoalLinkingFilters}
        onSave={handleSaveGoalLinks}
        isSaving={isGoalLinkingSaving}
      />

      <ScheduleSuggestionModal
        isOpen={isSuggestionModalOpen}
        onClose={() => setIsSuggestionModalOpen(false)}
        suggestions={suggestedEvents}
        onConfirm={handleConfirmSchedule}
        onRegenerate={() => {
           const mode = lastGenerateMode || 'chill';
           handleGenerateSchedule(mode);
        }}
        isRegenerating={!!generatingMode}
        mode={lastGenerateMode}
        language={settings.language}
        timeDisplay={settings.timeDisplay}
      />

      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        events={events}
        language={settings.language}
        timeDisplay={settings.timeDisplay}
        onEventClick={(date) => {
          setCurrentDate(date);
        }}
        completedInstances={completedInstances}
        onHighlightsChange={(dates) => setSearchHighlightDates(new Set(dates))}
        selectedFilterRole={selectedFilterRole}
        onRoleFilterChange={setSelectedFilterRole}
        roleFilterMode={roleFilterMode}
        onRoleFilterModeChange={setRoleFilterMode}
        getRoleColor={getRoleColor}
        getRoleDisplayName={getRoleDisplayName}
      />

      <TagBatchEditorDrawer
        isOpen={isBatchEditorOpen}
        onClose={() => setIsBatchEditorOpen(false)}
        events={events}
        allEvents={events}
        filters={tagFilters}
        language={settings.language}
        onFiltersChange={setTagFilters}
        onSave={handleBatchSaveTags}
        isSaving={isBatchSaving}
      />
    </div>
  );
}
