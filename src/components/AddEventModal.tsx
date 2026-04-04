import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, CheckCircle2, Clock, Sparkles, Star, Sparkle, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EventType, ScheduleEvent, AppLanguage } from '@/types';
import { PRESET_ROLES, getPresetRole } from '@/lib/constants/roles';
import { v4 as uuidv4 } from 'uuid';
import { cn, getThemeAccentHex } from '@/lib/utils';
import { loadLongTermGoalMeta } from '@/lib/longTermGoalMetaStorage';
import {
  PRESET_EVENT_LABELS_ZH,
  PRESET_EVENT_LABELS_EN,
  isPresetEventLabel,
  touchCustomEventLabel,
  syncAndPruneCustomEventTags,
  loadSavedCustomEventTags,
  CUSTOM_EVENT_TAGS_KEY,
} from '@/lib/customEventTagsStorage';
import { format, addHours } from 'date-fns';
import * as chrono from 'chrono-node';

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (event: ScheduleEvent) => void | Promise<void>;
  /** 删除主日程（含重复日程母事件）；由 App 持久化 */
  onDelete?: (eventId: string) => void | Promise<void>;
  selectedDate: Date;
  language: AppLanguage;
  initialEvent?: ScheduleEvent | null;
  /** Used to prune saved goals with 0 events and to filter suggestions to last 28 days */
  events?: ScheduleEvent[];
  goalsUsedInLast28Days?: string[];
}

export const AddEventModal: React.FC<AddEventModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  onDelete,
  selectedDate,
  language,
  initialEvent,
  events: eventsProp,
  goalsUsedInLast28Days,
}) => {
  // Form State
  const [title, setTitle] = useState('');
  const [type, setType] = useState<EventType>('todo');
  const [date, setDate] = useState(format(selectedDate, 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [description, setDescription] = useState('');
  const [isTimeDetected, setIsTimeDetected] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [labelText, setLabelText] = useState('');
  const [labelColor, setLabelColor] = useState(() =>
    typeof document !== 'undefined' ? getThemeAccentHex() : '#6366F1'
  );
  const [selectedRoleId, setSelectedRoleId] = useState<string>(''); // '' = none, preset id, or 'custom'
  const [customRoleName, setCustomRoleName] = useState('');
  const [meaning, setMeaning] = useState('');
  const [starred, setStarred] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const [longTermGoalInput, setLongTermGoalInput] = useState('');
  const [longTermGoals, setLongTermGoals] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const meaningRef = useRef<HTMLTextAreaElement>(null);

  const LABEL_COLORS = [
    '#6B7280', // gray
    '#111827', // black
    '#2563EB', // 普蓝 blue-600
    '#15803D', // 深绿 green-700
    '#B45309', // 焦糖色 amber-700
    '#F97316', // orange（原最后一个）
    '#EF4444', // red
    '#8B5CF6', // violet
    '#22C55E', // green
    '#0EA5E9', // sky
  ] as const;

  const labelColorsForPicker = React.useMemo(() => {
    const accent = getThemeAccentHex();
    const rest = LABEL_COLORS.filter((c) => c.toLowerCase() !== accent.toLowerCase());
    return [accent, ...rest];
  }, [isOpen]);

  const [savedCustomTags, setSavedCustomTags] = useState<string[]>(() =>
    typeof window === 'undefined' ? [] : loadSavedCustomEventTags()
  );

  const LONG_TERM_GOALS_KEY = 'feather_long_term_goal_tags';
  const [savedLongTermGoals, setSavedLongTermGoals] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(window.localStorage.getItem(LONG_TERM_GOALS_KEY) || '[]');
    } catch {
      return [];
    }
  });

  const defaultLabels = language === 'zh' ? [...PRESET_EVENT_LABELS_ZH] : [...PRESET_EVENT_LABELS_EN];
  const suggestedLabels = [
    ...savedCustomTags,
    ...defaultLabels.filter((l) => !savedCustomTags.includes(l))
  ];
  const suggestedLongTermGoals =
    goalsUsedInLast28Days != null && goalsUsedInLast28Days.length >= 0
      ? savedLongTermGoals.filter((g) => goalsUsedInLast28Days.includes(g))
      : savedLongTermGoals;

  const CUSTOM_ROLES_USAGE_KEY = 'feather_custom_roles_usage';
  type RoleUsageItem = { id: string; count: number; lastUsed: number };
  const [customRolesUsage, setCustomRolesUsage] = useState<RoleUsageItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(window.localStorage.getItem(CUSTOM_ROLES_USAGE_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const sortedCustomRoleIds = React.useMemo(() => {
    return [...customRolesUsage]
      .sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed)
      .map((x) => x.id);
  }, [customRolesUsage]);

  const recordRoleUsage = useCallback((roleId: string) => {
    if (!roleId || !roleId.startsWith('custom:')) return;
    const name = roleId.slice(7).trim();
    if (!name) return;
    setCustomRolesUsage((prev) => {
      const now = Date.now();
      const existing = prev.find((x) => x.id === roleId);
      const next = existing
        ? prev.map((x) => (x.id === roleId ? { ...x, count: x.count + 1, lastUsed: now } : x))
        : [...prev, { id: roleId, count: 1, lastUsed: now }];
      try {
        window.localStorage.setItem(CUSTOM_ROLES_USAGE_KEY, JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  }, []);

  // Sync saved goal pool with goals already attached to events.
  // - Removes local-only goals that no longer exist in any event (stale suggestions).
  // - Adds goals found in events but not yet in local storage (cross-device sync).
  useEffect(() => {
    if (!isOpen || eventsProp == null) return;
    if (typeof window === 'undefined') return;
    const goalsInEvents = new Set<string>();
    eventsProp.forEach((e) => e.longTermGoals?.forEach((g) => goalsInEvents.add(g)));
    try {
      const saved: string[] = JSON.parse(window.localStorage.getItem(LONG_TERM_GOALS_KEY) || '[]');
      const metaGoalNames = new Set(Object.keys(loadLongTermGoalMeta()));
      // Keep goals still used in events, or still present in long-term meta (calendar-free visions).
      const keptFromSaved = saved.filter((g) => goalsInEvents.has(g) || metaGoalNames.has(g));
      const newFromEvents = Array.from(goalsInEvents).filter((g) => !saved.includes(g));
      const merged = [...keptFromSaved, ...newFromEvents];
      if (merged.length !== saved.length || newFromEvents.length > 0) {
        window.localStorage.setItem(LONG_TERM_GOALS_KEY, JSON.stringify(merged));
        setSavedLongTermGoals(merged);
      }
    } catch (_) {}
  }, [isOpen, eventsProp]);

  /** 挂载与每次打开弹窗时：清理超过 2 天未使用的自定义标签（预设不受影响） */
  useEffect(() => {
    const { tags } = syncAndPruneCustomEventTags();
    setSavedCustomTags(tags);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const { tags } = syncAndPruneCustomEventTags();
    setSavedCustomTags(tags);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (initialEvent) {
        setTitle(initialEvent.title);
        setType(initialEvent.type);
        const start = new Date(initialEvent.startTime);
        setDate(format(start, 'yyyy-MM-dd'));
        setStartTime(format(start, 'HH:mm'));
        if (initialEvent.endTime) {
          setEndTime(format(new Date(initialEvent.endTime), 'HH:mm'));
        } else {
          setEndTime(format(addHours(start, 1), 'HH:mm'));
        }
        setDescription(initialEvent.description || '');
        if (initialEvent.recurrence) {
          setRecurrenceFreq(initialEvent.recurrence.frequency);
          setRecurrenceInterval(initialEvent.recurrence.interval);
          if (initialEvent.recurrence.endDate) {
            setRecurrenceEndDate(format(new Date(initialEvent.recurrence.endDate), 'yyyy-MM-dd'));
          } else {
            setRecurrenceEndDate('');
          }
        } else {
          setRecurrenceFreq('none');
          setRecurrenceInterval(1);
          setRecurrenceEndDate('');
        }
        setLabelText(initialEvent.label?.text || '');
        setLabelColor(initialEvent.label?.color || getThemeAccentHex());
        if (initialEvent.role) {
          if (initialEvent.role.startsWith('custom:')) {
            setSelectedRoleId('custom');
            setCustomRoleName(initialEvent.role.slice(7).trim());
          } else {
            setSelectedRoleId(initialEvent.role);
            setCustomRoleName('');
          }
        } else {
          setSelectedRoleId('');
          setCustomRoleName('');
        }
        setMeaning(initialEvent.meaning ?? '');
        setStarred(initialEvent.starred ?? false);
        setHighlight(initialEvent.highlight ?? false);
        setLongTermGoals(initialEvent.longTermGoals ?? []);
      } else {
        setTitle('');
        setType('todo');
        setDate(format(selectedDate, 'yyyy-MM-dd'));
        setStartTime('09:00');
        setEndTime('10:00');
        setDescription('');
        setRecurrenceFreq('none');
        setRecurrenceInterval(1);
        setRecurrenceEndDate('');
        setLabelText('');
        setLabelColor(getThemeAccentHex());
        setSelectedRoleId('');
        setCustomRoleName('');
        setMeaning('');
        setStarred(false);
        setHighlight(false);
        setLongTermGoalInput('');
        setLongTermGoals([]);
      }
    }
  }, [isOpen, initialEvent, selectedDate]);

  // Auto-resize detail and meaning textareas (cap height on small viewports)
  const resizeTextarea = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    const maxPx =
      typeof window !== 'undefined'
        ? Math.min(window.innerHeight * 0.4, 320)
        : 320;
    const next = Math.min(Math.max(40, el.scrollHeight), maxPx);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxPx ? 'auto' : 'hidden';
  }, []);
  useEffect(() => {
    if (!isOpen) return;
    resizeTextarea(descriptionRef.current);
    resizeTextarea(meaningRef.current);
  }, [isOpen, description, meaning, resizeTextarea]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);

    // Smart Time Parsing
    // We use the currently selected date as the reference date
    const referenceDate = new Date(date + 'T' + startTime);
    const results = chrono.parse(newTitle, referenceDate, { forwardDate: true });

    if (results.length > 0) {
      const result = results[0];
      const start = result.start.date();
      const end = result.end ? result.end.date() : null;

      // Only update if the parsed date is valid
      if (start) {
        setDate(format(start, 'yyyy-MM-dd'));
        setStartTime(format(start, 'HH:mm'));
        
        if (end) {
          setEndTime(format(end, 'HH:mm'));
        } else {
          // Default to 1 hour duration if only start time is found
          setEndTime(format(addHours(start, 1), 'HH:mm'));
        }
        setIsTimeDetected(true);
        
        // Reset detection indicator after a moment
        setTimeout(() => setIsTimeDetected(false), 2000);
      }
    }
  };

  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartTime = e.target.value;
    setStartTime(newStartTime);
    
    // Auto-set End Time to +1 hour
    if (newStartTime) {
      const [hours, minutes] = newStartTime.split(':').map(Number);
      const startDate = new Date();
      startDate.setHours(hours, minutes);
      const endDate = addHours(startDate, 1);
      setEndTime(format(endDate, 'HH:mm'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    // #region agent log
    fetch('http://127.0.0.1:7302/ingest/e34e5bd5-4320-4413-b8df-01e810a352dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f6ac8d'},body:JSON.stringify({sessionId:'f6ac8d',runId:'pre-fix',hypothesisId:'T1',location:'AddEventModal.tsx:handleSubmit',message:'submit add/edit event',data:{innerW:typeof window!=='undefined'?window.innerWidth:null,hasLabel:!!labelText.trim(),labelColor},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    // Construct full ISO strings using the selected date
    const startDateTime = new Date(date);
    const [startHour, startMinute] = startTime.split(':').map(Number);
    startDateTime.setHours(startHour, startMinute);

    const endDateTime = new Date(date);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    endDateTime.setHours(endHour, endMinute);

    const roleValue =
      selectedRoleId === ''
        ? undefined
        : selectedRoleId === 'custom'
          ? (customRoleName.trim() ? `custom:${customRoleName.trim()}` : undefined)
          : selectedRoleId;

    const newEvent: ScheduleEvent = {
      id: initialEvent ? initialEvent.id : uuidv4(),
      title,
      type,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      description,
      completed: initialEvent ? initialEvent.completed : false,
      ...(roleValue && { role: roleValue }),
      ...(labelText.trim() && { label: { text: labelText.trim(), color: labelColor } }),
      ...(meaning.trim() && { meaning: meaning.trim() }),
      starred: starred,
      highlight: highlight,
      ...(longTermGoals.length > 0 && { longTermGoals: [...longTermGoals] }),
      ...(recurrenceFreq !== 'none' && {
        recurrence: {
          frequency: recurrenceFreq as 'daily' | 'weekly' | 'monthly',
          interval: recurrenceInterval,
          ...(recurrenceEndDate && { endDate: new Date(recurrenceEndDate).toISOString() })
        }
      })
    };

    if (roleValue?.startsWith('custom:')) recordRoleUsage(roleValue);

    setIsSubmitting(true);
    try {
      await Promise.resolve(onAdd(newEvent));
    } catch {
      return;
    } finally {
      setIsSubmitting(false);
    }

    const trimmedLabel = labelText.trim();
    if (trimmedLabel && !isPresetEventLabel(trimmedLabel)) {
      touchCustomEventLabel(trimmedLabel);
      const next = [trimmedLabel, ...savedCustomTags.filter((t) => t !== trimmedLabel)];
      setSavedCustomTags(next);
      try {
        window.localStorage.setItem(CUSTOM_EVENT_TAGS_KEY, JSON.stringify(next));
      } catch (_) {}
    }
    longTermGoals.forEach((goal) => {
      const g = goal.trim();
      if (g && !savedLongTermGoals.includes(g)) {
        const next = [g, ...savedLongTermGoals.filter((t) => t !== g)];
        setSavedLongTermGoals(next);
        try {
          window.localStorage.setItem(LONG_TERM_GOALS_KEY, JSON.stringify(next));
        } catch (_) {}
      }
    });
  };

  // Labels based on language
  const labels = {
    title: language === 'zh' ? (initialEvent ? '编辑日程' : '添加日程') : (initialEvent ? 'Edit Event' : 'Add to Schedule'),
    what: language === 'zh' ? '内容' : 'Content',
    when: language === 'zh' ? '时间' : 'When',
    cancel: language === 'zh' ? '取消' : 'Cancel',
    add: language === 'zh' ? (initialEvent ? '保存' : '添加') : (initialEvent ? 'Save' : 'Add Event'),
    delete: language === 'zh' ? '删除日程' : 'Delete Event',
    deleteConfirm: language === 'zh' ? '确定删除此日程？' : 'Delete This Event?',
    placeholder: language === 'zh' ? '和Sarah喝咖啡' : 'Coffee With Sarah',
    meeting: language === 'zh' ? '会议' : 'Meeting',
    todo: language === 'zh' ? '待办' : 'To-Do',
    timeDetected: language === 'zh' ? '已识别时间' : 'Time Detected'
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
            <div className="w-full max-w-[35.84rem] rounded-[2rem] shadow-2xl p-0 pointer-events-auto border overflow-hidden flex flex-col max-h-[90vh]" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
              
              {/* Header */}
              <div className="p-6 pb-0 flex items-center justify-between">
                <h2 className="text-2xl font-serif font-bold text-foreground">{labels.title}</h2>
                <button onClick={onClose} className="p-2 hover:bg-field rounded-full transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto mt-4">
                <motion.form
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onSubmit={handleSubmit} 
                  className="space-y-6"
                >
                      {/* Section 1: Title & Type */}
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-medium text-muted-foreground tracking-wider">
                              {labels.what}
                            </label>
                            {isTimeDetected && (
                              <motion.span 
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="text-xs font-medium text-accent flex items-center"
                              >
                                <Sparkles className="w-3 h-3 mr-1" />
                                {labels.timeDetected}
                              </motion.span>
                            )}
                          </div>
                          <Input
                            value={title}
                            onChange={handleTitleChange}
                            placeholder={labels.placeholder}
                            required
                            autoFocus
                            className="text-lg font-medium placeholder:font-normal rounded-md border border-border focus:border-accent mb-2 bg-field"
                          />
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-medium tracking-wider text-muted-foreground whitespace-nowrap">{language === 'zh' ? '属性' : 'Type'}</span>
                              <button
                                type="button"
                                onClick={() => setType('todo')}
                                className={cn(
                                  "flex items-center justify-center py-2 px-2.5 text-sm font-medium rounded-lg transition-all border",
                                  type === 'todo'
                                    ? "bg-accent/20 border-accent text-accent"
                                    : "bg-field border-border text-muted-foreground hover:bg-surface"
                                )}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                {labels.todo}
                              </button>
                              <button
                                type="button"
                                onClick={() => setType('meeting')}
                                className={cn(
                                  "flex items-center justify-center py-2 px-2.5 text-sm font-medium rounded-lg transition-all border",
                                  type === 'meeting'
                                    ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-600"
                                    : "bg-field border-border text-muted-foreground hover:bg-surface"
                                )}
                              >
                                <Calendar className="w-4 h-4 mr-1" />
                                {labels.meeting}
                              </button>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-medium tracking-wider text-muted-foreground whitespace-nowrap">{language === 'zh' ? '标记' : 'Mark'}</span>
                              <button
                                type="button"
                                onClick={() => setStarred(!starred)}
                                title={language === 'zh' ? '重点' : 'GTD Focus'}
                                className={cn(
                                  "flex items-center justify-center py-2 px-2.5 text-sm font-medium rounded-lg transition-all border",
                                  starred
                                    ? "bg-amber-500/20 border-amber-500/60 text-amber-600 dark:text-amber-400"
                                    : "bg-field border-border text-muted-foreground hover:bg-surface"
                                )}
                              >
                                <Star className="w-4 h-4 mr-1" />
                                {language === 'zh' ? '星标' : 'Starred'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setHighlight(!highlight)}
                                title={language === 'zh' ? '叙事里程碑' : 'Milestone'}
                                className={cn(
                                  "flex items-center justify-center py-2 px-2.5 text-sm font-medium rounded-lg transition-all border",
                                  highlight
                                    ? "bg-violet-500/20 border-violet-500/60 text-violet-600 dark:text-violet-400"
                                    : "bg-field border-border text-muted-foreground hover:bg-surface"
                                )}
                              >
                                <Sparkle className="w-4 h-4 mr-1" />
                                {language === 'zh' ? '高光' : 'Highlight'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Date & Time — desktop: date + start + end on one row */}
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground tracking-wider mb-2">
                          {labels.when}
                        </label>
                        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:gap-x-3 md:gap-y-2">
                          <div className="min-w-0 w-full md:w-auto md:flex-1 md:min-w-[10.5rem] md:max-w-[14rem]">
                            <Input
                              type="date"
                              value={date}
                              onChange={(e) => setDate(e.target.value)}
                              required
                              className="w-full min-w-0 rounded-md bg-field border-border focus:border-accent text-base"
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 md:flex-nowrap">
                            <div className="relative w-[min(100%,7.5rem)] shrink-0">
                              <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
                              <Input
                                type="time"
                                value={startTime}
                                onChange={handleStartTimeChange}
                                className="w-full min-w-0 pl-8 pr-1 rounded-md border-border bg-field focus:border-accent text-base tabular-nums"
                                required
                              />
                            </div>
                            <div className="relative w-[min(100%,7.5rem)] shrink-0">
                              <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
                              <Input
                                type="time"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                className="w-full min-w-0 pl-8 pr-1 rounded-md border-border bg-field focus:border-accent text-base tabular-nums"
                                required
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 重复 */}
                      <div>
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="flex-1 min-w-[120px]">
                            <label className="block text-xs font-medium tracking-wider text-muted-foreground mb-1">{language === 'zh' ? '重复' : 'Repeat'}</label>
                            <select
                              value={recurrenceFreq}
                              onChange={(e) => setRecurrenceFreq(e.target.value as any)}
                              className="w-full rounded-md border border-border bg-field px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                            >
                              <option value="none">{language === 'zh' ? '不重复' : 'None'}</option>
                              <option value="daily">{language === 'zh' ? '每天' : 'Daily'}</option>
                              <option value="weekly">{language === 'zh' ? '每周' : 'Weekly'}</option>
                              <option value="monthly">{language === 'zh' ? '每月' : 'Monthly'}</option>
                            </select>
                          </div>
                          {recurrenceFreq !== 'none' && (
                            <>
                              <div className="w-24">
                                <label className="block text-xs font-medium tracking-wider text-muted-foreground mb-1">{language === 'zh' ? '间隔' : 'Interval'}</label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={recurrenceInterval}
                                  onChange={(e) => setRecurrenceInterval(parseInt(e.target.value) || 1)}
                                  className="rounded-md bg-field border-border focus:border-accent"
                                />
                              </div>
                              <div className="min-w-[140px]">
                                <label className="block text-xs font-medium tracking-wider text-muted-foreground mb-1">{language === 'zh' ? '结束日期 (可选)' : 'End Date (Optional)'}</label>
                                <Input
                                  type="date"
                                  value={recurrenceEndDate}
                                  onChange={(e) => setRecurrenceEndDate(e.target.value)}
                                  className="rounded-md bg-field border-border focus:border-accent"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 长期目标：第一行与详情同 grid，输入框与详情等宽；第二行现有长期目标快捷选择 */}
                      <div className="w-full">
                        <label className="block text-xs font-medium tracking-wider text-muted-foreground mb-1">{language === 'zh' ? '长期目标' : 'Long-Term Goals'}</label>
                        <div className="grid grid-cols-2 gap-4 max-w-full">
                          <div className="min-w-0">
                            <Input
                              value={longTermGoalInput}
                              onChange={(e) => setLongTermGoalInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ',') {
                                  e.preventDefault();
                                  const v = (e.key === ',' ? longTermGoalInput.replace(/,/g, '') : longTermGoalInput).trim();
                                  if (v && !longTermGoals.includes(v)) setLongTermGoals((prev) => [...prev, v]);
                                  setLongTermGoalInput('');
                                }
                              }}
                              placeholder={language === 'zh' ? '输入后回车添加' : 'Type And Press Enter'}
                              className="w-full rounded-md border border-border bg-field px-3 py-2 text-sm focus:border-accent"
                            />
                          </div>
                          <div className="min-w-0 flex flex-wrap items-center gap-2 content-start">
                            {longTermGoals.map((g) => (
                              <span
                                key={g}
                                className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs bg-accent/15 text-accent border border-accent/30"
                              >
                                {g}
                                <button
                                  type="button"
                                  onClick={() => setLongTermGoals((prev) => prev.filter((x) => x !== g))}
                                  className="p-0.5 rounded-full hover:bg-accent/20"
                                  aria-label={language === 'zh' ? '移除' : 'Remove'}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                        {suggestedLongTermGoals.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {suggestedLongTermGoals.slice(0, 12).map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => {
                                  if (!longTermGoals.includes(s)) setLongTermGoals((prev) => [...prev, s]);
                                }}
                                className={cn(
                                  'px-2.5 py-1 rounded-full text-xs border transition-colors shrink-0',
                                  longTermGoals.includes(s)
                                    ? 'bg-foreground text-background border-foreground'
                                    : 'bg-field text-foreground border-border hover:bg-surface'
                                )}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 详情 | 意义 */}
                      <div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-full">
                          <div className="min-w-0 flex flex-col">
                            <label className="text-xs font-medium tracking-wider text-muted-foreground mb-1">{language === 'zh' ? '详情' : 'Details'}</label>
                            <textarea
                              ref={descriptionRef}
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              rows={1}
                              className="min-h-[2.5rem] max-h-[min(40vh,20rem)] w-full rounded-md border border-border bg-field px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-none overflow-y-auto transition-all"
                              placeholder={language === 'zh' ? '备注、链接或议程' : 'Notes, Links, Agenda'}
                            />
                          </div>
                          <div className="min-w-0 flex flex-col">
                            <label className="text-xs font-medium tracking-wider text-muted-foreground mb-1">{language === 'zh' ? '意义' : 'What It Means to Me'}</label>
                            <textarea
                              ref={meaningRef}
                              value={meaning}
                              onChange={(e) => setMeaning(e.target.value)}
                              rows={1}
                              className="min-h-[2.5rem] max-h-[min(40vh,20rem)] w-full rounded-md border border-border bg-field px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-none overflow-y-auto transition-all"
                              placeholder={language === 'zh' ? '想到了什么，便于回顾' : 'Any ideas flashing by'}
                            />
                          </div>
                        </div>
                      </div>

                      {/* 日程标签 | 角色 */}
                      <div>
                        <div className="grid gap-4 grid-cols-[7fr_3fr] items-start">
                          <div className="min-w-0">
                            <label className="block text-xs font-medium tracking-wider text-muted-foreground mb-1">
                              {language === 'zh' ? '日程标签' : 'Event Tag'}
                            </label>
                            <div className="flex items-center gap-2">
                              <Input
                                value={labelText}
                                onChange={(e) => setLabelText(e.target.value)}
                                placeholder={language === 'zh' ? '例如: 深度工作' : 'E.g., Deep Work'}
                                className="rounded-md border-border bg-field focus:border-accent"
                              />
                              <button
                                type="button"
                                onClick={() => setLabelText('')}
                                className="shrink-0 px-2 py-2 rounded-md border border-border bg-field text-sm text-muted-foreground hover:bg-surface"
                                title={language === 'zh' ? '清除' : 'Clear'}
                              >
                                {language === 'zh' ? '清除' : 'Clear'}
                              </button>
                            </div>
                            <div
                              className="mt-3 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1"
                              style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
                            >
                              {suggestedLabels.map((label) => (
                                <button
                                  key={label}
                                  type="button"
                                  onClick={() => setLabelText(label)}
                                  className={cn(
                                    "px-2.5 py-1 rounded-full text-xs border transition-colors shrink-0",
                                    labelText === label
                                      ? "bg-foreground text-background border-foreground"
                                      : "bg-field text-foreground border-border hover:bg-surface"
                                  )}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {labelColorsForPicker.map(c => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => setLabelColor(c)}
                                  className={cn(
                                    "w-6 h-6 rounded-full border transition-transform",
                                    labelColor === c ? "ring-2 ring-foreground/20 scale-110 border-border" : "border-border hover:scale-105"
                                  )}
                                  style={{ backgroundColor: c }}
                                  title={c}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <label className="block text-xs font-medium tracking-wider text-muted-foreground mb-1">
                              {language === 'zh' ? '角色' : 'Role'}
                            </label>
                            <select
                              value={selectedRoleId}
                              onChange={(e) => {
                                setSelectedRoleId(e.target.value);
                                if (e.target.value !== 'custom') setCustomRoleName('');
                              }}
                              className="w-full rounded-md border border-border bg-field px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent mb-2"
                            >
                              <option value="">{language === 'zh' ? '不选' : 'None'}</option>
                              <option value="custom">{language === 'zh' ? '自定义' : 'Custom'}</option>
                              {sortedCustomRoleIds.map((roleId) => (
                                <option key={roleId} value={roleId}>
                                  {roleId.startsWith('custom:') ? roleId.slice(7).trim() : roleId}
                                </option>
                              ))}
                              {PRESET_ROLES.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {language === 'zh' ? r.nameZh : r.nameEn}
                                </option>
                              ))}
                            </select>
                            {selectedRoleId === 'custom' && (
                              <Input
                                value={customRoleName}
                                onChange={(e) => setCustomRoleName(e.target.value)}
                                placeholder={language === 'zh' ? '输入角色名称' : 'Enter Role Name'}
                                className="rounded-md border-border bg-field focus:border-accent mt-1"
                              />
                            )}
                            {selectedRoleId && selectedRoleId !== 'custom' && (() => {
                              const preset = getPresetRole(selectedRoleId);
                              return preset ? (
                                <p className="text-xs text-muted-foreground mt-1" style={{ color: 'var(--app-muted)' }}>
                                  {preset.description}
                                </p>
                              ) : null;
                            })()}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          {initialEvent && onDelete && (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                const id = initialEvent.baseEventId ?? initialEvent.id;
                                if (window.confirm(labels.deleteConfirm)) {
                                  void onDelete(id);
                                }
                              }}
                              className="rounded-md text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 dark:text-rose-400"
                            >
                              <Trash2 className="w-4 h-4 mr-1.5 shrink-0" />
                              {labels.delete}
                            </Button>
                          )}
                        </div>
                        <div className="flex gap-3 ml-auto">
                          <Button type="button" variant="ghost" onClick={onClose} className="rounded-md">
                            {labels.cancel}
                          </Button>
                          <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="rounded-md px-6 shadow-sm bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-60"
                          >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2 inline" /> : null}
                            {labels.add}
                          </Button>
                        </div>
                      </div>
                    </motion.form>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
