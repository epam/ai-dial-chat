import type { CustomVisualizer } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAppConfig } from '../../../context/AppConfigContext';
import { UserConfigStatus } from '../../../types/user-config-status';
import { useCustomVisualizers } from '../useCustomVisualizers';

const makeEntry = (contentType: string): CustomVisualizer => ({
  contentType,
  url: 'https://viz.example.com',
  title: 'my-viz',
});

vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: vi.fn(),
}));

describe('useCustomVisualizers', () => {
  it('returns [] while config is loading', () => {
    vi.mocked(useAppConfig).mockReturnValue({
      status: UserConfigStatus.Loading,
      features: {},
      config: { customVisualizers: [makeEntry('application/x-test')] } as never,
    });

    const { result } = renderHook(() => useCustomVisualizers());
    expect(result.current).toEqual([]);
  });

  it('returns the visualizers array when config is ready', () => {
    const entries = [
      makeEntry('application/x-test'),
      makeEntry('application/x-other'),
    ];
    vi.mocked(useAppConfig).mockReturnValue({
      status: UserConfigStatus.Ready,
      features: {},
      config: { customVisualizers: entries } as never,
    });

    const { result } = renderHook(() => useCustomVisualizers());
    expect(result.current).toEqual(entries);
  });

  it('returns [] on error status', () => {
    vi.mocked(useAppConfig).mockReturnValue({
      status: UserConfigStatus.Error,
      features: {},
      config: { customVisualizers: [makeEntry('application/x-test')] } as never,
    });

    const { result } = renderHook(() => useCustomVisualizers());
    expect(result.current).toEqual([]);
  });

  it('returns a stable reference across re-renders when data is unchanged', () => {
    const entries = [makeEntry('application/x-test')];
    vi.mocked(useAppConfig).mockReturnValue({
      status: UserConfigStatus.Ready,
      features: {},
      config: { customVisualizers: entries } as never,
    });

    const { result, rerender } = renderHook(() => useCustomVisualizers());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('returns a stable reference across re-renders while config is loading', () => {
    vi.mocked(useAppConfig).mockReturnValue({
      status: UserConfigStatus.Loading,
      features: {},
      config: { customVisualizers: [makeEntry('application/x-test')] } as never,
    });

    const { result, rerender } = renderHook(() => useCustomVisualizers());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
