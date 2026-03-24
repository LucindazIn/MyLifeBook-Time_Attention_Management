/**
 * Shared surface styles for Life Book pages — theme tokens + subtle gradient/inset (no bitmaps).
 */

/** Outer “page” card: surface gradient, border, inset highlight (tokens work for light + dark minimalist) */
export const lifeBookPageCard =
  'rounded-xl border border-border bg-gradient-to-b from-[color-mix(in_srgb,var(--app-surface)_94%,var(--app-accent)_6%)] to-[var(--app-surface)] shadow-[var(--app-card-shadow)] ring-1 ring-inset ring-[color:var(--app-border)]';

/** Inner reading block: field + light border */
export const lifeBookReadingPanel =
  'rounded-xl border border-border bg-field/90 backdrop-blur-[1px]';

/** Primary text — uses app foreground (no heavy paper shadow) */
export const lifeBookInk = 'text-foreground';

/** Secondary / subtitle */
export const lifeBookInkMuted = 'text-muted-foreground';
