import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Clipboard, Loader2, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import type { AppLanguage, EventType, ScheduleEvent } from '@/types';
import { cn } from '@/lib/utils';

type ImportRecurrenceInput = {
  frequency?: unknown;
  interval?: unknown;
  endDate?: unknown;
} | null;

type RoutineImportInput = {
  title?: unknown;
  description?: unknown;
  startDate?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  type?: unknown;
  recurrence?: ImportRecurrenceInput;
  role?: unknown;
  label?: unknown;
  longTermGoals?: unknown;
  mediumTermGoal?: unknown;
  mediumTermGoalId?: unknown;
  meaning?: unknown;
  starred?: unknown;
  highlight?: unknown;
};

type ParseResult = {
  events: ScheduleEvent[];
  errors: string[];
};

interface RoutineImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: AppLanguage;
  onImport: (events: ScheduleEvent[]) => void | Promise<void>;
  isImporting?: boolean;
}

const ROLE_ALIASES: Record<string, string> = {
  守护者: 'nurturer',
  nurturer: 'nurturer',
  创作者: 'creator',
  creator: 'creator',
  学者: 'scholar',
  scholar: 'scholar',
  探索者: 'explorer',
  explorer: 'explorer',
  链接者: 'connector',
  connector: 'connector',
  愿景者: 'visionary',
  visionary: 'visionary',
  静修者: 'retreater',
  retreater: 'retreater',
  挑战者: 'challenger',
  challenger: 'challenger',
  执行者: 'grinder',
  grinder: 'grinder',
};

const VALID_TYPES = new Set<EventType>(['todo', 'meeting', 'reminder']);
const VALID_RECURRENCE = new Set(['daily', 'weekly', 'monthly']);

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === 'yes' || value === '1';
}

function parseList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(asTrimmedString).filter(Boolean);
  }
  const text = asTrimmedString(value);
  if (!text) return [];
  return text.split(/[、,，]/).map((item) => item.trim()).filter(Boolean);
}

function parseLocalDateTime(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if (
    !year ||
    !month ||
    !day ||
    hour == null ||
    minute == null ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  const d = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day ||
    d.getHours() !== hour ||
    d.getMinutes() !== minute
  ) {
    return null;
  }
  return d;
}

function parseEndDate(date: unknown): { value?: string; invalid: boolean } {
  const text = asTrimmedString(date);
  if (!text) return { invalid: false };
  const parsed = parseLocalDateTime(text, '23:59');
  return parsed ? { value: parsed.toISOString(), invalid: false } : { invalid: true };
}

function normalizeRole(value: unknown): string | undefined {
  const text = asTrimmedString(value);
  if (!text) return undefined;
  const lower = text.toLowerCase();
  return ROLE_ALIASES[text] || ROLE_ALIASES[lower] || (text.startsWith('custom:') ? text : `custom:${text}`);
}

function parseRoutineImport(raw: string, language: AppLanguage): ParseResult {
  const errors: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      events: [],
      errors: [language === 'zh' ? 'JSON 格式不合法，请检查逗号、引号和括号。' : 'Invalid JSON. Check commas, quotes, and brackets.'],
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      events: [],
      errors: [language === 'zh' ? '顶层必须是 JSON 数组。' : 'The top level must be a JSON array.'],
    };
  }

  const events: ScheduleEvent[] = [];
  parsed.forEach((item, index) => {
    const row = item as RoutineImportInput;
    const rowLabel = language === 'zh' ? `第 ${index + 1} 条` : `Item ${index + 1}`;
    const title = asTrimmedString(row.title);
    const startDate = asTrimmedString(row.startDate);
    const startTime = asTrimmedString(row.startTime);
    const endTime = asTrimmedString(row.endTime);
    const typeText = asTrimmedString(row.type) || 'todo';

    if (!title) errors.push(`${rowLabel}: ${language === 'zh' ? '缺少 title。' : 'Missing title.'}`);
    if (!VALID_TYPES.has(typeText as EventType)) {
      errors.push(`${rowLabel}: ${language === 'zh' ? 'type 只能是 todo / meeting / reminder。' : 'type must be todo / meeting / reminder.'}`);
    }

    const start = parseLocalDateTime(startDate, startTime);
    const end = parseLocalDateTime(startDate, endTime);
    if (!start) errors.push(`${rowLabel}: ${language === 'zh' ? 'startDate/startTime 格式无效。' : 'Invalid startDate/startTime.'}`);
    if (!end) errors.push(`${rowLabel}: ${language === 'zh' ? 'endTime 格式无效。' : 'Invalid endTime.'}`);
    if (start && end && end <= start) {
      errors.push(`${rowLabel}: ${language === 'zh' ? 'endTime 必须晚于 startTime。' : 'endTime must be after startTime.'}`);
    }

    const recurrenceInput = row.recurrence;
    let recurrence: ScheduleEvent['recurrence'];
    if (recurrenceInput && typeof recurrenceInput === 'object') {
      const frequency = asTrimmedString(recurrenceInput.frequency);
      const interval = Number(recurrenceInput.interval || 1);
      if (!VALID_RECURRENCE.has(frequency)) {
        errors.push(`${rowLabel}: ${language === 'zh' ? 'recurrence.frequency 只能是 daily / weekly / monthly。' : 'recurrence.frequency must be daily / weekly / monthly.'}`);
      } else if (!Number.isFinite(interval) || interval < 1) {
        errors.push(`${rowLabel}: ${language === 'zh' ? 'recurrence.interval 必须大于等于 1。' : 'recurrence.interval must be at least 1.'}`);
      } else {
        const endDate = parseEndDate(recurrenceInput.endDate);
        if (endDate.invalid) {
          errors.push(`${rowLabel}: ${language === 'zh' ? 'recurrence.endDate 必须是 YYYY-MM-DD。' : 'recurrence.endDate must use YYYY-MM-DD.'}`);
        }
        recurrence = {
          frequency: frequency as 'daily' | 'weekly' | 'monthly',
          interval,
          ...(endDate.value ? { endDate: endDate.value } : {}),
        };
      }
    }

    if (!title || !start || !end || end <= start || !VALID_TYPES.has(typeText as EventType)) return;

    const labelText = asTrimmedString(row.label);
    const longTermGoals = parseList(row.longTermGoals);
    const mediumTermGoalId = asTrimmedString(row.mediumTermGoalId) || asTrimmedString(row.mediumTermGoal);
    const role = normalizeRole(row.role);
    const event: ScheduleEvent = {
      id: uuidv4(),
      title,
      description: asTrimmedString(row.description),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      type: typeText as EventType,
      completed: false,
      ...(recurrence ? { recurrence } : {}),
      ...(role ? { role } : {}),
      ...(labelText ? { label: { text: labelText, color: '#6366F1' } } : {}),
      ...(longTermGoals.length > 0 ? { longTermGoals } : {}),
      ...(mediumTermGoalId ? { mediumTermGoalId } : {}),
      ...(asTrimmedString(row.meaning) ? { meaning: asTrimmedString(row.meaning) } : {}),
      starred: asBoolean(row.starred),
      highlight: asBoolean(row.highlight),
    };
    events.push(event);
  });

  return { events: errors.length > 0 ? [] : events, errors };
}

const SAMPLE_JSON = `[
  {
    "title": "深度写作",
    "description": "完成长期内容或产品思考输出",
    "startDate": "2026-06-03",
    "startTime": "09:00",
    "endTime": "11:00",
    "type": "todo",
    "recurrence": {
      "frequency": "weekly",
      "interval": 1,
      "endDate": "2026-09-03"
    },
    "role": "创作者",
    "label": "深度工作",
    "longTermGoals": ["长期目标名称A"],
    "mediumTermGoal": "",
    "meaning": "稳定产出可复利的内容资产",
    "starred": true,
    "highlight": false
  }
]`;

export const RoutineImportModal: React.FC<RoutineImportModalProps> = ({
  isOpen,
  onClose,
  language,
  onImport,
  isImporting = false,
}) => {
  const isZh = language === 'zh';
  const [rawJson, setRawJson] = useState('');
  const [submitError, setSubmitError] = useState('');
  const result = useMemo(() => {
    if (!rawJson.trim()) return { events: [], errors: [] };
    return parseRoutineImport(rawJson, language);
  }, [rawJson, language]);

  const promptText = isZh
    ? `请帮我制定一套可批量导入日程 App 的生活 routine。请严格返回 JSON 数组，不要写解释文字。字段必须包含：title、description、startDate、startTime、endTime、type、recurrence、role、label、longTermGoals、mediumTermGoal、meaning、starred、highlight。日期用 YYYY-MM-DD，时间用 24 小时制 HH:mm。type 只能是 todo、meeting、reminder。recurrence 不重复填 null；重复时 frequency 只能是 daily、weekly、monthly，interval 大于等于 1，endDate 用 YYYY-MM-DD。role 从守护者、创作者、学者、探索者、链接者、愿景者、静修者、挑战者、执行者中选择。不要把重复任务展开成多条。`
    : `Create a life routine that can be imported into a schedule app. Return only a valid JSON array, with no explanation. Each item must include: title, description, startDate, startTime, endTime, type, recurrence, role, label, longTermGoals, mediumTermGoal, meaning, starred, highlight. Dates must use YYYY-MM-DD and times must use 24-hour HH:mm. type must be todo, meeting, or reminder. recurrence must be null for one-off tasks; otherwise frequency must be daily, weekly, or monthly, interval must be at least 1, and endDate must use YYYY-MM-DD. Choose role from Nurturer, Creator, Scholar, Explorer, Connector, Visionary, Retreater, Challenger, Grinder. Do not expand recurring tasks into many rows.`;

  const handleImport = async () => {
    setSubmitError('');
    if (result.errors.length > 0 || result.events.length === 0) {
      setSubmitError(isZh ? '请先粘贴合法 JSON，并确认预览里有可导入日程。' : 'Paste valid JSON and make sure the preview has importable events first.');
      return;
    }
    try {
      await Promise.resolve(onImport(result.events));
      setRawJson('');
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSubmitError(message || (isZh ? '导入失败。' : 'Import failed.'));
    }
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
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="w-full max-w-[42rem] rounded-[2rem] shadow-2xl border overflow-hidden flex flex-col max-h-[90vh] pointer-events-auto" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
              <div className="p-6 pb-4 flex items-start justify-between border-b" style={{ borderColor: 'var(--app-border)' }}>
                <div>
                  <h2 className="text-xl font-serif font-bold text-foreground">{isZh ? '导入 Routine' : 'Import Routine'}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isZh ? '粘贴 JSON，确认预览后写入日程；不会保存原始文件。' : 'Paste JSON, review it, then save events. The source file is not stored.'}
                  </p>
                </div>
                <button type="button" onClick={onClose} className="p-2 rounded-full transition-colors hover:bg-field" aria-label="Close">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-5">
                <section className="rounded-2xl border border-border bg-field/60 p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="font-medium text-foreground">{isZh ? '给别人/AI 的要求 Prompt' : 'Prompt For Others / AI'}</div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:opacity-80"
                      onClick={() => void navigator.clipboard?.writeText(promptText)}
                    >
                      <Clipboard className="w-3.5 h-3.5" />
                      {isZh ? '复制' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">{promptText}</p>
                </section>

                <section>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {isZh ? '粘贴返回的 JSON' : 'Paste Returned JSON'}
                  </label>
                  <textarea
                    value={rawJson}
                    onChange={(e) => {
                      setSubmitError('');
                      setRawJson(e.target.value);
                    }}
                    placeholder={SAMPLE_JSON}
                    className="min-h-[14rem] w-full rounded-2xl border border-border bg-field px-4 py-3 text-sm text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent font-mono"
                  />
                </section>

                {result.errors.length > 0 && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
                    <div className="flex items-center gap-2 font-medium mb-2">
                      <AlertCircle className="w-4 h-4" />
                      {isZh ? '需要修正' : 'Needs Fixes'}
                    </div>
                    <ul className="space-y-1 list-disc pl-5">
                      {result.errors.slice(0, 8).map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.events.length > 0 && (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 mb-3">
                      <CheckCircle2 className="w-4 h-4" />
                      {isZh ? `可导入 ${result.events.length} 条日程` : `${result.events.length} Events Ready`}
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {result.events.map((event) => (
                        <div key={event.id} className="rounded-xl border border-border bg-surface/80 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium text-sm text-foreground">{event.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(event.startTime).toLocaleDateString()} {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {[event.role, event.label?.text, event.longTermGoals?.join('、'), event.recurrence?.frequency].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {submitError && (
                  <p className="text-sm text-red-600">{submitError}</p>
                )}
              </div>

              <div className="p-6 border-t flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--app-border)' }}>
                <Button type="button" variant="outline" onClick={onClose} className="rounded-xl border-border">
                  {isZh ? '取消' : 'Cancel'}
                </Button>
                <Button
                  type="button"
                  onClick={handleImport}
                  disabled={isImporting || result.events.length === 0 || result.errors.length > 0}
                  className={cn('rounded-xl min-w-32', isImporting && 'opacity-80')}
                >
                  {isImporting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isZh ? '确认导入' : 'Import Events'}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
