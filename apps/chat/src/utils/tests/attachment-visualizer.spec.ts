import type { CustomVisualizer } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { findVisualizerForMime } from '../attachment-visualizer';

const makeEntry = (contentType: string): CustomVisualizer => ({
  contentType,
  url: 'https://viz.example.com',
  title: 'my-viz',
});

describe('findVisualizerForMime', () => {
  it('returns undefined for an empty registry', () => {
    expect(findVisualizerForMime('application/json', [])).toBeUndefined();
  });

  it('matches a single MIME type', () => {
    const entry = makeEntry('application/x-my-viz');
    expect(findVisualizerForMime('application/x-my-viz', [entry])).toBe(entry);
  });

  it('matches case-insensitively', () => {
    const entry = makeEntry('Application/X-My-Viz');
    expect(findVisualizerForMime('application/x-my-viz', [entry])).toBe(entry);
  });

  it('matches a MIME from the middle of a comma-separated contentType list', () => {
    const entry = makeEntry(
      'application/x-foo, application/x-bar, application/x-baz',
    );
    expect(findVisualizerForMime('application/x-bar', [entry])).toBe(entry);
  });

  it('trims whitespace around comma-separated parts', () => {
    const entry = makeEntry('  application/x-foo  ,  application/x-bar  ');
    expect(findVisualizerForMime('application/x-bar', [entry])).toBe(entry);
  });

  it('skips empty parts from a trailing comma', () => {
    const entry = makeEntry('application/x-foo,');
    expect(findVisualizerForMime('', [entry])).toBeUndefined();
  });

  it('returns the first matching entry (first-match-wins)', () => {
    const first = makeEntry('application/x-shared');
    const second = {
      ...makeEntry('application/x-shared'),
      title: 'second-viz',
    };
    expect(findVisualizerForMime('application/x-shared', [first, second])).toBe(
      first,
    );
  });

  it('returns undefined when no entry matches', () => {
    const entry = makeEntry('application/x-foo');
    expect(findVisualizerForMime('application/x-bar', [entry])).toBeUndefined();
  });
});
