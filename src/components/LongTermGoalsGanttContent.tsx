import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { endOfDay, format, parseISO, startOfDay, startOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
  buildGanttAxisTicks,
  computePanBounds,
  computeDefaultPpd,
  computeVisibleDayCount,
  resolveViewWindow,
  shiftViewWindow,
  panOffsetForViewStart,
  getCurrentWeekAnchor,
  clampPpd,
  PPD_MIN,
  PPD_MAX,
  countCalendarDays,
  type GanttRow,
} from '@/lib/longTermGoalGantt';

const RANGE_OPTIONS: ChapterPeriodKey[] = ['this_week', 'this_month', 'custom'];
const SWIPE_THRESHOLD_PX = 48;
const LABEL_COL_CLASS = 'w-[7rem] sm:w-[8rem]';

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

interface GanttBarTrackProps {
  row: GanttRow;
  viewStart: Date;
  viewEnd: Date;
  trackWidthPx: number;
  todayPct: number | null;
  isZh: boolean;
  tooltipId: string;
  onShowTooltip: (row: GanttRow, el: HTMLElement) => void;
  onHideTooltip: () => void;
  onCancelHide: () => void;
}

const GanttBarTrack: React.FC<GanttBarTrackProps> = ({
  row,
  viewStart,
  viewEnd,
  trackWidthPx,
  todayPct,
  isZh,
  tooltipId,
  onShowTooltip,
  onHideTooltip,
  onCancelHide,
}) => {
  const { medium } = row;
  const bar = layoutBarInWindow(viewStart, viewEnd, medium.startAt, medium.endAt);
  const ariaLabel = isZh
    ? `${medium.title}，母目标 ${row.visionName}，${medium.startAt} 至 ${medium.endAt}`
    : `${medium.title}, Vision ${row.visionName}, ${medium.startAt} to ${medium.endAt}`;

  return (
    <div
      className="relative h-9 shrink-0"
      style={{ width: trackWidthPx, minWidth: trackWidthPx }}
    >
      <div
        className="absolute inset-0 rounded-lg border"
        style={{
          borderColor: 'var(--app-border)',
          background: 'color-mix(in srgb, var(--app-field) 35%, transparent)',
        }}
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
    </div>
  );
};

export const LongTermGoalsGanttContent: React.FC<LongTermGoalsGanttContentProps> = ({
  events,
  language,
  collectionStateRevision = 0,
}) => {
  const isZh = language === 'zh';
  const tooltipId = React.useId();
  const trackScrollRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const [range, setRange] = useState<ChapterPeriodKey>('this_month');
  const [customStart, setCustomStart] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [inProgressOnly, setInProgressOnly] = useState(false);
  const [ppd, setPpd] = useState(16);
  const [panOffsetDays, setPanOffsetDays] = useState(0);
  const [trackClientWidth, setTrackClientWidth] = useState(320);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { anchorStart, anchorEnd } = useMemo(() => {
    if (range === 'custom') {
      const a = startOfDay(parseISO(customStart));
      const b = endOfDay(parseISO(customEnd));
      const s = a.getTime() <= b.getTime() ? a : b;
      const e = a.getTime() <= b.getTime() ? b : a;
      return { anchorStart: s, anchorEnd: e };
    }
    const { start, end } = getChapterRange(range);
    return { anchorStart: start, anchorEnd: end };
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

  const panBounds = useMemo(() => computePanBounds(allRows), [allRows]);

  const visibleDayCount = useMemo(
    () => computeVisibleDayCount(trackClientWidth, ppd),
    [trackClientWidth, ppd]
  );

  const { viewStart, viewEnd } = useMemo(
    () => resolveViewWindow(anchorStart, panOffsetDays, visibleDayCount, panBounds),
    [anchorStart, panOffsetDays, visibleDayCount, panBounds]
  );

  const trackWidthPx = visibleDayCount * ppd;

  const axisTicks = useMemo(
    () => buildGanttAxisTicks(viewStart, viewEnd, ppd, isZh),
    [viewStart, viewEnd, ppd, isZh]
  );

  const visibleRows = useMemo(() => {
    let rows = allRows.filter((r) =>
      rowOverlapsWindow(viewStart, viewEnd, r.medium.startAt, r.medium.endAt)
    );
    if (inProgressOnly) rows = rows.filter((r) => r.inProgress);
    return rows;
  }, [allRows, viewStart, viewEnd, inProgressOnly]);

  const todayPct = useMemo(() => todayPctInWindow(viewStart, viewEnd), [viewStart, viewEnd]);

  const viewRangeLabel = `${format(viewStart, 'yyyy-MM-dd')} — ${format(viewEnd, 'yyyy-MM-dd')}`;

  useEffect(() => {
    const el = trackScrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setTrackClientWidth(w);
    });
    ro.observe(el);
    setTrackClientWidth(el.clientWidth || 320);
    return () => ro.disconnect();
  }, []);

  const resetViewport = useCallback(
    (nextAnchorStart: Date, nextAnchorEnd: Date) => {
      const w = trackScrollRef.current?.clientWidth ?? trackClientWidth;
      const days = countCalendarDays(nextAnchorStart, nextAnchorEnd);
      setPpd(computeDefaultPpd(w, days));
      setPanOffsetDays(0);
    },
    [trackClientWidth]
  );

  useEffect(() => {
    resetViewport(anchorStart, anchorEnd);
  }, [range, customStart, customEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  const panBy = useCallback(
    (deltaDays: number) => {
      const next = shiftViewWindow(viewStart, viewEnd, deltaDays, panBounds);
      setPanOffsetDays(panOffsetForViewStart(anchorStart, next.viewStart));
    },
    [viewStart, viewEnd, panBounds, anchorStart]
  );

  const panStep = Math.max(1, Math.floor(visibleDayCount / 2));

  const handleGoToCurrentWeek = useCallback(() => {
    setRange('this_week');
    const { anchorStart, anchorEnd } = getCurrentWeekAnchor();
    const w = trackScrollRef.current?.clientWidth ?? trackClientWidth;
    setPpd(computeDefaultPpd(w, countCalendarDays(anchorStart, anchorEnd)));
    setPanOffsetDays(0);
  }, [trackClientWidth]);

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

  const onTrackWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.shiftKey) return;
      e.preventDefault();
      const step = e.deltaY > 0 || e.deltaX > 0 ? panStep : -panStep;
      panBy(step);
    },
    [panBy, panStep]
  );

  const onTrackTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }, []);

  const onTrackTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStartX.current;
      touchStartX.current = null;
      if (start == null) return;
      const end = e.changedTouches[0]?.clientX;
      if (end == null) return;
      const dx = end - start;
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
      panBy(dx > 0 ? -panStep : panStep);
    },
    [panBy, panStep]
  );

  const onTrackKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        panBy(e.shiftKey ? -7 : -1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        panBy(e.shiftKey ? 7 : 1);
      }
    },
    [panBy]
  );

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

  const btnClass =
    'text-xs font-medium rounded-lg px-2.5 py-1.5 border transition-colors border-border text-muted-foreground hover:bg-field shrink-0';

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

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs shrink-0" style={{ color: 'var(--app-muted)' }}>
          {isZh ? '缩放' : 'Zoom'}
        </span>
        <input
          type="range"
          min={PPD_MIN}
          max={PPD_MAX}
          step={1}
          value={ppd}
          onChange={(e) => setPpd(clampPpd(Number(e.target.value)))}
          className="flex-1 min-w-[8rem] max-w-md accent-[var(--app-accent)]"
          aria-label={isZh ? '时间轴缩放' : 'Timeline Zoom'}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={btnClass}
          onClick={() => panBy(-panStep)}
          aria-label={isZh ? '上一段' : 'Previous Period'}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs tabular-nums flex-1 text-center min-w-[10rem]" style={{ color: 'var(--app-text)' }}>
          {viewRangeLabel}
        </span>
        <button
          type="button"
          className={btnClass}
          onClick={() => panBy(panStep)}
          aria-label={isZh ? '下一段' : 'Next Period'}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          className={cn(btnClass, 'text-accent border-accent/40')}
          onClick={handleGoToCurrentWeek}
        >
          {isZh ? '当前周' : 'This Week'}
        </button>
      </div>

      {allRows.length === 0 ? (
        <p className="text-xs py-2" style={{ color: 'var(--app-muted)' }}>
          {isZh
            ? '请先在「管理」里为母目标添加中短期区间与里程碑。'
            : 'Add Short-Term Windows And Milestones Under A Vision In Manage First.'}
        </p>
      ) : (
        <div className="flex min-w-0 gap-2">
          <div className={`${LABEL_COL_CLASS} shrink-0`}>
            <div className="h-5 mb-1" aria-hidden />
            {visibleRows.length === 0 ? (
              <p className="text-[10px] leading-snug pr-1" style={{ color: 'var(--app-muted)' }}>
                {inProgressOnly
                  ? isZh
                    ? '无进行中'
                    : 'None In Progress'
                  : isZh
                    ? '本段无数据'
                    : 'Empty'}
              </p>
            ) : (
              <ul className="space-y-2">
                {visibleRows.map((row) => (
                  <li
                    key={row.id}
                    className="min-h-[2.25rem] flex items-center text-[10px] leading-tight pr-1"
                    style={{ color: 'var(--app-text)' }}
                  >
                    <span className="line-clamp-2 font-medium" title={row.medium.title}>
                      {row.medium.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div
            ref={trackScrollRef}
            className="flex-1 min-w-0 overflow-x-auto overflow-y-visible rounded-lg -mx-1 px-1"
            tabIndex={0}
            role="region"
            aria-label={isZh ? '甘特图时间轨，可左右滑动查看其他时间段' : 'Gantt Timeline, Swipe To See Other Periods'}
            onWheel={onTrackWheel}
            onTouchStart={onTrackTouchStart}
            onTouchEnd={onTrackTouchEnd}
            onKeyDown={onTrackKeyDown}
          >
            <div style={{ width: trackWidthPx, minWidth: trackWidthPx }}>
              <div className="relative h-5 mb-1 shrink-0" style={{ width: trackWidthPx }}>
                {axisTicks.map((tick, i) => (
                  <div
                    key={`${tick.at.getTime()}-${i}`}
                    className="absolute top-0 flex flex-col items-center -translate-x-1/2"
                    style={{ left: `${tick.pct}%` }}
                  >
                    <div
                      className="w-px h-1.5"
                      style={{ background: 'var(--app-border)' }}
                      aria-hidden
                    />
                    <span
                      className="text-[9px] tabular-nums whitespace-nowrap mt-0.5"
                      style={{ color: 'var(--app-muted)' }}
                    >
                      {tick.label}
                    </span>
                  </div>
                ))}
              </div>

              {visibleRows.length === 0 ? (
                <p className="text-xs py-2" style={{ color: 'var(--app-muted)' }}>
                  {inProgressOnly
                    ? isZh
                      ? '当前视口内没有进行中的中短期目标。'
                      : 'No In-Progress Short-Term Goals In This Viewport.'
                    : isZh
                      ? '当前视口内没有可展示的中短期区间。'
                      : 'No Short-Term Windows In This Viewport.'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {visibleRows.map((row) => (
                    <GanttBarTrack
                      key={row.id}
                      row={row}
                      viewStart={viewStart}
                      viewEnd={viewEnd}
                      trackWidthPx={trackWidthPx}
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
            </div>
          </div>
        </div>
      )}

      {allRows.length > 0 && (
        <p className="text-[10px] flex items-center gap-1.5" style={{ color: 'var(--app-muted)' }}>
          {todayPct != null && (
            <span
              className="inline-block w-3 h-0.5 rounded-full shrink-0"
              style={{ background: 'var(--app-accent)' }}
              aria-hidden
            />
          )}
          {isZh
            ? '竖线为今天；左右滑动、Shift+滚轮或箭头可切换时间段'
            : 'Line Is Today; Swipe, Shift+Scroll Or Arrows To Change Period'}
        </p>
      )}

      {renderTooltip()}
    </div>
  );
};
