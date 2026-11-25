import { describe, expect, it, vi } from 'vitest';
import {
  ContentSourceQueueOutcome,
  contentSourcesUpstreamQueueDuration,
  recordContentSourceQueueWait,
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

describe('recordContentSourceQueueWait', () => {
  it('labels a queue wait with the source id and outcome only', () => {
    const record = vi.spyOn(contentSourcesUpstreamQueueDuration, 'record');
    recordContentSourceQueueWait(
      'rn',
      0.25,
      ContentSourceQueueOutcome.TimedOut,
    );
    expect(record).toHaveBeenCalledWith(0.25, {
      'dial.chat.content_sources.source': 'rn',
      'dial.chat.content_sources.queue_outcome': 'timed_out',
    });
    record.mockRestore();
  });
});
