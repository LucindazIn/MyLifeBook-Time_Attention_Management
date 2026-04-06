import type { ScheduleEvent } from '@/types';

export type AnalyticsExportRow = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  role: string;
  label: string;
  tags: string;
};

export function scheduleEventsToExportRows(events: ScheduleEvent[]): AnalyticsExportRow[] {
  return events.map((e) => ({
    id: e.id,
    title: e.title,
    startTime: e.startTime,
    endTime: e.endTime ?? '',
    role: e.role ?? '',
    label: e.label?.text ?? '',
    tags: (e.tags ?? []).join('; '),
  }));
}

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildAnalyticsCsv(rows: AnalyticsExportRow[]): string {
  const header = ['id', 'title', 'startTime', 'endTime', 'role', 'label', 'tags'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [r.id, r.title, r.startTime, r.endTime, r.role, r.label, r.tags].map(csvEscape).join(',')
    );
  }
  return lines.join('\n');
}

function mdCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function buildAnalyticsMarkdownTable(rows: AnalyticsExportRow[], isZh: boolean): string {
  const head = isZh
    ? '| id | 标题 | 开始 | 结束 | 角色 | 标签文案 | 标签 |'
    : '| id | Title | Start | End | Role | Label | Tags |';
  const sep = '| --- | --- | --- | --- | --- | --- | --- |';
  if (rows.length === 0) {
    return [head, sep, isZh ? '| （无数据） | | | | | | |' : '| (No Data) | | | | | | |'].join('\n');
  }
  const body = rows.map(
    (r) =>
      `| ${mdCell(r.id)} | ${mdCell(r.title)} | ${mdCell(r.startTime)} | ${mdCell(r.endTime)} | ${mdCell(r.role)} | ${mdCell(r.label)} | ${mdCell(r.tags)} |`
  );
  return [head, sep, ...body].join('\n');
}

export async function copyAnalyticsText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
