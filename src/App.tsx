import React, { useState, useEffect, useRef } from 'react';
import { format, addDays, subDays, isSameDay, isBefore, startOfDay, addYears, subYears, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, eachDayOfInterval } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, Grid, ChevronDown, Check, Settings, Search as SearchIcon, FilterX, BookOpen, Layers } from 'lucide-react';
import { SearchModal } from '@/components/SearchModal';
import { motion, AnimatePresence } from 'motion/react';
import { v4 as uuidv4 } from 'uuid';

import { Timeline } from '@/components/Timeline';
import { DayHeader } from '@/components/DayHeader';
import { AddEventModal } from '@/components/AddEventModal';
import { Chatbot } from '@/components/Chatbot';
import { CalendarView } from '@/components/CalendarView';
import { YearView } from '@/components/YearView';
import { SurpriseWidgets } from '@/components/SurpriseWidgets';
import { OnboardingModal } from '@/components/OnboardingModal';
import { SettingsModal } from '@/components/SettingsModal';
import { DailyJournal } from '@/components/DailyJournal';
import { AuthModal } from '@/components/AuthModal';
import { Button } from '@/components/ui/button';
import { ScheduleEvent, AppSettings, AppTheme, AppLanguage, CustomTag } from '@/types';
import { generateDayName } from '@/lib/gemini';
import { cn, getRandomDayName } from '@/lib/utils';
import { expandRecurringEvents } from '@/lib/events';
import { useAuth } from '@/lib/auth/useAuth';
import { supabase } from '@/lib/supabase/client';
import { listAllEventsWithTags, upsertEventWithTags } from '@/lib/repositories/eventsRepo';
import { listAllCompletions, setInstanceCompletion } from '@/lib/repositories/completionsRepo';
import { listAllDayMeta, upsertDayMeta, DayVibes as DayVibesData } from '@/lib/repositories/dayMetaRepo';
import { VIBE_ICON_URL } from '@/lib/vibeIcons';
import { listAllDailyQuotes, upsertDailyQuote } from '@/lib/repositories/dailyQuotesRepo';

import { ScheduleSuggestionModal } from '@/components/ScheduleSuggestionModal';
import { DayVibes } from '@/components/DayVibes';
import { CollectionView } from '@/components/CollectionView';
import { LifeBookView } from '@/components/LifeBookView';
import { GeminiUserKeyProvider } from '@/contexts/GeminiUserKeyContext';
import { getLocalScheduleSuggestions } from '@/lib/scheduleLocalSuggestions';
import { getChapters, type SavedChapter } from '@/lib/chaptersStorage';
import { PRESET_ROLES, getRoleDisplayName, getRoleColor } from '@/lib/constants/roles';

export default function App() {
  const { user, isLoading: authLoading, signInWithEmail, verifyEmailOtp, signOut, authCallbackError, clearAuthCallbackError } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dailyQuotes, setDailyQuotes] = useState<Record<string, { text: string; author?: string }>>({});
  const [hasSkippedAuth, setHasSkippedAuth] = useState<boolean>(() => {
    return localStorage.getItem('feather_skipped_auth') === '1';
  });
  const [lastGenerateMode, setLastGenerateMode] = useState<'chill' | 'productive' | null>(null);
  const scheduleGenNonceRef = useRef(0);

  // Settings State
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('feather_settings');
    return saved ? JSON.parse(saved) : { theme: 'artsy', language: 'en', hasCompletedOnboarding: false };
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
  const [searchHighlightDates, setSearchHighlightDates] = useState<Set<string>>(new Set());
  
  // Schedule Generation State
  const [generatingMode, setGeneratingMode] = useState<'chill' | 'productive' | null>(null);
  const [suggestedEvents, setSuggestedEvents] = useState<ScheduleEvent[]>([]);
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);

  const [viewMode, setViewMode] = useState<'day' | 'month' | 'year' | 'collection' | 'lifeBook'>('day');
  const [viewModeBeforeCollection, setViewModeBeforeCollection] = useState<'day' | 'month' | 'year'>('day');
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [selectedFilterTag, setSelectedFilterTag] = useState<string | null>(null);
  const [selectedFilterRole, setSelectedFilterRole] = useState<string | null>(null);
  const [roleFilterMode, setRoleFilterMode] = useState<'all' | 'dim' | 'hide'>('dim');
  const [yearInputValue, setYearInputValue] = useState('');
  const menuGroupRef = useRef<HTMLDivElement>(null);
  const yearListScrollRef = useRef<HTMLDivElement>(null);

  const deviceIdRef = useRef<string>('');
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

  // Online-first sync: load all user data after login
  useEffect(() => {
    const run = async () => {
      if (!user) return;
      setIsSyncing(true);
      setAuthError(null);
      try {
        // V1 device cap (free=1): backend should enforce via RPC.
        const deviceId = deviceIdRef.current;
        if (deviceId) {
          const { error } = await supabase.rpc('register_device', {
            device_id: deviceId,
            device_name: navigator.userAgent,
          });
          if (error) throw error;
        }

        const [evts, comps, dayMeta, quotes] = await Promise.all([
          listAllEventsWithTags(supabase, user.id),
          listAllCompletions(supabase, user.id),
          listAllDayMeta(supabase, user.id),
          listAllDailyQuotes(supabase, user.id),
        ]);

        setEvents(evts);
        setCompletedInstances(comps);
        setDayNames(dayMeta.dayNames);
        setDayTags(dayMeta.dayTags);
        setJournalEntries(dayMeta.journalEntries);
        setDayVibesData(dayMeta.dayVibes);
        setDailyQuotes(quotes);
      } catch (e: any) {
        setAuthError(e?.message || 'Failed to sync');
      } finally {
        setIsSyncing(false);
      }
    };
    run();
  }, [user]);

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

  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const currentDayName = dayNames[dateKey]?.name || '';
  const currentJournal = journalEntries[dateKey] || '';

  // Check if the current date is in the past (before today)
  const today = startOfDay(new Date());
  const isPast = isBefore(startOfDay(currentDate), today);

  // Keep ref for dayNames to avoid dependency loop
  const dayNamesRef = useRef(dayNames);
  useEffect(() => {
    dayNamesRef.current = dayNames;
  }, [dayNames]);

  // Generate day name when events change
  useEffect(() => {
    const generateName = async () => {
      const currentDayData = dayNamesRef.current[dateKey];
      
      // Don't overwrite if manual
      if (currentDayData?.isManual) return;

      // If name exists and language matches, don't touch it
      if (currentDayData?.name && currentDayData?.language === settings.language) return;

      if (currentDayEvents.length > 0) {
        const name = await generateDayName(currentDayEvents, settings.language);
        setDayNames(prev => ({
          ...prev,
          [dateKey]: { name, isManual: false, language: settings.language }
        }));
        if (user) {
          upsertDayMeta(supabase, user.id, dateKey, {
            day_name: name,
            day_name_is_manual: false,
            day_name_language: settings.language,
            day_tag: dayTags[dateKey] || null,
            journal: journalEntries[dateKey] || null,
          }).catch(() => {});
        }
      } else {
         // Always regenerate random name if language/theme changed
         const name = getRandomDayName(settings.theme, settings.language);
         setDayNames(prev => ({
          ...prev,
          [dateKey]: { name, isManual: false, language: settings.language }
        }));
        if (user) {
          upsertDayMeta(supabase, user.id, dateKey, {
            day_name: name,
            day_name_is_manual: false,
            day_name_language: settings.language,
            day_tag: dayTags[dateKey] || null,
            journal: journalEntries[dateKey] || null,
          }).catch(() => {});
        }
      }
    };
    
    // Debounce generation
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

  const handleGenerateName = async () => {
    if (currentDayEvents.length > 0) {
      const name = await generateDayName(currentDayEvents, settings.language);
      setDayNames(prev => ({
        ...prev,
        [dateKey]: { name, isManual: true, language: settings.language } // Treat explicit regeneration as manual/locked
      }));
      if (user) {
        upsertDayMeta(supabase, user.id, dateKey, {
          day_name: name,
          day_name_is_manual: true,
          day_name_language: settings.language,
          day_tag: dayTags[dateKey] || null,
          journal: journalEntries[dateKey] || null,
        }).catch(() => {});
      }
    } else {
      // If no events, just get a new random one based on theme
      const name = getRandomDayName(settings.theme, settings.language);
      setDayNames(prev => ({
        ...prev,
        [dateKey]: { name, isManual: false, language: settings.language }
      }));
      if (user) {
        upsertDayMeta(supabase, user.id, dateKey, {
          day_name: name,
          day_name_is_manual: false,
          day_name_language: settings.language,
          day_tag: dayTags[dateKey] || null,
          journal: journalEntries[dateKey] || null,
        }).catch(() => {});
      }
    }
  };

  const handleAddEvent = async (newEvent: ScheduleEvent) => {
    if (user) {
      try {
        await upsertEventWithTags(supabase, user.id, newEvent);
      } catch (e: any) {
        alert(e?.message || 'Failed to save event');
        return;
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

  const handleSaveJournal = (summary: string) => {
    setJournalEntries(prev => ({
      ...prev,
      [dateKey]: summary
    }));
    if (user) {
      upsertDayMeta(supabase, user.id, dateKey, {
        day_name: dayNames[dateKey]?.name || null,
        day_name_is_manual: dayNames[dateKey]?.isManual || false,
        day_name_language: (dayNames[dateKey]?.language as any) || settings.language,
        day_tag: dayTags[dateKey] || null,
        journal: summary || null,
      }).catch(() => {});
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
    if (viewMode === 'day') return { uniqueTagsInView: [], tagCountsInView: {} as Record<string, number> };

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

  const lifeBookChapters = viewMode === 'lifeBook' ? getChapters({ order: 'asc' }) : [];

  return (
    <GeminiUserKeyProvider
      language={settings.language}
      openSettingsForUserGeminiKey={() => {
        if (typeof window !== 'undefined') {
          window.location.hash = 'gemini';
        }
        setIsSettingsModalOpen(true);
      }}
    >
    <div className="min-h-screen font-sans" style={{ background: 'var(--app-bg)', color: 'var(--app-text)' }}>
      {!settings.hasCompletedOnboarding && (
        <OnboardingModal onComplete={setSettings} />
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
      />

      <AuthModal
        isOpen={!authLoading && !user && !hasSkippedAuth}
        language={settings.language}
        errorMessage={authCallbackError}
        onVerifyOtp={async (email, token) => {
          clearAuthCallbackError();
          const { error } = await verifyEmailOtp(email, token);
          return { error: error ?? undefined };
        }}
        onSendMagicLink={async (email, options) => {
          clearAuthCallbackError();
          const { error } = await signInWithEmail(email, options);
          if (error) {
            // 调试：输出 Supabase 原始错误，便于排查
            console.warn('[Auth] Supabase error:', { message: error.message, name: error.name, status: (error as { status?: number }).status });
            const msg = error.message || '';
            const isRateLimit = /rate limit|429/i.test(msg) || msg.includes('Email rate limit exceeded');
            const isCaptchaError = /captcha|verification process failed/i.test(msg);
            const isSmtpError = /error sending confirmation email|confirmation email|smtp|mail|535/i.test(msg);
            const friendlyMessage = isRateLimit
              ? (settings.language === 'zh'
                ? '发送次数过多，请稍后再试（约一小时后恢复）。'
                : 'Too many attempts. Please try again later (limit resets in about an hour).')
              : isCaptchaError
                ? (settings.language === 'zh'
                  ? 'CAPTCHA 验证失败。请在 Supabase 控制台关闭 CAPTCHA：Authentication → Settings → Bot and Abuse Protection → 关闭 Enable CAPTCHA protection；或在前端集成 reCAPTCHA/Turnstile 后传入 captcha_token。'
                  : 'CAPTCHA verification failed. Disable CAPTCHA in Supabase: Authentication → Settings → Bot and Abuse Protection; or integrate reCAPTCHA/Turnstile and pass captcha_token.')
                : isSmtpError
                  ? (settings.language === 'zh'
                    ? '邮件发送失败，请检查 Supabase 控制台：Authentication → SMTP 配置与 Auth 日志。'
                    : 'Email could not be sent. Check Supabase Dashboard: Authentication → SMTP settings and Auth logs.')
                  : msg;
            return { error: { ...error, message: friendlyMessage } };
          }
          return { error: undefined };
        }}
        onSkip={() => {
          setHasSkippedAuth(true);
          localStorage.setItem('feather_skipped_auth', '1');
          clearAuthCallbackError();
        }}
      />

      <div className="max-w-5xl lg:max-w-7xl mx-auto px-4 lg:px-8 py-8 md:py-12 min-h-screen flex flex-col">

        {authError && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
            {settings.language === 'zh' ? '同步失败：' : 'Sync failed: '} {authError}
          </div>
        )}
        {isSyncing && user && (
          <div className="mb-6 rounded-2xl border border-border bg-surface/80 px-4 py-3 text-foreground text-sm">
            {settings.language === 'zh' ? '正在同步数据…' : 'Syncing data…'}
          </div>
        )}
        
        {/* Navigation Header */}
        <header className="flex flex-col mb-8 gap-0 relative z-20">
          {/* Row 1: Left (settings + icons) | Right (view + nav) */}
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
            {/* Left: Settings, Search, Tag filter (in order, one row) */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
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
                  "rounded-full hover:bg-surface hover:shadow-sm transition-all",
                  viewMode === 'collection' ? "text-accent bg-accent/20" : "text-muted-foreground hover:text-accent"
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
                  "rounded-full hover:bg-surface hover:shadow-sm transition-all",
                  viewMode === 'lifeBook' ? "text-accent bg-accent/20" : "text-muted-foreground hover:text-accent"
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
                        onClick={() => setSelectedFilterTag(null)}
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-field text-muted-foreground hover:bg-surface transition-colors flex-shrink-0"
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
                          key={tag}
                          onClick={() => setSelectedFilterTag(prev => prev === tag ? null : tag)}
                          className={cn(
                            "flex items-center gap-1 pl-1.5 pr-2 h-7 rounded-full text-sm transition-all flex-shrink-0",
                            isActive
                              ? "bg-accent/20 ring-2 ring-accent shadow-sm"
                              : "bg-field hover:bg-surface hover:shadow-sm"
                          )}
                        >
                          <span>{tag}</span>
                          <span className={cn(
                            "text-[10px] font-semibold tabular-nums leading-none px-1 py-0.5 rounded-full",
                            isActive ? "bg-accent/30 text-accent" : "bg-field text-muted-foreground"
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

          {/* Right: View dropdown + Date navigation */}
          <div className="flex items-center gap-2 flex-wrap justify-end" ref={menuGroupRef}>
            <div className="relative">
              <button
                onClick={() => {
                  setIsViewMenuOpen(!isViewMenuOpen);
                  setIsTimePickerOpen(false);
                }}
                className="flex items-center gap-1.5 bg-transparent hover:bg-field px-3 py-2.5 rounded-lg text-foreground font-medium transition-colors min-w-[120px] justify-between"
              >
                <div className="flex items-center gap-2">
                  {viewMode === 'year' && <Grid className="w-4 h-4 text-accent" />}
                  {viewMode === 'month' && <CalendarIcon className="w-4 h-4 text-accent" />}
                  {viewMode === 'day' && <List className="w-4 h-4 text-accent" />}
                  {viewMode === 'collection' && <Layers className="w-4 h-4 text-accent" />}
                  {viewMode === 'lifeBook' && <BookOpen className="w-4 h-4 text-accent" />}
                  <span>{currentViewLabel}</span>
                </div>
                <ChevronDown className={cn("w-5 h-5 text-muted-foreground transition-transform flex-shrink-0", isViewMenuOpen && "rotate-180")} />
              </button>

              <AnimatePresence>
                {isViewMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    className="absolute top-full right-0 mt-2 w-48 bg-surface rounded-xl shadow-xl border border-border overflow-y-auto overflow-x-hidden py-1 z-50 max-h-[min(16rem,70vh)]"
                  >
                    {viewOptions.map((option) => (
                      <button
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
                          "w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-field",
                          viewMode === option.id ? "text-accent font-medium bg-accent/20" : "text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <option.icon className={cn("w-4 h-4", viewMode === option.id ? "text-accent" : "text-muted-foreground")} />
                          {option.label}
                        </div>
                        {viewMode === option.id && <Check className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {viewMode === 'day' && (
              <>
                <Button variant="ghost" size="icon" onClick={() => navigateDate('prev')} className="rounded-full hover:bg-field transition-all">
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
                  className="text-sm font-medium text-foreground bg-transparent hover:bg-field px-3 py-1.5 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <Button variant="ghost" size="icon" onClick={() => navigateDate('next')} className="rounded-full hover:bg-field transition-all">
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </Button>
              </>
            )}

            {viewMode !== 'day' && viewMode !== 'collection' && viewMode !== 'lifeBook' && (
              <div className="relative flex items-stretch">
                <div className={cn(
                  "flex items-center rounded-l-lg border border-r-0 transition-colors",
                  isTimePickerOpen
                    ? "border-accent bg-accent/20"
                    : "border-border bg-surface/80"
                )}>
                  {viewMode === 'year' ? (
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={yearInputValue}
                      onChange={(e) => setYearInputValue(e.target.value.replace(/\D/g, ''))}
                      onBlur={handleYearBlur}
                      onKeyDown={handleYearKeyDown}
                      className="w-14 text-sm font-medium text-foreground bg-transparent px-2.5 py-2 rounded-l-lg focus:outline-none focus:ring-1 focus:ring-accent"
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
                        className="w-14 min-w-[3.5rem] text-sm font-medium text-foreground bg-transparent px-2 py-2 rounded-l-lg focus:outline-none focus:ring-1 focus:ring-accent"
                        placeholder={String(currentYear)}
                      />
                      <span className="text-sm font-medium text-foreground pr-2 whitespace-nowrap">
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
                    "inline-flex items-center justify-center px-2 rounded-r-lg border transition-colors text-sm font-medium",
                    isTimePickerOpen
                      ? "border-accent bg-accent/20 text-accent"
                      : "border-border bg-surface/80 text-foreground hover:bg-surface border-l-0"
                  )}
                >
                  <ChevronDown className={cn("w-4 h-4 transition-transform", isTimePickerOpen && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {isTimePickerOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      className="absolute right-0 top-full mt-2 w-[260px] bg-surface rounded-xl border border-border shadow-xl p-3 z-50"
                    >
                      <div className="space-y-3">
                        <div>
                          <button
                            type="button"
                            onClick={viewMode === 'year' ? handleGoToCurrentYear : handleGoToCurrentMonth}
                            className="w-full px-2.5 py-2 rounded-md text-sm font-medium text-accent hover:bg-accent/20 text-left border border-accent/60 mb-2"
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
                              className="max-h-[200px] overflow-y-auto flex flex-col gap-0.5"
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
                                        : "bg-transparent text-foreground hover:bg-field"
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
                              className="w-full text-sm font-medium text-foreground bg-field hover:bg-surface border border-border px-2.5 py-2 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-accent"
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
                                        : "bg-field text-foreground hover:bg-surface"
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

          {/* Row 2: 年/月/时间聚合/人生之书 — 整页居中 */}
          {viewMode !== 'day' && (
            <div className="w-full flex flex-col items-center justify-center mt-5 gap-1">
              <div className="text-xl md:text-3xl font-semibold tracking-tight text-foreground">
                {viewMode === 'lifeBook'
                  ? (settings.language === 'zh' ? '人生之书' : 'Life Book')
                  : viewMode === 'collection'
                    ? (settings.language === 'zh' ? '时间聚合' : 'Time Synthesis')
                    : leftDateTitle}
              </div>
              {viewMode === 'lifeBook' && (
                <p className="text-sm tracking-wide" style={{ color: 'var(--app-muted)' }}>
                  {settings.language === 'zh' ? '正在书写的人生故事' : 'the evolving story of who I am'}
                </p>
              )}
              {viewMode === 'collection' && (
                <p className="text-sm tracking-wide" style={{ color: 'var(--app-muted)' }}>
                  {settings.language === 'zh' ? '编织你的时光，雕琢人生叙事' : 'weaving your timeline, crafting your narrative'}
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
                  journalEntries={journalEntries}
                />
              </motion.div>
            )}

            {viewMode === 'lifeBook' && (
              <motion.div
                key="lifebook-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="flex-1 flex flex-col min-h-[60vh] py-8"
              >
                <LifeBookView
                  chapters={lifeBookChapters}
                  events={events}
                  completedInstances={completedInstances}
                  language={settings.language}
                  onClose={() => setViewMode(viewModeBeforeCollection ?? 'day')}
                  userDisplayName={user?.email?.split('@')[0] ?? undefined}
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
                  onGenerateName={handleGenerateName}
                  onNameChange={handleManualNameChange}
                  language={settings.language}
                  currentTag={dayTags[dateKey]}
                  onSelectTag={handleSetDayTag}
                  customTags={settings.customTags}
                  onAddCustomTag={handleAddCustomTag}
                  onRemoveCustomTag={handleRemoveCustomTag}
                />

                {/* 2:1 grid layout: left=content, right=widgets */}
                <div className="grid gap-6 md:grid-cols-3">
                  {/* Left column (2/3): Timeline + Journal */}
                  <div className="md:col-span-2 space-y-6">
                    {isPast ? (
                      <DailyJournal
                        date={currentDate}
                        events={currentDayEvents}
                        initialSummary={currentJournal}
                        onSave={handleSaveJournal}
                        language={settings.language}
                        isPast={true}
                        dayName={dayNames[dateKey]?.name}
                        dayNameIsManual={dayNames[dateKey]?.isManual}
                        dayTag={dayTags[dateKey]}
                        energy={dayVibesData[dateKey]?.energy}
                        mood={dayVibesData[dateKey]?.mood}
                        focus={dayVibesData[dateKey]?.focus}
                      />
                    ) : (
                      <>
                        <div className="bg-surface/90 backdrop-blur-xl rounded-[2.5rem] p-6 md:p-10 shadow-xl border border-border min-h-[400px]" style={{ boxShadow: 'var(--app-card-shadow)' }}>
                          <Timeline 
                            events={currentDayEvents} 
                            onAddEvent={() => { setEditingEvent(null); setIsAddModalOpen(true); }}
                            onEventClick={(e) => console.log(e)}
                            onEventDoubleClick={(e) => { 
                              const baseEvent = events.find(ev => ev.id === (e.baseEventId || e.id));
                              setEditingEvent(baseEvent || e); 
                              setIsAddModalOpen(true); 
                            }}
                            onToggleComplete={handleToggleComplete}
                            language={settings.language}
                            onGenerateSchedule={handleGenerateSchedule}
                            generatingMode={generatingMode}
                            selectedFilterRole={selectedFilterRole}
                            roleFilterMode={roleFilterMode}
                            getRoleColor={getRoleColor}
                          />
                        </div>

                        <DailyJournal
                          date={currentDate}
                          events={currentDayEvents}
                          initialSummary={currentJournal}
                          onSave={handleSaveJournal}
                          language={settings.language}
                          isPast={false}
                          dayName={dayNames[dateKey]?.name}
                          dayNameIsManual={dayNames[dateKey]?.isManual}
                          dayTag={dayTags[dateKey]}
                          energy={dayVibesData[dateKey]?.energy}
                          mood={dayVibesData[dateKey]?.mood}
                          focus={dayVibesData[dateKey]?.focus}
                        />
                      </>
                    )}
                  </div>

                  {/* Right column (1/3): Vibes + Widgets */}
                  <div className="md:col-span-1 space-y-4 md:sticky md:top-4 md:self-start">
                    {/* Day Vibes sliders */}
                    <DayVibes
                      dateKey={dateKey}
                      energy={dayVibesData[dateKey]?.energy}
                      mood={dayVibesData[dateKey]?.mood}
                      focus={dayVibesData[dateKey]?.focus}
                      language={settings.language}
                      onChange={handleSetVibes}
                    />

                    {/* Quote / Visual / Song widgets */}
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
        selectedDate={currentDate}
        language={settings.language}
        initialEvent={editingEvent}
        events={events}
        goalsUsedInLast28Days={goalsUsedInLast28Days}
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
      />

      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        events={events}
        language={settings.language}
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

      <Chatbot context={JSON.stringify(currentDayEvents)} />
    </div>
    </GeminiUserKeyProvider>
  );
}
