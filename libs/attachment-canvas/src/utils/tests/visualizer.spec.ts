import type { CustomVisualizer } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { findVisualizerForMime } from '../visualizer';

const makeVisualizer = (
  contentType: string,
  overrides?: Partial<CustomVisualizer>,
): CustomVisualizer => ({
  title: 'my-viz',
  description: 'test viz',
  icon: 'icon.svg',
  contentType,
  url: 'https://viz.example.com',
  requestTimeout: 5000,
  ...overrides,
});

describe('findVisualizerForMime', () => {
  it('matches a single-entry contentType list case-insensitively', () => {
    const visualizer = makeVisualizer('application/pdf');

    expect(findVisualizerForMime('application/PDF', [visualizer])).toBe(
      visualizer,
    );
  });

  it('matches against a comma-separated contentType list', () => {
    const visualizer = makeVisualizer('text/plain,application/pdf');

    expect(findVisualizerForMime('application/pdf', [visualizer])).toBe(
      visualizer,
    );
  });

  it('matches a MIME type from the middle of a comma-separated list', () => {
    const visualizer = makeVisualizer(
      'application/x-foo, application/x-my-viz, application/x-bar',
    );

    expect(findVisualizerForMime('application/x-my-viz', [visualizer])).toBe(
      visualizer,
    );
  });

  it('trims whitespace around comma-separated entries', () => {
    const visualizer = makeVisualizer('  application/pdf  ,  text/plain  ');

    expect(findVisualizerForMime('application/pdf', [visualizer])).toBe(
      visualizer,
    );
  });

  it('returns the first match when multiple entries cover the same MIME type', () => {
    const first = makeVisualizer('application/pdf', { title: 'first' });
    const second = makeVisualizer('application/pdf', { title: 'second' });

    expect(findVisualizerForMime('application/pdf', [first, second])).toBe(
      first,
    );
  });

  it('returns undefined when no visualizer matches', () => {
    const visualizer = makeVisualizer('application/pdf');

    expect(findVisualizerForMime('application/json', [visualizer])).toBe(
      undefined,
    );
  });

  it('returns undefined for an empty registry', () => {
    expect(findVisualizerForMime('application/pdf', [])).toBe(undefined);
  });

  it('ignores an empty contentType entry produced by a trailing comma', () => {
    const visualizer = makeVisualizer('application/pdf,');

    expect(findVisualizerForMime('', [visualizer])).toBe(undefined);
  });
});
