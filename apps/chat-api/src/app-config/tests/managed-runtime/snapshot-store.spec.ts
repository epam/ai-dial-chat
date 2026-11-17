import { describe, expect, it } from 'vitest';
import {
  ManagedConfigState,
  ManagedRefreshOutcome,
  type ManagedSnapshot,
} from '../../managed-runtime/managed-runtime.types';
import {
  ACCEPTED_REVISION_MEMORY,
  ManagedSnapshotStore,
} from '../../managed-runtime/snapshot-store';

const MAX_STALENESS_MS = 900_000;
const T = Date.UTC(2026, 10, 20, 10);

const snapshot = (
  revisionId: string,
  publishedAt = '2026-11-20T09:55:00.000Z',
): ManagedSnapshot =>
  Object.freeze({
    instanceId: 'chat-dev',
    appId: 'ai-dial-chat',
    environment: 'dev',
    schemaVersion: '1.0.0',
    schemaSha256: 'a'.repeat(64),
    revisionId,
    sha256: `${revisionId}-sha`,
    publishedAt,
    payload: Object.freeze({ config: {}, features: {} }),
    payloadSha256: `${revisionId}-payload`,
  });

const newStore = () =>
  new ManagedSnapshotStore('ai-dial-chat', 'chat-dev', MAX_STALENESS_MS);

describe('ManagedSnapshotStore', () => {
  it('is unavailable before any snapshot is accepted', () => {
    expect(newStore().capture(T)).toEqual({
      state: ManagedConfigState.Unavailable,
    });
  });

  it('turns stale at the exact staleness boundary without a refresh', () => {
    const store = newStore();
    store.recordAccepted(snapshot('r1'), T);
    store.recordFailure();

    expect(store.capture(T + MAX_STALENESS_MS)).toMatchObject({
      state: ManagedConfigState.Degraded,
      snapshot: expect.objectContaining({ revisionId: 'r1' }),
    });
    const stale = store.capture(T + MAX_STALENESS_MS + 1);
    expect(stale.state).toBe(ManagedConfigState.Stale);
    expect(stale.snapshot).toBeUndefined();
  });

  it('measures freshness from verification, not publication', () => {
    const store = newStore();
    store.recordAccepted(snapshot('r1', '2026-10-21T10:00:00.000Z'), T);
    expect(store.capture(T + 10_000).state).toBe(ManagedConfigState.Fresh);
  });

  it('verifies the active revision again without swapping it', () => {
    const store = newStore();
    const first = snapshot('r1');
    store.recordAccepted(first, T);
    store.recordFailure();

    const outcome = store.recordAccepted(snapshot('r1'), T + 600_000);

    expect(outcome).toBe(ManagedRefreshOutcome.Verified);
    const capture = store.capture(T + 600_000 + MAX_STALENESS_MS);
    expect(capture.state).toBe(ManagedConfigState.Fresh);
    expect(capture.snapshot).toBe(first);
  });

  it('swaps in a new revision', () => {
    const store = newStore();
    store.recordAccepted(snapshot('r1'), T);
    expect(store.recordAccepted(snapshot('r2'), T + 1)).toBe(
      ManagedRefreshOutcome.Accepted,
    );
    expect(store.capture(T + 1).snapshot?.revisionId).toBe('r2');
  });

  it('keeps the previous snapshot after a failure', () => {
    const store = newStore();
    store.recordAccepted(snapshot('r1'), T);
    store.recordFailure();
    expect(store.capture(T + 1)).toMatchObject({
      state: ManagedConfigState.Degraded,
      snapshot: expect.objectContaining({ revisionId: 'r1' }),
    });
  });

  it('discards the snapshot when nothing is published', () => {
    const store = newStore();
    store.recordAccepted(snapshot('r1'), T);
    store.recordNotPublished();
    expect(store.capture(T + 1)).toEqual({
      state: ManagedConfigState.NotPublished,
    });

    store.recordFailure();
    expect(store.capture(T + 2).state).toBe(ManagedConfigState.Unavailable);
  });

  it('remembers the hashes of the last accepted revisions only', () => {
    const store = newStore();
    for (let index = 0; index <= ACCEPTED_REVISION_MEMORY; index += 1) {
      store.recordAccepted(snapshot(`r${index}`), T + index);
    }
    expect(store.knownRevision('r0')).toBeUndefined();
    expect(store.knownRevision('r1')).toEqual({
      sha256: 'r1-sha',
      payloadSha256: 'r1-payload',
    });
  });
});
