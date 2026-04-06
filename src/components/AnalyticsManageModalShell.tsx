import React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import type { AppLanguage } from '@/types';
import { cn } from '@/lib/utils';

export interface AnalyticsManageModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** 统计口径等说明；不传或空则不显示 */
  scopeLine?: string;
  children: React.ReactNode;
  language: AppLanguage;
  /** 默认 max-w-lg；密集表单可用 max-w-2xl 等 */
  panelMaxWidthClass?: string;
  /** 标题栏底部分隔线；部分管理弹窗从首段内容（如导出）开始视觉 */
  showHeaderDivider?: boolean;
}

export const AnalyticsManageModalShell: React.FC<AnalyticsManageModalShellProps> = ({
  isOpen,
  onClose,
  title,
  scopeLine,
  children,
  language,
  panelMaxWidthClass = 'max-w-lg',
  showHeaderDivider = true,
}) => {
  const isZh = language === 'zh';
  const hasScope = Boolean(scopeLine?.trim());
  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'color-mix(in srgb, var(--app-bg, #000) 55%, transparent)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="analytics-manage-title"
      onClick={() => onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`${panelMaxWidthClass} w-full max-h-[85vh] rounded-2xl border shadow-lg flex flex-col overflow-hidden`}
        style={{
          background: 'var(--app-surface)',
          borderColor: 'var(--app-border)',
          color: 'var(--app-text)',
          boxShadow: 'var(--app-card-shadow)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            'flex shrink-0 items-start justify-between gap-3 px-5 py-4',
            showHeaderDivider && 'border-b'
          )}
          style={showHeaderDivider ? { borderColor: 'var(--app-border)' } : undefined}
        >
          <div className={cn('min-w-0', hasScope && 'space-y-1')}>
            <h2 id="analytics-manage-title" className="text-base font-semibold" style={{ color: 'var(--app-text)' }}>
              {title}
            </h2>
            {hasScope && (
              <p className="text-xs leading-relaxed" style={{ color: 'var(--app-muted)' }}>
                {scopeLine}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-field transition-colors shrink-0"
            style={{ color: 'var(--app-muted)' }}
            aria-label={isZh ? '关闭' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 min-h-0">{children}</div>
      </motion.div>
    </div>,
    document.body
  );
};

export interface AnalyticsExportFormatButtonsProps {
  language: AppLanguage;
  onCsv: () => void | Promise<void>;
  onMarkdown: () => void | Promise<void>;
  onCopy: () => void | Promise<void>;
  disabled?: boolean;
  /** 为 false 时不显示内置「导出（全时段）」前缀，便于与外行说明放在同一行。 */
  showBuiltinTimePrefix?: boolean;
}

export const AnalyticsExportFormatButtons: React.FC<AnalyticsExportFormatButtonsProps> = ({
  language,
  onCsv,
  onMarkdown,
  onCopy,
  disabled,
  showBuiltinTimePrefix = true,
}) => {
  const isZh = language === 'zh';
  const btn =
    'text-[11px] font-medium rounded-lg px-2.5 py-1.5 border transition-colors hover:bg-accent/10 disabled:opacity-50';
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {showBuiltinTimePrefix && (
        <span className="text-[10px] shrink-0" style={{ color: 'var(--app-muted)' }}>
          {isZh ? '导出（全时段）' : 'Export (All Time)'}
        </span>
      )}
      <button type="button" className={btn} style={{ borderColor: 'var(--app-border)', color: 'var(--app-accent)' }} disabled={disabled} onClick={() => void onCsv()}>
        CSV
      </button>
      <button type="button" className={btn} style={{ borderColor: 'var(--app-border)', color: 'var(--app-accent)' }} disabled={disabled} onClick={() => void onMarkdown()}>
        Markdown
      </button>
      <button type="button" className={btn} style={{ borderColor: 'var(--app-border)', color: 'var(--app-accent)' }} disabled={disabled} onClick={() => void onCopy()}>
        {isZh ? '复制' : 'Copy'}
      </button>
    </div>
  );
};
