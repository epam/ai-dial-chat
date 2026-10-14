import { UsageLimitBannerSeverity } from '@epam/ai-dial-conversation-input';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetUsageLimitBannerDismissals } from '../../useUsageLimitBannerDismissal/useUsageLimitBannerDismissal';
import { useUsageLimitBanner } from '../useUsageLimitBanner';

const t = (key: string, options?: Record<string, unknown>): string =>
  options == null ? key : `${key}:${JSON.stringify(options)}`;

const warningDto = {
  dayTokenStats: { used: 80, total: 100, resetsAt: '2026-10-14T00:00:00Z' },
};

const setup = (
  overrides: Partial<Parameters<typeof useUsageLimitBanner>[0]> = {},
) => {
  const getDeploymentLimits = vi.fn().mockResolvedValue(warningDto);
  const view = renderHook(() =>
    useUsageLimitBanner({
      deploymentId: 'gpt-4o',
      getDeploymentLimits,
      warningThresholdPercent: 75,
      activeLocale: 'en',
      t,
      ...overrides,
    }),
  );
  return { ...view, getDeploymentLimits };
};

afterEach(() => {
  resetUsageLimitBannerDismissals();
});

describe('useUsageLimitBanner', () => {
  it('returns no banner without a deployment', () => {
    const { result, getDeploymentLimits } = setup({ deploymentId: undefined });

    expect(result.current.banner).toBeUndefined();
    expect(getDeploymentLimits).not.toHaveBeenCalled();
  });

  it('returns the translated warning once limits load', async () => {
    const { result } = setup();

    await waitFor(() => expect(result.current.banner).toBeDefined());

    expect(result.current.banner).toMatchObject({
      severity: UsageLimitBannerSeverity.Warning,
      limitText: 'conversationInput.usageBanner.warningDay:{"percent":80}',
      closeAriaLabel: 'conversationInput.usageBanner.closeLabel',
      reset: { isoValue: '2026-10-14T00:00:00Z' },
    });
  });

  it('returns no banner below the threshold', async () => {
    const { result, getDeploymentLimits } = setup({
      warningThresholdPercent: 90,
    });

    await waitFor(() => expect(getDeploymentLimits).toHaveBeenCalled());

    expect(result.current.banner).toBeUndefined();
  });

  it('hides the banner after onClose and keeps it hidden', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.banner).toBeDefined());

    act(() => result.current.banner?.onClose?.());

    expect(result.current.banner).toBeUndefined();
  });

  it('refetches after generation ends', async () => {
    const getDeploymentLimits = vi.fn().mockResolvedValue(warningDto);
    const { rerender } = renderHook(
      ({ busy }: { busy: boolean }) =>
        useUsageLimitBanner({
          deploymentId: 'gpt-4o',
          isGenerationInProgress: busy,
          getDeploymentLimits,
          warningThresholdPercent: 75,
          activeLocale: 'en',
          t,
        }),
      { initialProps: { busy: true } },
    );
    await waitFor(() => expect(getDeploymentLimits).toHaveBeenCalledTimes(1));

    rerender({ busy: false });

    await waitFor(() => expect(getDeploymentLimits).toHaveBeenCalledTimes(2));
  });
});
