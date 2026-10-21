import { UsageLimitBannerSeverity } from '@epam/ai-dial-conversation-input';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetUsageLimitBannerDismissals } from '../../useUsageLimitBannerDismissal/useUsageLimitBannerDismissal';
import { useUsageLimitBanner } from '../useUsageLimitBanner';

const t = (key: string, options?: Record<string, unknown>): string =>
  options == null ? key : `${key}:${JSON.stringify(options)}`;

const warningUsage = {
  dayTokenStats: { used: 80, total: 100, resetsAt: '2026-10-14T00:00:00Z' },
};

const comfortableAccount = { weekCostStats: { used: 10, total: 200 } };

const setup = (
  overrides: Partial<Parameters<typeof useUsageLimitBanner>[0]> = {},
) => {
  const getDeploymentUsage = vi.fn().mockResolvedValue(warningUsage);
  const getAccountUsage = vi.fn().mockResolvedValue(comfortableAccount);
  const view = renderHook(() =>
    useUsageLimitBanner({
      deploymentId: 'gpt-4o',
      getDeploymentUsage,
      getAccountUsage,
      warningThresholdPercent: 75,
      activeLocale: 'en',
      t,
      ...overrides,
    }),
  );
  return { ...view, getDeploymentUsage, getAccountUsage };
};

afterEach(() => {
  resetUsageLimitBannerDismissals();
});

describe('useUsageLimitBanner', () => {
  it('returns no banner without a deployment', () => {
    const { result, getDeploymentUsage, getAccountUsage } = setup({
      deploymentId: undefined,
    });

    expect(result.current.banner).toBeUndefined();
    expect(getDeploymentUsage).not.toHaveBeenCalled();
    expect(getAccountUsage).not.toHaveBeenCalled();
  });

  it('returns the translated warning once usage loads', async () => {
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
    const { result, getDeploymentUsage } = setup({
      warningThresholdPercent: 90,
    });

    await waitFor(() => expect(getDeploymentUsage).toHaveBeenCalled());

    expect(result.current.banner).toBeUndefined();
  });

  it('warns from the account cost when the deployment usage fails', async () => {
    const { result } = setup({
      getDeploymentUsage: vi.fn().mockRejectedValue(new Error('Not Found')),
      getAccountUsage: vi
        .fn()
        .mockResolvedValue({ dayCostStats: { used: 90, total: 100 } }),
    });

    await waitFor(() => expect(result.current.banner).toBeDefined());

    expect(result.current.banner).toMatchObject({
      severity: UsageLimitBannerSeverity.Warning,
      limitText: 'conversationInput.usageBanner.warningDay:{"percent":90}',
    });
  });

  it('raises no banner for an agent whose account budget is comfortable', async () => {
    const getAccountUsage = vi
      .fn()
      .mockResolvedValue({ weekCostStats: { used: 132.24, total: 200 } });
    const { result } = setup({
      deploymentId: 'dial-chathub-v2',
      getDeploymentUsage: vi.fn().mockResolvedValue({
        dayTokenStats: { used: 0, total: 2_000_000 },
        weekCostStats: { used: 130.98, total: Number.MAX_SAFE_INTEGER },
      }),
      getAccountUsage,
    });

    await waitFor(() => expect(getAccountUsage).toHaveBeenCalled());

    expect(result.current.banner).toBeUndefined();
  });

  it('hides the banner after onClose and keeps it hidden', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.banner).toBeDefined());

    act(() => result.current.banner?.onClose?.());

    expect(result.current.banner).toBeUndefined();
  });

  it('refetches both sources after generation ends', async () => {
    const getDeploymentUsage = vi.fn().mockResolvedValue(warningUsage);
    const getAccountUsage = vi.fn().mockResolvedValue(comfortableAccount);
    const { rerender } = renderHook(
      ({ busy }: { busy: boolean }) =>
        useUsageLimitBanner({
          deploymentId: 'gpt-4o',
          isGenerationInProgress: busy,
          getDeploymentUsage,
          getAccountUsage,
          warningThresholdPercent: 75,
          activeLocale: 'en',
          t,
        }),
      { initialProps: { busy: true } },
    );
    await waitFor(() => expect(getDeploymentUsage).toHaveBeenCalledOnce());

    rerender({ busy: false });

    await waitFor(() => expect(getDeploymentUsage).toHaveBeenCalledTimes(2));
    expect(getAccountUsage).toHaveBeenCalledTimes(2);
  });
});
