import type { ApplicationVisualizerRegistry } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAppConfig } from '../../../context/AppConfigContext';
import { UserConfigStatus } from '../../../types/user-config-status';
import { useApplicationVisualizers } from '../useApplicationVisualizers';

const registry: ApplicationVisualizerRegistry = {
  'app-1': { title: 'my-viz', url: 'https://viz.example.com' },
};

vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);

describe('useApplicationVisualizers', () => {
  it('returns an empty registry while config is loading', () => {
    vi.mocked(useAppConfig).mockReturnValue({
      status: UserConfigStatus.Loading,
      features: {},
      config: { applicationVisualizers: registry } as never,
    });

    const { result } = renderHook(() => useApplicationVisualizers());
    expect(result.current).toEqual({});
  });

  it('returns the registry when config is ready', () => {
    vi.mocked(useAppConfig).mockReturnValue({
      status: UserConfigStatus.Ready,
      features: {},
      config: { applicationVisualizers: registry } as never,
    });

    const { result } = renderHook(() => useApplicationVisualizers());
    expect(result.current).toBe(registry);
  });

  it('returns an empty registry on error status', () => {
    vi.mocked(useAppConfig).mockReturnValue({
      status: UserConfigStatus.Error,
      features: {},
      config: { applicationVisualizers: registry } as never,
    });

    const { result } = renderHook(() => useApplicationVisualizers());
    expect(result.current).toEqual({});
  });

  it('returns a stable reference across re-renders while config is loading', () => {
    vi.mocked(useAppConfig).mockReturnValue({
      status: UserConfigStatus.Loading,
      features: {},
      config: { applicationVisualizers: registry } as never,
    });

    const { result, rerender } = renderHook(() => useApplicationVisualizers());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
