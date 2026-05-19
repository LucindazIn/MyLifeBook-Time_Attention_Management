/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  emptyCollectionStatePayload,
  type CollectionStatePayloadV1,
} from '@/lib/collectionStatePayload';

const fetchUserCollectionState = vi.fn();
const upsertUserCollectionState = vi.fn();
const applyCollectionStatePayloadToLocal = vi.fn();
const buildCollectionStatePayloadFromLocal = vi.fn();

vi.mock('@/lib/repositories/userCollectionStateRepo', () => ({
  fetchUserCollectionState: (...args: unknown[]) => fetchUserCollectionState(...args),
  upsertUserCollectionState: (...args: unknown[]) => upsertUserCollectionState(...args),
}));

vi.mock('@/lib/collectionStateApply', () => ({
  applyCollectionStatePayloadToLocal: (...args: unknown[]) =>
    applyCollectionStatePayloadToLocal(...args),
}));

vi.mock('@/lib/collectionStatePayload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/collectionStatePayload')>();
  return {
    ...actual,
    buildCollectionStatePayloadFromLocal: (...args: unknown[]) =>
      buildCollectionStatePayloadFromLocal(...args),
  };
});

import { pushCollectionClientState, syncCollectionClientState } from '@/lib/collectionStateSync';

const supabase = {} as SupabaseClient;
const userId = 'user-1';

function localPayload(overrides: Partial<CollectionStatePayloadV1> = {}): CollectionStatePayloadV1 {
  return {
    ...emptyCollectionStatePayload(),
    lifeBookCover: { line1: 'Local', line2: '', line3: '', updatedAt: 100 },
    ...overrides,
  };
}

function remotePayload(overrides: Partial<CollectionStatePayloadV1> = {}): CollectionStatePayloadV1 {
  return {
    ...emptyCollectionStatePayload(),
    lifeBookCover: { line1: 'Remote', line2: '', line3: '', updatedAt: 200 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchUserCollectionState.mockResolvedValue(null);
  upsertUserCollectionState.mockResolvedValue(undefined);
});

describe('collectionStateSync', () => {
  it('pushCollectionClientState merges remote before upsert (not blind overwrite)', async () => {
    const local = localPayload();
    const remote = remotePayload();
    buildCollectionStatePayloadFromLocal.mockReturnValue(local);
    fetchUserCollectionState.mockResolvedValue(remote);

    await pushCollectionClientState(supabase, userId);

    expect(applyCollectionStatePayloadToLocal).toHaveBeenCalledTimes(1);
    const merged = applyCollectionStatePayloadToLocal.mock.calls[0][0] as CollectionStatePayloadV1;
    expect(merged.lifeBookCover.line1).toBe('Remote');
    expect(upsertUserCollectionState).toHaveBeenCalledWith(supabase, userId, merged);
  });

  it('syncCollectionClientState skips apply when isStale after fetch', async () => {
    buildCollectionStatePayloadFromLocal.mockReturnValue(localPayload());
    fetchUserCollectionState.mockResolvedValue(remotePayload());

    await syncCollectionClientState(supabase, userId, { isStale: () => true });

    expect(applyCollectionStatePayloadToLocal).not.toHaveBeenCalled();
    expect(upsertUserCollectionState).not.toHaveBeenCalled();
  });

  it('pushCollectionClientState skips apply when isStale before upsert', async () => {
    buildCollectionStatePayloadFromLocal.mockReturnValue(localPayload());
    fetchUserCollectionState.mockResolvedValue(remotePayload());
    let stale = false;
    const isStale = () => stale;

    const pending = pushCollectionClientState(supabase, userId, { isStale });
    stale = true;
    await pending;

    expect(applyCollectionStatePayloadToLocal).not.toHaveBeenCalled();
    expect(upsertUserCollectionState).not.toHaveBeenCalled();
  });
});
