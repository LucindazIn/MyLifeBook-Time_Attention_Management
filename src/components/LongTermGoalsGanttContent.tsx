import React, { useMemo, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { endOfDay, format, parseISO, startOfDay, startOfMonth } from 'date-fns';
import type { AppLanguage, ScheduleEvent } from '@/types';
import { getChapterRange, type ChapterPeriodKey } from '@/lib/dateRange';
import { cn } from '@/lib/utils';
import {
  loadLongTermGoalMeta,
  mergeLongTermGoalNames,
  getOrCreateRecord,
} from '@/lib/longTermGoalMetaStorage';
import {
  flattenMediumTermRows,
  layoutBarInWindow,
  milestonePctOnBar,
  todayPctInWindow,
  rowOverlapsWindow,
  formatMilestonePreview,
  type GanttRow,
} from '@/lib/longTermGoalGantt';

const RANGE_OPTIONS: ChapterPeriodKey[] = ['this_week', 'this_month', 'custom'];

function getRangeLabel(period: ChapterPeriodKey, isZh: boolean): string {
  const labels: Record<ChapterPeriodKey, string> = {
    this_week: isZh ? '本周' : 'This Week',
    last_week: isZh ? '上周' : 'Last Week',
    this_month: isZh ? '本月' : 'This Month',
    custom: isZh ? '自定义' : 'Custom',
  };
  return labels[period];
}

export interface LongTermGoalsGanttContentProps {
  events: ScheduleEvent[];
  language: AppLanguage;
  collectionStateRevision?: number;
}

interface TooltipState {
  row: GanttRow;
  anchorRect: DOMRect;
}

interface GanttRowViewProps {
  row: GanttRow;
  windowStart: Date;
  windowEnd: Date;
  todayPct: number | null;
  isZh: boolean;
  tooltipId: string;
  onShowTooltip: (row: GanttRow, el: HTMLElement) => void;
  onHideTooltip: () => void;
  onCancelHide: () => void;
}

const GanttRowView: React.FC<GanttRowViewProps> = ({
  row,
  windowStart,
  windowEnd,
  todayPct,
  isZh,
  tooltipId,
  onShowTooltip,
  onHideTooltip,
  onCancelHide,
}) => {
  const { medium } = row;
  const bar = layoutBarInWindow(windowStart, windowEnd, medium.startAt, medium.endAt);
  const ariaLabel = isZh
    ? `${medium.title}，母目标 ${row.visionName}，${medium.startAt} 至 ${medium.endAt}`
    : `${medium.title}, Vision ${row.visionName}, ${medium.startAt} to ${medium.endAt}`;

  return (
    <li className="flex gap-2 items-stretch min-h-[2.25rem]">
      <div
        className="w-[7rem] sm:w-[8rem] shrink-0 text-[10px] leading-tight pr-1 flex items-center"
        style={{ color: 'var(--app-text)' }}
      >
        <span className="line-clamp-2 font-medium" title={medium.title}>
          {medium.title}
        </span>
      </div>
      <div
        className="relative flex-1 min-w-0 h-9 rounded-lg border"
        style={{ borderColor: 'var(--app-border)', background: 'color-mix(in srgb, var(--app-field) 35%, transparent)' }}
      >
        {todayPct != null && (
          <div
            className="absolute top-0 bottom-0 w-px z-[1] pointer-events-none"
            style={{ left: `${todayPct}%`, background: 'var(--app-accent)', opacity: 0.65 }}
            aria-hidden
          />
        )}
        {bar.visible && (
          <div
            className="absolute top-1 bottom-1 min-w-[4px]"
            style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%` }}
          >
            <button
              type="button"
              className="relative w-full h-full rounded-md border text-left px-1.5 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              style={{
                borderColor: 'color-mix(in srgb, var(--app-accent) 45%, transparent)',
                background: 'color-mix(in srgb, var(--app-accent) 22%, transparent)',
              }}
              aria-label={ariaLabel}
              aria-describedby={tooltipId}
              onMouseEnter={(e) => {
                onCancelHide();
                onShowTooltip(row, e.currentTarget);
              }}
              onMouseLeave={onHideTooltip}
              onFocus={(e) => {
                onCancelHide();
                onShowTooltip(row, e.currentTarget);
              }}
              onBlur={onHideTooltip}
            >
              <span className="block text-[9px] truncate font-medium" style={{ color: 'var(--app-text)' }}>
                {medium.title}
              </span>
              {(medium.milestones ?? []).map((ms) => {
                const { pctOnBar, outsideBar } = milestonePctOnBar(
                  medium.startAt,
                  medium.endAt,
                  ms.at
                );
                return (
                  <span
                    key={ms.id}
                    className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rotate-45 border"
                    style={{
                      left: `${pctOnBar}%`,
                      marginLeft: '-3px',
                      borderColor: 'var(--app-accent)',
                      background: outsideBar ? 'transparent' : 'var(--app-accent)',
                      opacity: outsideBar ? 0.35 : 1,
                    }}
                    aria-hidden
                  />
                );
              })}
            </button>
          </div>
        )}
      </div>
    </li>
  );
};

export const LongTermGoalsGanttContent: React.FC<LongTermGoalsGanttContentProps> = ({
  events,
  language,
  collectionStateRevision = 0,
}) => {
  const isZh = language === 'zh';
  const tooltipId = React.useId();
  const [range, setRange] = useState<ChapterPeriodKey>('this_month');
  const [customStart, setCustomStart] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [inProgressOnly, setInProgressOnly] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onCustomStartChange = useCallback(
    (value: string) => {
      if (!value) return;
      setCustomStart(value);
      if (value > customEnd) setCustomEnd(value);
    },
    [customEnd]
  );

  const onCustomEndChange = useCallback(
    (value: string) => {
      if (!value) return;
      setCustomEnd(value);
      if (value < customStart) setCustomStart(value);
    },
    [customStart]
  );

  const { windowStart, windowEnd } = useMemo(() => {
    if (range === 'custom') {
      const a = startOfDay(parseISO(customStart));
      const b = endOfDay(parseISO(customEnd));
      const s = a.getTime() <= b.getTime() ? a : b;
      const e = a.getTime() <= b.getTime() ? b : a;
      return { windowStart: s, windowEnd: e };
    }
    const { start, end } = getChapterRange(range);
    return { windowStart: start, windowEnd: end };
  }, [range, customStart, customEnd]);

  const allRows = useMemo(() => {
    const goalNames = mergeLongTermGoalNames(events);
    const meta = loadLongTermGoalMeta();
    const map: Record<string, ReturnType<typeof getOrCreateRecord>> = {};
    goalNames.forEach((n) => {
      map[n] = getOrCreateRecord(meta, n);
    });
    return flattenMediumTermRows(goalNames, map);
  }, [events, collectionStateRevision]);

  const visibleRows = useMemo(() => {
    let rows = allRows.filter((r) =>
      rowOverlapsWindow(windowStart, windowEnd, r.medium.startAt, r.medium.endAt)
    );
    if (inProgressOnly) rows = rows.filter((r) => r.inProgress);
    return rows;
  }, [allRows, windowStart, windowEnd, inProgressOnly]);

  const todayPct = useMemo(
    () => todayPctInWindow(windowStart, windowEnd),
    [windowStart, windowEnd]
  );

  const axisLabels = useMemo(() => {
    const startLabel = format(windowStart, isZh ? 'M/d' : 'MMM d');
    const endLabel = format(windowEnd, isZh ? 'M/d' : 'MMM d');
    const mid = new Date((windowStart.getTime() + windowEnd.getTime()) / 2);
    const midLabel = format(mid, isZh ? 'M/d' : 'MMM d');
    return { startLabel, midLabel, endLabel };
  }, [windowStart, windowEnd, isZh]);

  const showTooltip = useCallback((row: GanttRow, el: HTMLElement) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setTooltip({ row, anchorRect: el.getBoundingClientRect() });
  }, []);

  const scheduleHideTooltip = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setTooltip(null), 120);
  }, []);

  const cancelHideTooltip = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const renderTooltip = () => {
    if (!tooltip || typeof document === 'undefined') return null;
    const { row, anchorRect } = tooltip;
    const { medium, visionName } = row;
    const ms = medium.milestones ?? [];
    const top = Math.min(anchorRect.bottom + 8, window.innerHeight - 160);
    const left = Math.min(Math.max(8, anchorRect.left), window.innerWidth - 280);

    return createPortal(
      <div
        id={tooltipId}
        role="tooltip"
        className="fixed z-[300] max-w-[272px] rounded-xl border px-3 py-2.5 text-[11px] leading-snug shadow-lg pointer-events-none"
        style={{
          top,
          left,
          background: 'var(--app-surface)',
          borderColor: 'var(--app-border)',
          color: 'var(--app-text)',
          boxShadow: 'var(--app-card-shadow)',
        }}
      >
        <p className="font-semibold mb-1" style={{ color: 'var(--app-accent)' }}>
          {isZh ? `母目标：${visionName}` : `Vision: ${visionName}`}
        </p>
        <p className="font-medium">{medium.title}</p>
        <p className="mt-0.5 tabular-nums" style={{ color: 'var(--app-muted)' }}>
          {medium.startAt} — {medium.endAt}
        </p>
        {ms.length > 0 && (
          <pre
            className="mt-1.5 whitespace-pre-wrap font-sans text-[10px]"
            style={{ color: 'var(--app-muted)' }}
          >
            {formatMilestonePreview(ms, 4, isZh)}
          </pre>
        )}
      </div>,
      document.body
    );
  };

  return (
    <div className="space-y-3 min-w-0" style={{ color: 'var(--app-text)' }}>
      <div className="flex flex-wrap gap-2">
        {RANGE_OPTIONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={cn(
              'text-xs font-medium rounded-lg px-2.5 py-1.5 border transition-colors',
              range === r
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-border text-muted-foreground hover:bg-field'
            )}
          >
            {getRangeLabel(r, isZh)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setInProgressOnly((v) => !v)}
          className={cn(
            'text-xs font-medium rounded-lg px-2.5 py-1.5 border transition-colors',
            inProgressOnly
              ? 'border-accent bg-accent/15 text-accent'
              : 'border-border text-muted-foreground hover:bg-field'
          )}
          aria-pressed={inProgressOnly}
        >
          {isZh ? '仅进行中' : 'In Progress Only'}
        </button>
      </div>

      {range === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--app-muted)' }}>
          <label className="flex items-center gap-1.5 shrink-0">
            <span className="whitespace-nowrap">{isZh ? '起' : 'From'}</span>
            <input
              type="date"
              value={customStart}
              max={customEnd}
              onChange={(e) => onCustomStartChange(e.target.value)}
              className="rounded-lg border bg-field px-2 py-1 text-foreground tabular-nums max-w-full"
              style={{ borderColor: 'var(--app-border)' }}
            />
          </label>
          <span aria-hidden>—</span>
          <label className="flex items-center gap-1.5 shrink-0">
            <span className="whitespace-nowrap">{isZh ? '止' : 'To'}</span>
            <input
              type="date"
              value={customEnd}
              min={customStart}
              onChange={(e) => onCustomEndChange(e.target.value)}
              className="rounded-lg border bg-field px-2 py-1 text-foreground tabular-nums max-w-full"
              style={{ borderColor: 'var(--app-border)' }}
            />
          </label>
        </div>
      )}

      <div
        className="flex justify-between text-[10px] tabular-nums px-[7.5rem] sm:px-[8.5rem]"
        style={{ color: 'var(--app-muted)' }}
      >
        <span>{axisLabels.startLabel}</span>
        <span>{axisLabels.midLabel}</span>
        <span>{axisLabels.endLabel}</span>
      </div>

      {allRows.length === 0 ? (
        <p className="text-xs py-2" style={{ color: 'var(--app-muted)' }}>
          {isZh
            ? '请先在「管理」里为母目标添加中短期区间与里程碑。'
            : 'Add Short-Term Windows And Milestones Under A Vision In Manage First.'}
        </p>
      ) : visibleRows.length === 0 ? (
        <p className="text-xs py-2" style={{ color: 'var(--app-muted)' }}>
          {inProgressOnly
            ? isZh
              ? '当前时间窗内没有进行中的中短期目标。'
              : 'No In-Progress Short-Term Goals In This Window.'
            : isZh
              ? '当前时间窗内没有可展示的中短期区间。'
              : 'No Short-Term Windows Overlap This Time Range.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {visibleRows.map((row) => (
            <GanttRowView
              key={row.id}
              row={row}
              windowStart={windowStart}
              windowEnd={windowEnd}
              todayPct={todayPct}
              isZh={isZh}
              tooltipId={tooltipId}
              onShowTooltip={showTooltip}
              onHideTooltip={scheduleHideTooltip}
              onCancelHide={cancelHideTooltip}
            />
          ))}
        </ul>
      )}

      {todayPct != null && visibleRows.length > 0 && (
        <p className="text-[10px] flex items-center gap-1.5" style={{ color: 'var(--app-muted)' }}>
          <span
            className="inline-block w-3 h-0.5 rounded-full"
            style={{ background: 'var(--app-accent)' }}
            aria-hidden
          />
          {isZh ? '竖线为今天' : 'Vertical Line Is Today'}
        </p>
      )}

      {renderTooltip()}
    </div>
  );
};
