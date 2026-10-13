import type { DeploymentLimitsResponseDto } from '@epam/ai-dial-chat-api-client';
import {
  UsageLimitBannerSeverity,
  UsageLimitBannerView,
} from '@epam/ai-dial-conversation-input';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppConfig } from '../../../context/AppConfigContext';
import { useDeploymentUsageLimits } from '../../../hooks/useDeploymentUsageLimits';
import type { UseDeploymentUsageLimitsResult } from '../../../hooks/useDeploymentUsageLimits';
import { resetUsageLimitBannerDismissals } from '../../../hooks/useUsageLimitBannerDismissal';
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

vi.mock('../../../hooks/useDeploymentUsageLimits', () => ({
  useDeploymentUsageLimits: vi.fn(),
}));

const mockUseAppConfig = vi.mocked(useAppConfig);
const mockUseDeploymentUsageLimits = vi.mocked(useDeploymentUsageLimits);

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
/* The mocked limits hook cannot trigger a render, and `memo` skips a
   rerender with equal props, so each data change remounts under a new key —
   harmless here, as the dismissal store is module-scoped. */
let renderKey = 0;
const nextKey = (): number => ++renderKey;

const DAY_RESET = '2026-10-14T00:00:00Z';
const MONTH_RESET = '2026-11-01T00:00:00Z';

/* Pass `null` for a stat without `resetsAt`; a default parameter would
   swallow an explicit `undefined`. */
const dayAt = (used: number, resetsAt: string | null = DAY_RESET) => ({
  dayTokenStats: { used, total: 100, resetsAt: resetsAt ?? undefined },
});

const setLimits = (
  limitsDto: DeploymentLimitsResponseDto | undefined,
  overrides: Partial<UseDeploymentUsageLimitsResult> = {},
): UseDeploymentUsageLimitsResult => {
  const result: UseDeploymentUsageLimitsResult = {
    limitsDto,
    isLoading: false,
    hasError: false,
    refresh: vi.fn(),
    ...overrides,
  };
  mockUseDeploymentUsageLimits.mockReturnValue(result);
  return result;
};

const setThreshold = (usageLimitsWarningThresholdPercent: number): void => {
  mockUseAppConfig.mockReturnValue({
    config: { usageLimitsWarningThresholdPercent },
  } as ReturnType<typeof useAppConfig>);
};

const renderBanner = (deploymentId: string | undefined) =>
  render(<UsageLimitBanner deploymentId={deploymentId} />);

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

  it('renders the daily warning wording with its reset time', () => {
    setLimits(dayAt(80));
    renderBanner(DEPLOYMENT_ID);

    const banner = screen.getByRole('status');
    expect(banner.textContent).toMatch(
      /^Daily limit 80% used\. Resets at 12:00\sAM GMT\./,
    );
    expect(screen.getByText('Daily limit 80% used.')).toBeTruthy();
  });

  it('wraps the reset sentence in a <time> carrying the original instant and a spoken form', () => {
    setLimits(dayAt(80));
    renderBanner(DEPLOYMENT_ID);

    const time = screen.getByText(/^Resets at/);
    expect(time.tagName).toBe('TIME');
    expect(time.getAttribute('dateTime')).toBe(DAY_RESET);
    expect(screen.getByText(/^Usage resets Oct 14, 2026/)).toBeTruthy();
  });

  it('renders the reached wording with a date for a monthly limit', () => {
    setLimits({
      monthCostStats: { used: 100, total: 100, resetsAt: MONTH_RESET },
    });
    renderBanner(DEPLOYMENT_ID);

    expect(screen.getByText('Monthly limit reached.')).toBeTruthy();
    expect(screen.getByText('Resets on Nov 1.')).toBeTruthy();
  });

  it('passes the severity, translated limit sentence, and a close handler to the lib view', () => {
    setLimits(dayAt(100));
    const { rerender } = renderBanner(DEPLOYMENT_ID);
    expect(vi.mocked(UsageLimitBannerView)).toHaveBeenLastCalledWith(
      expect.objectContaining({
        severity: UsageLimitBannerSeverity.Reached,
        limitText: 'Daily limit reached.',
        onClose: expect.any(Function),
      }),
      undefined,
    );

    setLimits(dayAt(80));
    rerender(<UsageLimitBanner key={nextKey()} deploymentId={DEPLOYMENT_ID} />);
    expect(vi.mocked(UsageLimitBannerView)).toHaveBeenLastCalledWith(
      expect.objectContaining({
        severity: UsageLimitBannerSeverity.Warning,
        limitText: 'Daily limit 80% used.',
      }),
      undefined,
    );
  });

  it('announces politely through role="status", never role="alert"', () => {
    setLimits(dayAt(100));
    renderBanner(DEPLOYMENT_ID);

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders nothing below the threshold', () => {
    setLimits(dayAt(70));
    renderBanner(DEPLOYMENT_ID);

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('follows a custom threshold', () => {
    setThreshold(90);
    setLimits(dayAt(80));
    const { rerender } = renderBanner(DEPLOYMENT_ID);
    expect(screen.queryByRole('status')).toBeNull();

    setLimits(dayAt(92));
    rerender(<UsageLimitBanner key={nextKey()} deploymentId={DEPLOYMENT_ID} />);
    expect(screen.getByText('Daily limit 92% used.')).toBeTruthy();
  });

  it('renders nothing while the first fetch is pending', () => {
    setLimits(undefined, { isLoading: true });
    renderBanner(DEPLOYMENT_ID);

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders nothing without a deployment', () => {
    setLimits(dayAt(80));
    renderBanner(undefined);

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('keeps the last value when a refresh fails', () => {
    setLimits(dayAt(80), { hasError: true });
    renderBanner(DEPLOYMENT_ID);

    expect(screen.getByText('Daily limit 80% used.')).toBeTruthy();
  });

  it('omits the reset sentence when resetsAt is absent', () => {
    setLimits(dayAt(80, null));
    renderBanner(DEPLOYMENT_ID);

    expect(screen.getByRole('status').textContent).toBe(
      'Daily limit 80% used.',
    );
  });

  describe('dismissal', () => {
    it('stays hidden as usage creeps up and reappears on escalation', async () => {
      const user = userEvent.setup({ delay: null });
      setLimits(dayAt(80));
      const { rerender } = renderBanner(DEPLOYMENT_ID);

      await user.click(screen.getByRole('button'));
      expect(screen.queryByRole('status')).toBeNull();

      setLimits(dayAt(85));
      rerender(
        <UsageLimitBanner key={nextKey()} deploymentId={DEPLOYMENT_ID} />,
      );
      expect(screen.queryByRole('status')).toBeNull();

      setLimits(dayAt(100));
      rerender(
        <UsageLimitBanner key={nextKey()} deploymentId={DEPLOYMENT_ID} />,
      );
      expect(screen.getByText('Daily limit reached.')).toBeTruthy();
    });

    it('reappears for another deployment', async () => {
      const user = userEvent.setup({ delay: null });
      setLimits(dayAt(80));
      const { rerender } = renderBanner('gpt-4o');

      await user.click(screen.getByRole('button'));
      expect(screen.queryByRole('status')).toBeNull();

      rerender(<UsageLimitBanner deploymentId="claude" />);
      expect(screen.getByText('Daily limit 80% used.')).toBeTruthy();
    });

    it('survives a remount, as when moving from the new-chat screen to a conversation', async () => {
      const user = userEvent.setup({ delay: null });
      setLimits(dayAt(80));
      const { unmount } = renderBanner(DEPLOYMENT_ID);

      await user.click(screen.getByRole('button'));
      unmount();
      renderBanner(DEPLOYMENT_ID);

      expect(screen.queryByRole('status')).toBeNull();
    });

    it('dismisses from the keyboard', async () => {
      const user = userEvent.setup({ delay: null });
      setLimits(dayAt(80));
      renderBanner(DEPLOYMENT_ID);

      await user.tab();
      expect(document.activeElement).toBe(screen.getByRole('button'));
      await user.keyboard('{Enter}');

      expect(screen.queryByRole('status')).toBeNull();
    });
  });

  it('refreshes once after a response finishes streaming', () => {
    const { refresh } = setLimits(dayAt(80));
    const { rerender } = render(
      <UsageLimitBanner deploymentId="gpt-4o" isGenerationInProgress />,
    );

    rerender(
      <UsageLimitBanner deploymentId="gpt-4o" isGenerationInProgress={false} />,
    );

    expect(refresh).toHaveBeenCalledOnce();
  });

  it('keeps its content order and roles under dir="rtl"', () => {
    setLimits(dayAt(80));
    render(
      <div dir="rtl">
        <UsageLimitBanner deploymentId="gpt-4o" />
      </div>,
    );

    const banner = screen.getByRole('status');
    const sentence = screen.getByText('Daily limit 80% used.');
    const time = screen.getByText(/^Resets at/);
    expect(
      sentence.compareDocumentPosition(time) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(banner.contains(screen.getByRole('button'))).toBe(true);
  });

  it('sets no fixed width, so it wraps inside the composer on narrow screens', () => {
    setLimits(dayAt(80));
    renderBanner(DEPLOYMENT_ID);

    const banner = screen.getByRole('status');
    expect(banner.className).not.toMatch(/(^|\s)(w|min-w)-\[?\d/);
    expect(banner.style.width).toBe('');
  });
});
