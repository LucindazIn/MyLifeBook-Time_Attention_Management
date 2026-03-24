import React from 'react';
import type { EventLabel } from '@/types';
import { cn } from '@/lib/utils';

export function EventLabelChip(props: { label?: EventLabel; className?: string }) {
  const { label, className } = props;
  if (!label?.text) return null;

  return (
    <span
      className={cn("shrink-0 text-[11px] font-medium px-2 py-1 rounded-full border", className)}
      style={{
        color: label.color,
        borderColor: `${label.color}33`,
        backgroundColor: `${label.color}14`,
      }}
    >
      {label.text}
    </span>
  );
}

