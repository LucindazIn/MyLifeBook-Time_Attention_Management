import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns';
import { BookOpen } from 'lucide-react';
import type { ScheduleEvent, AppLanguage } from '@/types';
import { expandRecurringEvents } from '@/lib/events';
import {
  getChapterRange,
  getPreviousChapterRange,
  dateKeysBetween,
  formatChapterPeriodLabel,
  type ChapterPeriodKey,
} from '@/lib/dateRange';
import { getChapterChangeHint } from '@/lib/chapterChangeHint';
import { getRoleDisplayName } from '@/lib/constants/roles';
import { getChapters, saveChapter, exportChapterToTxt, deleteChapter, type SavedChapter, type ChapterDraft } from '@/lib/chaptersStorage';
import { ChapterViewModal } from '@/components/ChapterViewModal';
import { cn } from '@/lib/utils';
import {
  buildChapterPeriodExportText,
  sanitizeChapterExportFilenameSegment,
} from '@/lib/chapterExternalPrompt';

export interface ChapterNarrativeCardProps {
  events: ScheduleEvent[];
  journalEntries: Record<string, string>;
  completedInstances: Record<string, boolean>;
  language: AppLanguage;
  roleTags?: string[];
  dayNames?: Record<string, { name: string; isManual: boolean; language?: AppLanguage }>;
  dayTags?: Record<string, string>;
  dayVibes?: Record<string, { energy?: number; mood?: number; focus?: number }>;
}

const PERIOD_OPTIONS: ChapterPeriodKey[] = ['this_week', 'last_week', 'this_month', 'custom'];

const PERIOD_LABELS: Record<Exclude<ChapterPeriodKey, 'custom'>, { zh: string; en: string }> = {
  this_week: { zh: '本周', en: 'This Week' },
  last_week: { zh: '上周', en: 'Last Week' },
  this_month: { zh: '本月', en: 'This Month' },
};

function getPeriodLabel(period: ChapterPeriodKey, isZh: boolean, start?: Date, end?: Date): string {
  if (period === 'custom' && start && end) {
    return formatChapterPeriodLabel(start, end, isZh);
  }
  if (period === 'custom') {
    return isZh ? '自定义' : 'Custom';
  }
  return isZh ? PERIOD_LABELS[period].zh : PERIOD_LABELS[period].en;
}

export const ChapterNarrativeCard: React.FC<ChapterNarrativeCardProps> = ({
  events,
  journalEntries,
  completedInstances,
  language,
  roleTags = [],
  dayNames = {},
  dayTags = {},
  dayVibes = {},
}) => {
  const [period, setPeriod] = useState<ChapterPeriodKey>('this_week');
  const [customStart, setCustomStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [customEnd, setCustomEnd] = useState<Date>(() =>
    endOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [savedChapters, setSavedChapters] = useState<SavedChapter[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalChapter, setModalChapter] = useState<SavedChapter | ChapterDraft | null>(null);
  const [chapterModalMode, setChapterModalMode] = useState<'view' | 'edit'>('view');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const isZh = language === 'zh';

  useEffect(() => {
    setSavedChapters(getChapters());
  }, []);

  const { start, end } = useMemo(
    () =>
      getChapterRange(
        period,
        period === 'custom' ? customStart : undefined,
        period === 'custom' ? customEnd : undefined
      ),
    [period, customStart, customEnd]
  );
  const { start: prevStart, end: prevEnd } = useMemo(
    () =>
      getPreviousChapterRange(
        period,
        period === 'custom' ? customStart : undefined,
        period === 'custom' ? customEnd : undefined
      ),
    [period, customStart, customEnd]
  );

  const periodEvents = useMemo(
    () => expandRecurringEvents(events, start, end, completedInstances),
    [events, start, end, completedInstances]
  );
  const previousPeriodEvents = useMemo(
    () => expandRecurringEvents(events, prevStart, prevEnd, completedInstances),
    [events, prevStart, prevEnd, completedInstances]
  );

  const periodJournal = useMemo(() => {
    const keys = dateKeysBetween(start, end);
    return keys.reduce<Record<string, string>>((acc, k) => {
      acc[k] = journalEntries[k] ?? '';
      return acc;
    }, {});
  }, [start, end, journalEntries]);

  const changeHint = useMemo(
    () =>
      getChapterChangeHint(
        periodEvents,
        previousPeriodEvents,
        isZh ? 'zh' : 'en',
        getRoleDisplayName
      ),
    [periodEvents, previousPeriodEvents, isZh]
  );

  const periodLabel = getPeriodLabel(period, isZh, start, end);

  const buildDraft = (summaryPlaceholder: string): ChapterDraft => ({
    periodKey: period,
    periodLabel,
    periodStart: format(start, 'yyyy-MM-dd'),
    periodEnd: format(end, 'yyyy-MM-dd'),
    generatedAt: new Date().toISOString(),
    selectedTitleIndex: 0,
    chapterTitles: ['', '', ''],
    narrativeSummary: summaryPlaceholder,
    reflectionQuestions: ['', ''],
  });

  const buildExportTextForModalChapter = useCallback((): string => {
    if (!modalChapter) return '';
    const rangeStart = startOfDay(parseISO(modalChapter.periodStart));
    const rangeEnd = endOfDay(parseISO(modalChapter.periodEnd));
    const ev = expandRecurringEvents(events, rangeStart, rangeEnd, completedInstances);
    const keys = dateKeysBetween(rangeStart, rangeEnd);
    const journal: Record<string, string> = {};
    keys.forEach((k) => {
      journal[k] = journalEntries[k] ?? '';
    });
    const names: Record<string, { name: string; isManual: boolean }> = {};
    const tags: Record<string, string> = {};
    const vibes: Record<string, { energy?: number; mood?: number; focus?: number }> = {};
    keys.forEach((k) => {
      const n = dayNames[k];
      if (n?.name) names[k] = { name: n.name, isManual: n.isManual };
      if (dayTags[k]) tags[k] = dayTags[k];
      if (dayVibes[k]) vibes[k] = dayVibes[k];
    });
    return buildChapterPeriodExportText(ev, journal, {
      language,
      periodLabel: modalChapter.periodLabel,
      periodStart: modalChapter.periodStart,
      periodEnd: modalChapter.periodEnd,
      exportedAt: new Date().toISOString(),
      roleTags: roleTags.length ? roleTags : undefined,
      dayNamesInPeriod: Object.keys(names).length ? names : undefined,
      dayTagsInPeriod: Object.keys(tags).length ? tags : undefined,
      dayVibesInPeriod: Object.keys(vibes).length ? vibes : undefined,
    });
  }, [modalChapter, events, completedInstances, journalEntries, language, roleTags, dayNames, dayTags, dayVibes]);

  const handleExportPeriodBundle = () => {
    const text = buildExportTextForModalChapter();
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safe = sanitizeChapterExportFilenameSegment(modalChapter?.periodLabel ?? 'chapter');
    const d = format(new Date(), 'yyyy-MM-dd');
    a.download = `my_life_book_chapter_period_${safe}_${d}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopyPeriodBundle = async () => {
    try {
      await navigator.clipboard.writeText(buildExportTextForModalChapter());
      setCopyFeedback(isZh ? '已复制' : 'Copied');
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      setCopyFeedback(isZh ? '复制失败' : 'Copy Failed');
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  };

  const handleOpenChapter = () => {
    const draft = buildDraft('');
    setChapterModalMode('edit');
    setModalChapter(draft);
    setModalOpen(true);
  };

  const handleSaveNew = (draft: ChapterDraft) => {
    const saved = saveChapter(draft);
    setSavedChapters(getChapters());
    setModalChapter(saved);
  };

  const handleOpenSaved = (ch: SavedChapter) => {
    setChapterModalMode('view');
    setModalChapter(ch);
    setModalOpen(true);
  };

  const handleModalSave = (updated: SavedChapter) => {
    setSavedChapters(getChapters());
    setModalChapter(updated);
  };

  const handleDeleteChapter = (chapterId: string) => {
    deleteChapter(chapterId);
    setSavedChapters(getChapters());
    setModalOpen(false);
    setModalChapter(null);
  };

  const workflowHint = isZh
    ? '建议先点击「导出本期数据」，再用外部 AI 总结工具提炼内容。'
    : 'First Click "Export This Period\'s Data", Then Distill Your Chapter In An External AI Tool.';

  return (
    <div className="space-y-4">
      <h3
        className="text-sm font-semibold flex items-center gap-2"
        style={{ color: 'var(--app-text)' }}
      >
        <BookOpen className="w-4 h-4" style={{ color: 'var(--app-accent)' }} />
        {isZh ? '章节叙事' : 'Crafting Story'}
      </h3>

      <div className="flex flex-wrap gap-2 items-center">
        {PERIOD_OPTIONS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={cn(
              'text-xs font-medium rounded-lg px-2.5 py-1.5 border transition-colors',
              period === p
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-border text-muted-foreground hover:bg-field'
            )}
          >
            {p === 'custom'
              ? isZh
                ? '自定义'
                : 'Custom'
              : PERIOD_LABELS[p as Exclude<ChapterPeriodKey, 'custom'>][isZh ? 'zh' : 'en']}
          </button>
        ))}
        {period === 'custom' && (
          <span className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--app-muted)' }}>
            <label className="flex items-center gap-1">
              <span>{isZh ? '起' : 'From'}</span>
              <input
                type="date"
                value={format(customStart, 'yyyy-MM-dd')}
                onChange={(e) => {
                  const d = new Date(e.target.value);
                  if (!isNaN(d.getTime())) {
                    setCustomStart(d);
                    if (d > customEnd) setCustomEnd(d);
                  }
                }}
                className="rounded border border-border bg-field px-2 py-1 text-xs"
                style={{ color: 'var(--app-text)' }}
              />
            </label>
            <label className="flex items-center gap-1">
              <span>{isZh ? '止' : 'To'}</span>
              <input
                type="date"
                value={format(customEnd, 'yyyy-MM-dd')}
                onChange={(e) => {
                  const d = new Date(e.target.value);
                  if (!isNaN(d.getTime()) && d >= customStart) setCustomEnd(d);
                }}
                min={format(customStart, 'yyyy-MM-dd')}
                className="rounded border border-border bg-field px-2 py-1 text-xs"
                style={{ color: 'var(--app-text)' }}
              />
            </label>
          </span>
        )}
      </div>

      {changeHint && (
        <p className="text-xs" style={{ color: 'var(--app-muted)' }}>
          {changeHint}
        </p>
      )}

      {savedChapters.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium" style={{ color: 'var(--app-muted)' }}>
            {isZh ? '人生之书' : 'Life Book'} · {isZh ? `${savedChapters.length} 个章节可查看` : `${savedChapters.length} Chapter(s) To View`}
          </p>
          <ul className="flex flex-wrap gap-2">
            {savedChapters.slice(0, 5).map((ch) => (
              <li key={ch.id}>
                <button
                  type="button"
                  onClick={() => handleOpenSaved(ch)}
                  className="text-xs font-medium rounded-lg px-2.5 py-1.5 border border-border text-muted-foreground hover:bg-field hover:text-foreground"
                >
                  {(ch.chapterTitles[ch.selectedTitleIndex ?? 0] ?? ch.chapterTitles[0] ?? '').trim() || ch.periodLabel}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={handleOpenChapter}
          className="inline-flex items-center justify-center gap-2 text-sm font-medium rounded-lg px-4 py-2.5 border transition-colors border-accent bg-accent/15 text-accent hover:bg-accent/25"
        >
          {isZh ? '生成本章节' : 'Generate One Chapter'}
        </button>
      </div>

      <ChapterViewModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalChapter(null);
          setCopyFeedback(null);
        }}
        chapter={modalChapter}
        chapterWorkflowHint={workflowHint}
        onExportPeriodBundle={handleExportPeriodBundle}
        onCopyPeriodBundle={handleCopyPeriodBundle}
        copyFeedback={copyFeedback}
        chapterOpenMode={chapterModalMode}
        onSave={handleModalSave}
        onSaveNew={handleSaveNew}
        onDelete={handleDeleteChapter}
        language={language}
        onExportTxt={(ch) => exportChapterToTxt(ch, true)}
      />
    </div>
  );
};
