import { describe, expect, it } from 'vitest';
import type {
  CustomVisualizer,
  CustomVisualizerData,
  CustomVisualizerDataLayout,
} from '../custom-visualizer';

describe('custom-visualizer type shapes', () => {
  it('compiles a full CustomVisualizer entry (all fields matching development schema)', () => {
    const entry: CustomVisualizer = {
      title: 'my-viz',
      description: 'A custom visualizer',
      icon: 'https://viz.example.com/icon.svg',
      contentType: 'application/x-my-viz, application/x-my-viz-2',
      url: 'https://viz.example.com',
      requestTimeout: 15000,
      passAuthInfo: false,
      passExplicitToken: false,
    };
    expect(entry.title).toBe('my-viz');
  });

  it('compiles a minimal CustomVisualizer entry (only required fields)', () => {
    const entry: CustomVisualizer = {
      title: 'my-viz',
      contentType: 'application/x-my-viz',
      url: 'https://viz.example.com',
    };
    expect(entry.requestTimeout).toBeUndefined();
  });

  it('compiles a CustomVisualizerDataLayout with only themeId', () => {
    const layout: CustomVisualizerDataLayout = {
      themeId: 'dark',
    };
    expect(layout.themeId).toBe('dark');
  });

  it('compiles CustomVisualizerData with an opaque payload alongside layout', () => {
    const data: CustomVisualizerData = {
      layout: { themeId: 'dark' },
      series: [1, 2, 3],
    };
    expect(data['series']).toEqual([1, 2, 3]);
  });
});
