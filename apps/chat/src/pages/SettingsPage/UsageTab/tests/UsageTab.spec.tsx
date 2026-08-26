import { DeploymentItemDtoTypeEnum } from '@epam/ai-dial-chat-api-client';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import type {
  ModelLimitPeriodStatuses,
  ModelLimitRow,
  ModelLimitsLabels,
} from '@epam/ai-dial-usage-dashboard';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsageI18nKeys } from '../../../../constants/translation-keys';
import { useFeatureFlag } from '../../../../context/AppConfigContext';
import { useDeployments } from '../../../../context/DeploymentsContext';
import { useNotification } from '../../../../context/NotificationContext';
import { createDeploymentsContextValue } from '../../../../context/tests/deployments-context-mock';
import { createNotificationContextValue } from '../../../../context/tests/notification-context-mock';
import { useUsageData } from '@epam/ai-dial-chat-hooks';
import UsageTab from '../UsageTab';

const { modelLimitsSectionSpy } = vi.hoisted(() => ({
  modelLimitsSectionSpy: vi.fn(),
}));

vi.mock('../../../../context/AppConfigContext', () => ({
  useFeatureFlag: vi.fn(),
}));

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
    UsageLimitCardGroup: ({ cards }: { cards: { title: string }[] }) => (
      <div>
        {cards.map((card) => (
          <span key={card.title}>{card.title}</span>
        ))}
      </div>
    ),
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
      expect(rows[0].last24Hours.tokens.usedLabel).toBe('1');
      expect(rows[0].last7Days.tokens.kind).toBe('unavailable');
      expect(rows[0].last30Days.tokens.kind).toBe('unavailable');
      expect(labels).toEqual(
        expect.objectContaining({
          last24HoursColumnLabel: UsageI18nKeys.TodayPeriodDescription,
          last7DaysColumnLabel: UsageI18nKeys.ThisWeekPeriodDescription,
          last30DaysColumnLabel: UsageI18nKeys.ThisMonthPeriodDescription,
          tokensLabel: UsageI18nKeys.TokensColumnLabel,
          costLabel: UsageI18nKeys.CostColumnLabel,
        }),
      );
      expect(periodStatuses).toEqual({
        last24Hours: { status: 'unavailable', tooltipLabel: undefined },
        last7Days: { status: 'unavailable', tooltipLabel: undefined },
        last30Days: { status: 'unavailable', tooltipLabel: undefined },
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
      expect(periodStatuses.last24Hours.status).toBe('limit-reached');
      expect(periodStatuses.last7Days.status).toBe('running-low');
      expect(periodStatuses.last30Days.status).toBe('within-limits');
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
});
