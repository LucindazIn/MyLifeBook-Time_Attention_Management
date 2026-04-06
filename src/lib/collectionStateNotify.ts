export type CollectionStateChangeSource = 'user' | 'sync';

const EVENT = 'feather-collection-state-updated';

export function notifyCollectionStateChanged(source: CollectionStateChangeSource = 'user'): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { source } }));
}
