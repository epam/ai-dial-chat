import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  type UseRefreshUsageAfterGenerationOptions,
  useRefreshUsageAfterGeneration,
} from '../useRefreshUsageAfterGeneration';

const renderRefreshHook = (
  initial: Omit<UseRefreshUsageAfterGenerationOptions, 'refresh'>,
) => {
  const refresh = vi.fn();
  const utils = renderHook(
    (props: Omit<UseRefreshUsageAfterGenerationOptions, 'refresh'>) =>
      useRefreshUsageAfterGeneration({ ...props, refresh }),
    { initialProps: initial },
  );

  return { ...utils, refresh };
};

describe('useRefreshUsageAfterGeneration', () => {
  it('refreshes once when generation ends', () => {
    const { rerender, refresh } = renderRefreshHook({
      isGenerationInProgress: true,
      isLoading: false,
    });

    rerender({ isGenerationInProgress: false, isLoading: false });
    rerender({ isGenerationInProgress: false, isLoading: false });

    expect(refresh).toHaveBeenCalledOnce();
  });

  it('defers the refresh while a fetch is in flight', () => {
    const { rerender, refresh } = renderRefreshHook({
      isGenerationInProgress: true,
      isLoading: true,
    });

    rerender({ isGenerationInProgress: false, isLoading: true });
    expect(refresh).not.toHaveBeenCalled();

    rerender({ isGenerationInProgress: false, isLoading: false });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('does not refresh without a true-to-false transition', () => {
    const { rerender, refresh } = renderRefreshHook({
      isGenerationInProgress: false,
      isLoading: false,
    });

    rerender({ isGenerationInProgress: false, isLoading: true });
    rerender({ isGenerationInProgress: true, isLoading: false });

    expect(refresh).not.toHaveBeenCalled();
  });
});
