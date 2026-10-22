import type { DeploymentLimitsResponseDto } from '@epam/ai-dial-chat-api-client';
import {
  type AccountUsage,
  resetUsageLimitBannerDismissals,
} from '@epam/ai-dial-chat-hooks';
import {
  UsageLimitBannerSeverity,
  UsageLimitBannerView,
} from '@epam/ai-dial-conversation-input';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppConfig } from '../../../context/AppConfigContext';
import {
  getDeploymentLimits,
  getDeploymentUsage,
} from '../../../server-api/deployment-limits';
import { getUserUsage } from '../../../server-api/user-limits';
import UsageLimitBanner from '../UsageLimitBanner';

/* Resolves keys against the real en.json, so the assertions read the English
   copy a user sees rather than raw keys. `t` stays referentially stable, as
   the real hook's does. */
vi.mock('react-i18next', async () => {
  const { default: en } = await import('../../../i18n/locales/en.json');
  const lookup = (key: string): unknown =>
    key
      .split('.')
      .reduce<unknown>(
        (node, part) => (node as Record<string, unknown> | undefined)?.[part],
        en,
      );
  const t = (key: string, params?: Record<string, unknown>) => {
    const template = lookup(key);
    if (typeof template !== 'string') return key;
    return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
      String(params?.[name] ?? ''),
    );
  };
  const result = { t, i18n: { language: 'en', changeLanguage: vi.fn() } };
  return { useTranslation: () => result };
});

/* The real lib view renders; the spy only records the props it gets. */
vi.mock('@epam/ai-dial-conversation-input', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-conversation-input')>();
  return {
    ...actual,
    UsageLimitBannerView: vi.fn(actual.UsageLimitBannerView),
  };
});

vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);

vi.mock('../../../server-api/deployment-limits', () => ({
  getDeploymentLimits: vi.fn(),
  getDeploymentUsage: vi.fn(),
}));

vi.mock('../../../server-api/user-limits', () => ({
  getUserUsage: vi.fn(),
}));

const mockUseAppConfig = vi.mocked(useAppConfig);
const mockGetDeploymentLimits = vi.mocked(getDeploymentLimits);
const mockGetDeploymentUsage = vi.mocked(getDeploymentUsage);
const mockGetUserUsage = vi.mocked(getUserUsage);

/* Places the test in UTC by stubbing only the zero-argument zone resolution;
   the real formatter does the formatting (see usage-reset-time.spec.ts). */
const OriginalDateTimeFormat = Intl.DateTimeFormat;
const mockUtcZone = (): void => {
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function (
    locales?: string | string[],
    options?: Intl.DateTimeFormatOptions,
  ) {
    if (locales === undefined && options === undefined) {
      return { resolvedOptions: () => ({ timeZone: 'UTC' }) };
    }
    return new OriginalDateTimeFormat(locales, options);
  } as unknown as typeof Intl.DateTimeFormat);
};

const DEPLOYMENT_ID = 'gpt-4o';
/* `memo` skips a rerender with equal props, so a data change remounts under a
   new key to force a fresh fetch — harmless here, as the dismissal store is
   module-scoped. */
let renderKey = 0;
const nextKey = (): number => ++renderKey;

const DAY_RESET = '2026-10-14T00:00:00Z';
const MONTH_RESET = '2026-11-01T00:00:00Z';

/* Pass `null` for a stat without `resetsAt`; a default parameter would
   swallow an explicit `undefined`. */
const dayAt = (used: number, resetsAt: string | null = DAY_RESET) => ({
  dayTokenStats: { used, total: 100, resetsAt: resetsAt ?? undefined },
});

/* Splits a combined fixture the way the two endpoints return it: day, week,
   and month cost stats on the account usage, the rest on the deployment's
   own usage. */
const setLimits = (dto: DeploymentLimitsResponseDto): void => {
  const deployment: DeploymentLimitsResponseDto = { ...dto };
  const account: AccountUsage = {};
  for (const key of [
    'dayCostStats',
    'weekCostStats',
    'monthCostStats',
  ] as const) {
    account[key] = dto[key];
    delete deployment[key];
  }
  mockGetDeploymentUsage.mockResolvedValue(deployment);
  mockGetUserUsage.mockResolvedValue(account);
};

const setThreshold = (usageLimitsWarningThresholdPercent: number): void => {
  mockUseAppConfig.mockReturnValue({
    config: { usageLimitsWarningThresholdPercent },
  } as ReturnType<typeof useAppConfig>);
};

/* Lets the limits fetch settle and its state update render. */
const settle = (): Promise<void> => act(() => Promise.resolve());

const renderBanner = async (deploymentId: string | undefined) => {
  const view = render(<UsageLimitBanner deploymentId={deploymentId} />);
  await settle();
  return view;
};

const remountBanner = async (
  rerender: (ui: ReactNode) => void,
  deploymentId: string,
): Promise<void> => {
  rerender(<UsageLimitBanner key={nextKey()} deploymentId={deploymentId} />);
  await settle();
};

describe('UsageLimitBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({
      now: new Date('2026-10-13T12:00:00Z'),
      shouldAdvanceTime: true,
    });
    mockUtcZone();
    setThreshold(75);
  });

  afterEach(() => {
    resetUsageLimitBannerDismissals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders the daily warning wording with its reset time', async () => {
    setLimits(dayAt(80));
    await renderBanner(DEPLOYMENT_ID);

    const banner = screen.getByRole('status');
    expect(banner.textContent).toMatch(
      /^Daily limit 80% used\. Resets at 12:00\sAM GMT(\+0)?\./,
    );
    expect(screen.getByText('Daily limit 80% used.')).toBeTruthy();
  });

  it('wraps the reset sentence in a <time> carrying the original instant and a spoken form', async () => {
    setLimits(dayAt(80));
    await renderBanner(DEPLOYMENT_ID);

    const time = screen.getByText(/^Resets at/);
    expect(time.tagName).toBe('TIME');
    expect(time.getAttribute('dateTime')).toBe(DAY_RESET);
    expect(screen.getByText(/^Usage resets Oct 14, 2026/)).toBeTruthy();
  });

  it('renders the reached wording with a date for a monthly limit', async () => {
    setLimits({
      monthCostStats: { used: 100, total: 100, resetsAt: MONTH_RESET },
    });
    await renderBanner(DEPLOYMENT_ID);

    expect(screen.getByText('Monthly limit reached.')).toBeTruthy();
    expect(screen.getByText('Resets on Nov 1.')).toBeTruthy();
  });

  it('passes the severity, translated limit sentence, and a close handler to the lib view', async () => {
    setLimits(dayAt(100));
    const { rerender } = await renderBanner(DEPLOYMENT_ID);
    expect(vi.mocked(UsageLimitBannerView)).toHaveBeenLastCalledWith(
      expect.objectContaining({
        severity: UsageLimitBannerSeverity.Reached,
        limitText: 'Daily limit reached.',
        onClose: expect.any(Function),
      }),
      undefined,
    );

    setLimits(dayAt(80));
    await remountBanner(rerender, DEPLOYMENT_ID);
    expect(vi.mocked(UsageLimitBannerView)).toHaveBeenLastCalledWith(
      expect.objectContaining({
        severity: UsageLimitBannerSeverity.Warning,
        limitText: 'Daily limit 80% used.',
      }),
      undefined,
    );
  });

  it('announces politely through role="status", never role="alert"', async () => {
    setLimits(dayAt(100));
    await renderBanner(DEPLOYMENT_ID);

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders nothing below the threshold', async () => {
    setLimits(dayAt(70));
    await renderBanner(DEPLOYMENT_ID);

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders nothing for an agent while the account budget is comfortable', async () => {
    mockGetDeploymentUsage.mockResolvedValue({
      dayTokenStats: { used: 0, total: 2_000_000 },
      weekCostStats: { used: 130.98, total: Number.MAX_SAFE_INTEGER },
    });
    mockGetUserUsage.mockResolvedValue({
      weekCostStats: { used: 132.24, total: 200 },
    });
    await renderBanner('dial-chathub-v2');

    expect(mockGetUserUsage).toHaveBeenCalledOnce();
    expect(mockGetDeploymentLimits).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('follows a custom threshold', async () => {
    setThreshold(90);
    setLimits(dayAt(80));
    const { rerender } = await renderBanner(DEPLOYMENT_ID);
    expect(screen.queryByRole('status')).toBeNull();

    setLimits(dayAt(92));
    await remountBanner(rerender, DEPLOYMENT_ID);
    expect(screen.getByText('Daily limit 92% used.')).toBeTruthy();
  });

  it('renders nothing while the first fetch is pending', async () => {
    mockGetDeploymentUsage.mockReturnValue(new Promise<never>(() => undefined));
    mockGetUserUsage.mockReturnValue(new Promise<never>(() => undefined));
    await renderBanner(DEPLOYMENT_ID);

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders nothing without a deployment', async () => {
    setLimits(dayAt(80));
    await renderBanner(undefined);

    expect(screen.queryByRole('status')).toBeNull();
    expect(mockGetDeploymentUsage).not.toHaveBeenCalled();
    expect(mockGetUserUsage).not.toHaveBeenCalled();
  });

  it('omits the reset sentence when resetsAt is absent', async () => {
    setLimits(dayAt(80, null));
    await renderBanner(DEPLOYMENT_ID);

    expect(screen.getByRole('status').textContent).toBe(
      'Daily limit 80% used.',
    );
  });

  describe('dismissal', () => {
    it('stays hidden as usage creeps up and reappears on escalation', async () => {
      const user = userEvent.setup({ delay: null });
      setLimits(dayAt(80));
      const { rerender } = await renderBanner(DEPLOYMENT_ID);

      await user.click(screen.getByRole('button'));
      expect(screen.queryByRole('status')).toBeNull();

      setLimits(dayAt(85));
      await remountBanner(rerender, DEPLOYMENT_ID);
      expect(screen.queryByRole('status')).toBeNull();

      setLimits(dayAt(100));
      await remountBanner(rerender, DEPLOYMENT_ID);
      expect(screen.getByText('Daily limit reached.')).toBeTruthy();
    });

    it('reappears for another deployment', async () => {
      const user = userEvent.setup({ delay: null });
      setLimits(dayAt(80));
      const { rerender } = await renderBanner('gpt-4o');

      await user.click(screen.getByRole('button'));
      expect(screen.queryByRole('status')).toBeNull();

      rerender(<UsageLimitBanner deploymentId="claude" />);
      await settle();
      expect(screen.getByText('Daily limit 80% used.')).toBeTruthy();
    });

    it('survives a remount, as when moving from the new-chat screen to a conversation', async () => {
      const user = userEvent.setup({ delay: null });
      setLimits(dayAt(80));
      const { unmount } = await renderBanner(DEPLOYMENT_ID);

      await user.click(screen.getByRole('button'));
      unmount();
      await renderBanner(DEPLOYMENT_ID);

      expect(screen.queryByRole('status')).toBeNull();
    });

    it('dismisses from the keyboard', async () => {
      const user = userEvent.setup({ delay: null });
      setLimits(dayAt(80));
      await renderBanner(DEPLOYMENT_ID);

      await user.tab();
      await user.keyboard('{Enter}');

      expect(screen.queryByRole('status')).toBeNull();
    });
  });

  it('refetches once after a response finishes streaming', async () => {
    setLimits(dayAt(80));
    const { rerender } = render(
      <UsageLimitBanner deploymentId="gpt-4o" isGenerationInProgress />,
    );
    await settle();
    expect(mockGetDeploymentUsage).toHaveBeenCalledOnce();
    expect(mockGetUserUsage).toHaveBeenCalledOnce();

    rerender(
      <UsageLimitBanner deploymentId="gpt-4o" isGenerationInProgress={false} />,
    );
    await settle();

    expect(mockGetDeploymentUsage).toHaveBeenCalledTimes(2);
    expect(mockGetUserUsage).toHaveBeenCalledTimes(2);
    expect(mockGetDeploymentLimits).not.toHaveBeenCalled();
  });

  it('keeps its content order and roles under dir="rtl"', async () => {
    setLimits(dayAt(80));
    render(
      <div dir="rtl">
        <UsageLimitBanner deploymentId="gpt-4o" />
      </div>,
    );
    await settle();

    const banner = screen.getByRole('status');
    const sentence = screen.getByText('Daily limit 80% used.');
    const time = screen.getByText(/^Resets at/);
    expect(
      sentence.compareDocumentPosition(time) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(banner.contains(screen.getByRole('button'))).toBe(true);
  });

  it('sets no fixed width, so it wraps inside the composer on narrow screens', async () => {
    setLimits(dayAt(80));
    await renderBanner(DEPLOYMENT_ID);

    const banner = screen.getByRole('status');
    expect(banner.className).not.toMatch(/(^|\s)(w|min-w)-\[?\d/);
    expect(banner.style.width).toBe('');
  });
});
