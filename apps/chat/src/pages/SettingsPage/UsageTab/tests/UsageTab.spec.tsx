import { DeploymentItemDtoTypeEnum } from '@epam/ai-dial-chat-api-client';
import { useUsageData } from '@epam/ai-dial-chat-hooks';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import type {
  ModelLimitPeriodStatuses,
  ModelLimitRow,
  ModelLimitsLabels,
} from '@epam/ai-dial-usage-dashboard';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UsageI18nKeys } from '../../../../constants/translation-keys';
import { useFeatureFlag } from '../../../../context/AppConfigContext';
import { useDeployments } from '../../../../context/DeploymentsContext';
import { useNotification } from '../../../../context/NotificationContext';
import { createDeploymentsContextValue } from '../../../../context/tests/deployments-context-mock';
import { createNotificationContextValue } from '../../../../context/tests/notification-context-mock';
import UsageTab from '../UsageTab';

const { modelLimitsSectionSpy, cardGroupSpy } = vi.hoisted(() => ({
  modelLimitsSectionSpy: vi.fn(),
  cardGroupSpy: vi.fn(),
}));

/*
 * Overrides the global test-setup mock, which returns the bare key. Reset
 * labels are only distinguishable once `{{dateTime}}` is interpolated, and
 * every other key in this file still resolves to its own name.
 */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params?.dateTime != null ? `${key}|${params.dateTime}` : key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

vi.mock(
  '../../../../context/AppConfigContext',
  async () => import('../../../../context/tests/app-config-context-mock'),
);

vi.mock('../../../../context/DeploymentsContext', () => ({
  useDeployments: vi.fn(),
}));

vi.mock('../../../../context/NotificationContext', () => ({
  useNotification: vi.fn(),
}));

vi.mock('@epam/ai-dial-chat-hooks', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-hooks')>();
  return {
    ...actual,
    useUsageData: vi.fn(),
  };
});

vi.mock('@epam/ai-dial-usage-dashboard', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-usage-dashboard')>();
  return {
    ...actual,
    UsageLimitCardGroup: ({
      cards,
    }: {
      cards: { title: string; resetLabel?: string }[];
    }) => {
      cardGroupSpy({ cards });
      return (
        <div>
          {cards.map((card) => (
            <span key={card.title}>
              {card.title}
              {card.resetLabel != null && <em>{card.resetLabel}</em>}
            </span>
          ))}
        </div>
      );
    },
    ModelLimitsSection: ({
      rows,
      labels,
      periodStatuses,
    }: {
      rows: ModelLimitRow[];
      labels: ModelLimitsLabels;
      periodStatuses: ModelLimitPeriodStatuses;
    }) => {
      modelLimitsSectionSpy({ rows, labels, periodStatuses });
      return (
        <div>
          {rows.length === 0 ? (
            <span>{labels.emptyStateLabel}</span>
          ) : (
            rows.map((row) => <span key={row.id}>{row.name}</span>)
          )}
        </div>
      );
    },
  };
});

const mockUseFeatureFlag = vi.mocked(useFeatureFlag);
const mockUseDeployments = vi.mocked(useDeployments);
const mockUseNotification = vi.mocked(useNotification);
const mockUseUsageData = vi.mocked(useUsageData);
const showNotification = vi.fn();

const usableStats = { used: 1, total: 10 };

describe('UsageTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFeatureFlag.mockReturnValue(true);
    mockUseDeployments.mockReturnValue(createDeploymentsContextValue());
    mockUseNotification.mockReturnValue(
      createNotificationContextValue(showNotification),
    );
  });

  it('renders a visible loader, but no cards, while usage is loading', () => {
    mockUseUsageData.mockReturnValue({
      usage: undefined,
      isLoading: true,
      usageError: undefined,
    });

    render(<UsageTab />);

    expect(
      screen.getByRole('heading', { name: UsageI18nKeys.PageTitle }),
    ).toBeTruthy();
    expect(screen.getByText(UsageI18nKeys.PageDescription)).toBeTruthy();
    expect(
      screen.getByRole('img', { name: UsageI18nKeys.Loading }),
    ).toBeTruthy();
    expect(screen.queryByText(UsageI18nKeys.TodayTitle)).toBeNull();
    expect(screen.queryByText(UsageI18nKeys.ThisWeekTitle)).toBeNull();
    expect(screen.queryByText(UsageI18nKeys.ThisMonthTitle)).toBeNull();
  });

  it('renders a visible loader, but no dashboard content, while deployments are loading', () => {
    mockUseDeployments.mockReturnValue(
      createDeploymentsContextValue({ isLoading: true }),
    );
    mockUseUsageData.mockReturnValue({
      usage: {
        deployments: {},
        dayCostStats: usableStats,
      },
      isLoading: false,
      usageError: undefined,
    });

    render(<UsageTab />);

    expect(
      screen.getByRole('img', { name: UsageI18nKeys.Loading }),
    ).toBeTruthy();
    expect(screen.queryByText(UsageI18nKeys.TodayTitle)).toBeNull();
    expect(screen.queryByText(UsageI18nKeys.ModelLimitsEmptyState)).toBeNull();
  });

  it('renders the page header and all three cards once all stats resolve', () => {
    mockUseUsageData.mockReturnValue({
      usage: {
        deployments: {},
        dayCostStats: usableStats,
        weekCostStats: usableStats,
        monthCostStats: usableStats,
      },
      isLoading: false,
      usageError: undefined,
    });

    render(<UsageTab />);

    expect(
      screen.getByRole('heading', { name: UsageI18nKeys.PageTitle }),
    ).toBeTruthy();
    expect(screen.getByText(UsageI18nKeys.TodayTitle)).toBeTruthy();
    expect(screen.getByText(UsageI18nKeys.ThisWeekTitle)).toBeTruthy();
    expect(screen.getByText(UsageI18nKeys.ThisMonthTitle)).toBeTruthy();
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('renders only the available cards when other stats are missing', () => {
    mockUseUsageData.mockReturnValue({
      usage: { deployments: {}, dayCostStats: usableStats },
      isLoading: false,
      usageError: undefined,
    });

    render(<UsageTab />);

    expect(screen.getByText(UsageI18nKeys.TodayTitle)).toBeTruthy();
    expect(screen.queryByText(UsageI18nKeys.ThisWeekTitle)).toBeNull();
    expect(screen.queryByText(UsageI18nKeys.ThisMonthTitle)).toBeNull();
  });

  it('shows an error notification and no cards when the fetch fails', () => {
    mockUseUsageData.mockReturnValue({
      usage: undefined,
      isLoading: false,
      usageError: new Error('usage down'),
    });

    render(<UsageTab />);

    expect(screen.queryByText(UsageI18nKeys.TodayTitle)).toBeNull();
    expect(showNotification).toHaveBeenCalledOnce();
    expect(showNotification).toHaveBeenCalledWith(
      expect.objectContaining({ variant: NotificationVariant.Error }),
    );
    const [[{ message }]] = showNotification.mock.calls;
    expect(message).not.toContain('usage down');
  });

  it('does not repeat the notification on a re-render with the same error', () => {
    mockUseUsageData.mockReturnValue({
      usage: undefined,
      isLoading: false,
      usageError: new Error('usage down'),
    });

    const { rerender } = render(<UsageTab />);
    rerender(<UsageTab />);

    expect(showNotification).toHaveBeenCalledOnce();
  });

  describe('Model limits section', () => {
    it('renders one row per accessible model below the aggregate cards', () => {
      mockUseDeployments.mockReturnValue(
        createDeploymentsContextValue({
          items: [
            {
              id: 'gpt-4o',
              displayName: 'GPT-4o',
              type: DeploymentItemDtoTypeEnum.Model,
            },
            {
              id: 'claude-3',
              displayName: 'Claude 3',
              type: DeploymentItemDtoTypeEnum.Model,
            },
          ],
        }),
      );
      mockUseUsageData.mockReturnValue({
        usage: {
          deployments: {
            'gpt-4o': { dayTokenStats: usableStats },
            'claude-3': { dayTokenStats: usableStats },
          },
        },
        isLoading: false,
        usageError: undefined,
      });

      render(<UsageTab />);

      expect(screen.getByText('GPT-4o')).toBeTruthy();
      expect(screen.getByText('Claude 3')).toBeTruthy();

      const { rows, labels, periodStatuses } = modelLimitsSectionSpy.mock
        .lastCall?.[0] as {
        rows: ModelLimitRow[];
        labels: ModelLimitsLabels;
        periodStatuses: ModelLimitPeriodStatuses;
      };
      expect(rows[0].day.tokens.usedLabel).toBe('1');
      expect(rows[0].week.tokens.kind).toBe('unavailable');
      expect(rows[0].month.tokens.kind).toBe('unavailable');
      expect(labels).toEqual(
        expect.objectContaining({
          dayColumnLabel: UsageI18nKeys.TodayPeriodDescription,
          weekColumnLabel: UsageI18nKeys.ThisWeekPeriodDescription,
          monthColumnLabel: UsageI18nKeys.ThisMonthPeriodDescription,
          tokensLabel: UsageI18nKeys.TokensColumnLabel,
          costLabel: UsageI18nKeys.CostColumnLabel,
        }),
      );
      expect(periodStatuses).toEqual({
        day: { status: 'unavailable', tooltipLabel: undefined },
        week: { status: 'unavailable', tooltipLabel: undefined },
        month: { status: 'unavailable', tooltipLabel: undefined },
      });
      expect(modelLimitsSectionSpy.mock.lastCall?.[0]).not.toHaveProperty(
        'period',
      );
      expect(modelLimitsSectionSpy.mock.lastCall?.[0]).not.toHaveProperty(
        'onPeriodChange',
      );
    });

    it('passes overall Cost statuses from the aggregate-card budgets', () => {
      mockUseUsageData.mockReturnValue({
        usage: {
          deployments: {},
          dayCostStats: { used: 10, total: 10 },
          weekCostStats: { used: 8, total: 10 },
          monthCostStats: { used: 1, total: 10 },
        },
        isLoading: false,
        usageError: undefined,
      });

      render(<UsageTab />);

      const { periodStatuses } = modelLimitsSectionSpy.mock.lastCall?.[0] as {
        periodStatuses: ModelLimitPeriodStatuses;
      };
      expect(periodStatuses.day.status).toBe('limit-reached');
      expect(periodStatuses.week.status).toBe('running-low');
      expect(periodStatuses.month.status).toBe('within-limits');
    });

    it('shows an empty state instead of an empty table when `usage.deployments` is empty', () => {
      mockUseUsageData.mockReturnValue({
        usage: { deployments: {} },
        isLoading: false,
        usageError: undefined,
      });

      render(<UsageTab />);

      expect(
        screen.getByText(UsageI18nKeys.ModelLimitsEmptyState),
      ).toBeTruthy();
    });

    it('shows the same empty state when every deployment has no usage in displayed periods', () => {
      mockUseDeployments.mockReturnValue(
        createDeploymentsContextValue({
          items: [
            {
              id: 'gpt-4o',
              displayName: 'GPT-4o',
              type: DeploymentItemDtoTypeEnum.Model,
            },
          ],
        }),
      );
      mockUseUsageData.mockReturnValue({
        usage: {
          deployments: {
            'gpt-4o': { dayTokenStats: { used: 0, total: 10 } },
          },
        },
        isLoading: false,
        usageError: undefined,
      });

      render(<UsageTab />);

      expect(screen.queryByText('GPT-4o')).toBeNull();
      expect(
        screen.getByText(UsageI18nKeys.ModelLimitsEmptyState),
      ).toBeTruthy();
    });

    it('shows an empty state, not a stale table, when the usage fetch failed', () => {
      mockUseUsageData.mockReturnValue({
        usage: undefined,
        isLoading: false,
        usageError: new Error('usage down'),
      });

      render(<UsageTab />);

      expect(
        screen.getByText(UsageI18nKeys.ModelLimitsEmptyState),
      ).toBeTruthy();
      // Still exactly one notification — the model-limits section does not add its own.
      expect(showNotification).toHaveBeenCalledOnce();
    });
  });

  describe('boundary re-fetch', () => {
    /* Reset boundaries as captured from a real GET /api/v1/user/usage payload. */
    const DAY_RESETS_AT = '2026-09-16T00:00:00Z';
    const MONTH_RESETS_AT = '2026-10-01T00:00:00Z';
    /* A moment shortly before the day boundary above. */
    const NOW = Date.parse('2026-09-15T21:00:00Z');

    const usageWithReset = (resetsAt: string, used = 1) => ({
      deployments: {},
      dayCostStats: { used, total: 10, resetsAt },
    });

    /* Every distinct refreshToken the hook was handed, in order. */
    const refreshTokens = () => [
      ...new Set(mockUseUsageData.mock.calls.map((call) => call[2])),
    ];

    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: false });
      vi.setSystemTime(NOW);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('re-fetches exactly once when the boundary elapses', () => {
      mockUseUsageData.mockReturnValue({
        usage: usageWithReset(DAY_RESETS_AT),
        isLoading: false,
        usageError: undefined,
      });

      render(<UsageTab />);

      expect(refreshTokens()).toEqual([0]);

      act(() => {
        vi.advanceTimersByTime(Date.parse(DAY_RESETS_AT) - NOW + 10_000);
      });

      expect(refreshTokens()).toEqual([0, 1]);
    });

    it('does not fire immediately for a boundary beyond the setTimeout ceiling', () => {
      /*
       * `setTimeout`'s ceiling is ~24.8 days, so the clamp is only reachable
       * from near the start of a long month — 1 Sep to 1 Oct is 30 days.
       */
      const monthStart = Date.parse('2026-09-01T00:00:00Z');
      vi.setSystemTime(monthStart);
      expect(Date.parse(MONTH_RESETS_AT) - monthStart).toBeGreaterThan(
        2 ** 31 - 1,
      );

      mockUseUsageData.mockReturnValue({
        usage: {
          deployments: {},
          monthCostStats: { used: 1, total: 10, resetsAt: MONTH_RESETS_AT },
        },
        isLoading: false,
        usageError: undefined,
      });

      render(<UsageTab />);

      act(() => {
        vi.advanceTimersByTime(2 ** 31 - 1);
      });

      /* The clamped wake re-arms rather than re-fetching. */
      expect(refreshTokens()).toEqual([0]);

      act(() => {
        vi.advanceTimersByTime(
          Date.parse(MONTH_RESETS_AT) - monthStart - (2 ** 31 - 1) + 10_000,
        );
      });

      expect(refreshTokens()).toEqual([0, 1]);
    });

    it('re-fetches on visibilitychange after a missed boundary', () => {
      mockUseUsageData.mockReturnValue({
        usage: usageWithReset(DAY_RESETS_AT),
        isLoading: false,
        usageError: undefined,
      });

      render(<UsageTab />);
      expect(refreshTokens()).toEqual([0]);

      /* Jump past the boundary without letting the timer run, as a suspended device would. */
      vi.setSystemTime(Date.parse(DAY_RESETS_AT) + 60_000);

      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(refreshTokens()).toEqual([0, 1]);
    });

    it('arms no timer when no card carries a future boundary', () => {
      mockUseUsageData.mockReturnValue({
        /* Already past at NOW. */
        usage: usageWithReset('2026-09-01T00:00:00Z'),
        isLoading: false,
        usageError: undefined,
      });

      render(<UsageTab />);

      expect(vi.getTimerCount()).toBe(0);

      act(() => {
        vi.advanceTimersByTime(2 ** 31 - 1);
      });

      expect(refreshTokens()).toEqual([0]);
    });

    it('does not re-show the full-tab spinner while a refresh is in flight', () => {
      mockUseUsageData.mockReturnValue({
        usage: usageWithReset(DAY_RESETS_AT, 7),
        /* A refresh is in flight, but previous figures are still present. */
        isLoading: true,
        usageError: undefined,
      });

      render(<UsageTab />);

      expect(
        screen.queryByRole('img', { name: UsageI18nKeys.Loading }),
      ).toBeNull();
      expect(screen.getByText(UsageI18nKeys.TodayTitle)).toBeTruthy();
    });

    it('keeps the rendered figures and raises the notification when a refresh fails', () => {
      mockUseUsageData.mockReturnValue({
        usage: usageWithReset(DAY_RESETS_AT, 7),
        isLoading: false,
        usageError: new Error('refresh failed'),
      });

      render(<UsageTab />);

      expect(screen.getByText(UsageI18nKeys.TodayTitle)).toBeTruthy();
      const [{ cards }] = cardGroupSpy.mock.calls.at(-1) as [
        { cards: { used: number }[] },
      ];
      expect(cards[0].used).toBe(7);
      expect(showNotification).toHaveBeenCalledOnce();
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ variant: NotificationVariant.Error }),
      );
    });
  });

  describe('reset-time localization', () => {
    const DAY_RESETS_AT = '2026-09-16T00:00:00Z';
    const OriginalDateTimeFormat = Intl.DateTimeFormat;

    /*
     * Only the zero-argument zone-resolution call is stubbed; the real
     * formatter still does the formatting, in the zone under test.
     */
    const mockResolvedZone = (timeZone: string) => {
      vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function (
        locales?: string | string[],
        options?: Intl.DateTimeFormatOptions,
      ) {
        if (locales === undefined && options === undefined) {
          return { resolvedOptions: () => ({ timeZone }) };
        }
        return new OriginalDateTimeFormat(locales, options);
      } as unknown as typeof Intl.DateTimeFormat);
    };

    const resetLabelInZone = (timeZone: string): string => {
      mockResolvedZone(timeZone);
      mockUseUsageData.mockReturnValue({
        usage: {
          deployments: {},
          dayCostStats: { used: 1, total: 10, resetsAt: DAY_RESETS_AT },
        },
        isLoading: false,
        usageError: undefined,
      });

      const { unmount } = render(<UsageTab />);
      const [{ cards }] = cardGroupSpy.mock.calls.at(-1) as [
        { cards: { resetLabel?: string; resetIsoValue?: string }[] },
      ];
      const { resetLabel, resetIsoValue } = cards[0];

      expect(resetIsoValue).toBe(DAY_RESETS_AT);
      unmount();
      vi.restoreAllMocks();

      return resetLabel ?? '';
    };

    it('renders the same UTC boundary differently in two timezones, each with its own designator', () => {
      const warsawLabel = resetLabelInZone('Europe/Warsaw');
      const tokyoLabel = resetLabelInZone('Asia/Tokyo');

      expect(warsawLabel).toContain('2:00');
      expect(warsawLabel).toContain('GMT+2');
      expect(tokyoLabel).toContain('9:00');
      expect(tokyoLabel).toContain('GMT+9');
      expect(warsawLabel).not.toBe(tokyoLabel);
    });
  });
});
