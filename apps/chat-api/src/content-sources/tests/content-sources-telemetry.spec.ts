import { describe, expect, it } from 'vitest';
import {
  ContentSourcesAdmissionService,
  CONTENT_SOURCES_MAX_PRINCIPAL_IN_FLIGHT,
  CONTENT_SOURCES_MAX_TOTAL_IN_FLIGHT,
} from '../content-sources-admission.service';
import {
  resolveContentSourceLabel,
  UNKNOWN_CONTENT_SOURCE,
} from '../content-sources-telemetry';

describe('resolveContentSourceLabel', () => {
  it('keeps a known id and collapses everything else to one label', () => {
    expect(resolveContentSourceLabel('rn', true)).toBe('rn');
    expect(resolveContentSourceLabel('guess-1', false)).toBe(
      UNKNOWN_CONTENT_SOURCE,
    );
    expect(resolveContentSourceLabel('../x', false)).toBe(
      UNKNOWN_CONTENT_SOURCE,
    );
    expect(resolveContentSourceLabel(undefined, true)).toBe(
      UNKNOWN_CONTENT_SOURCE,
    );
  });
});

describe('ContentSourcesAdmissionService', () => {
  it('enforces the per-principal and global ceilings and frees entries', () => {
    const admission = new ContentSourcesAdmissionService();
    for (let i = 0; i < CONTENT_SOURCES_MAX_PRINCIPAL_IN_FLIGHT; i++) {
      expect(admission.tryAcquire('a')).toBe(true);
    }
    expect(admission.tryAcquire('a')).toBe(false);
    expect(admission.tryAcquire('b')).toBe(true);
    for (let i = 0; i < CONTENT_SOURCES_MAX_PRINCIPAL_IN_FLIGHT; i++) {
      admission.release('a');
    }
    admission.release('b');
    expect(admission.totalInFlightCount).toBe(0);
    expect(admission.trackedPrincipalCount).toBe(0);

    for (let i = 0; i < CONTENT_SOURCES_MAX_TOTAL_IN_FLIGHT; i++) {
      expect(admission.tryAcquire(`u${i}`)).toBe(true);
    }
    expect(admission.tryAcquire('another')).toBe(false);
  });
});
