import React, { useMemo, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import type { ScheduleEvent, AppLanguage } from '@/types';
import { expandRecurringEvents } from '@/lib/events';
import { getChapterRange, type ChapterPeriodKey } from '@/lib/dateRange';
import { generateSummaryByFilter, UserGeminiKeyMissing } from '@/lib/gemini';
import { useGeminiTierBAccess } from '@/contexts/GeminiUserKeyContext';
import { PRESET_ROLES, getRoleDisplayName } from '@/lib/constants/roles';
import { cn } from '@/lib/utils';

const RANGE_OPTIONS: ChapterPeriodKey[] = ['this_week', 'this_month'];

export interface AISummaryCardProps {
  events: ScheduleEvent[];
  completedInstances: Record<string, boolean>;
  language: AppLanguage;
}

function getRangeLabel(period: ChapterPeriodKey, isZh: boolean): string {
  const labels: Record<ChapterPeriodKey, string> = {
    this_week: isZh ? '本周' : 'This week',
    last_week: isZh ? '上周' : 'Last week',
    this_month: isZh ? '本月' : 'This month',
    custom: isZh ? '自定义' : 'Custom',
  };
  return labels[period];
}

export const AISummaryCard: React.FC<AISummaryCardProps> = ({
  events,
  completedInstances,
  language,
}) => {
  const { ensureTierBAccess } = useGeminiTierBAccess();
  const [range, setRange] = useState<ChapterPeriodKey>('this_week');
  const [filterType, setFilterType] = useState<'tag' | 'role'>('role');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isZh = language === 'zh';

  const { start, end } = useMemo(() => getChapterRange(range), [range]);
  const expanded = useMemo(
    () => expandRecurringEvents(events, start, end, completedInstances),
    [events, start, end, completedInstances]
  );

  const availableTags = useMemo(() => {
    const list = events.flatMap((e) => e.tags ?? []).filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (filterType === 'tag' && selectedTag) {
      return expanded.filter((e) => e.tags?.includes(selectedTag));
    }
    if (filterType === 'role' && selectedRole) {
      return expanded.filter((e) => e.role === selectedRole);
    }
    return [];
  }, [expanded, filterType, selectedTag, selectedRole]);

  const canGenerate = filteredEvents.length > 0;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    if (!ensureTierBAccess()) return;
    setLoading(true);
    setError(null);
    setResult('');
    try {
      const text = await generateSummaryByFilter(filteredEvents, language, {
        byTag: filterType === 'tag' ? selectedTag : undefined,
        byRole: filterType === 'role' ? selectedRole : undefined,
      });
      setResult(text || (isZh ? '未生成内容' : 'No content generated'));
    } catch (e) {
      if (e instanceof UserGeminiKeyMissing) {
        setError(isZh ? '请先在设置中填写 Gemini API Key。' : 'Add your Gemini API Key in Settings first.');
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
        <Sparkles className="w-4 h-4" style={{ color: 'var(--app-accent)' }} />
        {isZh ? 'AI 总结' : 'AI summary'}
      </h3>

      <div className="flex gap-2">
        {RANGE_OPTIONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={cn(
              'text-xs font-medium rounded-lg px-2.5 py-1.5 border transition-colors',
              range === r ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted-foreground hover:bg-field'
            )}
          >
            {getRangeLabel(r, isZh)}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setFilterType('tag')}
          className={cn(
            'text-xs font-medium rounded-lg px-2.5 py-1.5 border transition-colors',
            filterType === 'tag' ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted-foreground hover:bg-field'
          )}
        >
          {isZh ? '按标签' : 'By tag'}
        </button>
        <button
          type="button"
          onClick={() => setFilterType('role')}
          className={cn(
            'text-xs font-medium rounded-lg px-2.5 py-1.5 border transition-colors',
            filterType === 'role' ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted-foreground hover:bg-field'
          )}
        >
          {isZh ? '按角色' : 'By role'}
        </button>
      </div>

      {filterType === 'tag' ? (
        availableTags.length > 0 ? (
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="w-full text-sm rounded-lg border px-3 py-2 bg-field border-border"
            style={{ color: 'var(--app-text)' }}
          >
            <option value="">{isZh ? '选择标签…' : 'Select tag…'}</option>
            {availableTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        ) : (
          <p className="text-xs" style={{ color: 'var(--app-muted)' }}>{isZh ? '暂无事件标签' : 'No event tags yet'}</p>
        )
      ) : (
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="w-full text-sm rounded-lg border px-3 py-2 bg-field border-border"
          style={{ color: 'var(--app-text)' }}
        >
          <option value="">{isZh ? '选择角色…' : 'Select role…'}</option>
          {PRESET_ROLES.map((r) => (
            <option key={r.id} value={r.id}>{getRoleDisplayName(r.id, isZh ? 'zh' : 'en')}</option>
          ))}
        </select>
      )}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={!canGenerate || loading}
        className="inline-flex items-center justify-center gap-2 text-sm font-medium rounded-lg px-4 py-2.5 border border-accent bg-accent/15 text-accent hover:bg-accent/25 disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {isZh ? '生成总结' : 'Generate summary'}
      </button>

      {error && <p className="text-xs text-rose-500" role="alert">{error}</p>}
      {result && <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--app-text)' }}>{result}</p>}
    </div>
  );
};
