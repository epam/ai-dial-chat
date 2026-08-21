import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsageI18nKeys } from '../../../../constants/translation-keys';
import { useFeatureFlag } from '../../../../context/AppConfigContext';
import { useNotification } from '../../../../context/NotificationContext';
import { createNotificationContextValue } from '../../../../context/tests/notification-context-mock';
import { useUsageData } from '../../../../hooks/useUsageData';
import UsageTab from '../UsageTab';

vi.mock('../../../../context/AppConfigContext', () => ({
  useFeatureFlag: vi.fn(),
}));

vi.mock('../../../../context/NotificationContext', () => ({
  useNotification: vi.fn(),
}));

vi.mock('../../../../hooks/useUsageData', () => ({
  useUsageData: vi.fn(),
}));

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
  };
});

const mockUseFeatureFlag = vi.mocked(useFeatureFlag);
const mockUseNotification = vi.mocked(useNotification);
const mockUseUsageData = vi.mocked(useUsageData);
const showNotification = vi.fn();

const usableStats = { used: 1, total: 10 };

describe('UsageTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFeatureFlag.mockReturnValue(true);
    mockUseNotification.mockReturnValue(
      createNotificationContextValue(showNotification),
    );
  });

  it('renders the page header and a loading announcement, but no cards, while loading', () => {
    mockUseUsageData.mockReturnValue({
      limits: undefined,
      usage: undefined,
      isLoading: true,
      limitsError: undefined,
      usageError: undefined,
    });

    render(<UsageTab />);

    expect(
      screen.getByRole('heading', { name: UsageI18nKeys.PageTitle }),
    ).toBeTruthy();
    expect(screen.getByText(UsageI18nKeys.PageDescription)).toBeTruthy();
    expect(screen.queryByText(UsageI18nKeys.TodayTitle)).toBeNull();
    expect(screen.queryByText(UsageI18nKeys.ThisWeekTitle)).toBeNull();
    expect(screen.queryByText(UsageI18nKeys.ThisMonthTitle)).toBeNull();
  });

  it('renders the page header and all three cards once all stats resolve', () => {
    mockUseUsageData.mockReturnValue({
      limits: {
        deployments: {},
        dayCostStats: usableStats,
        weekCostStats: usableStats,
        monthCostStats: usableStats,
      },
      usage: undefined,
      isLoading: false,
      limitsError: undefined,
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
      limits: { deployments: {}, dayCostStats: usableStats },
      usage: { deployments: {} },
      isLoading: false,
      limitsError: undefined,
      usageError: undefined,
    });

    render(<UsageTab />);

    expect(screen.getByText(UsageI18nKeys.TodayTitle)).toBeTruthy();
    expect(screen.queryByText(UsageI18nKeys.ThisWeekTitle)).toBeNull();
    expect(screen.queryByText(UsageI18nKeys.ThisMonthTitle)).toBeNull();
  });

  it('shows one partial-failure notification and still renders the successful data when only one endpoint fails', () => {
    mockUseUsageData.mockReturnValue({
      limits: {
        deployments: {},
        dayCostStats: usableStats,
        weekCostStats: usableStats,
        monthCostStats: usableStats,
      },
      usage: undefined,
      isLoading: false,
      limitsError: undefined,
      usageError: new Error('usage down'),
    });

    render(<UsageTab />);

    expect(screen.getByText(UsageI18nKeys.TodayTitle)).toBeTruthy();
    expect(screen.getByText(UsageI18nKeys.ThisWeekTitle)).toBeTruthy();
    expect(screen.getByText(UsageI18nKeys.ThisMonthTitle)).toBeTruthy();
    expect(showNotification).toHaveBeenCalledOnce();
    expect(showNotification).toHaveBeenCalledWith(
      expect.objectContaining({ variant: NotificationVariant.Error }),
    );
    const [[{ message }]] = showNotification.mock.calls;
    expect(message).not.toContain('usage down');
  });

  it('shows one consolidated notification, not two, when both endpoints fail', () => {
    mockUseUsageData.mockReturnValue({
      limits: undefined,
      usage: undefined,
      isLoading: false,
      limitsError: new Error('limits down'),
      usageError: new Error('usage down'),
    });

    render(<UsageTab />);

    expect(screen.queryByText(UsageI18nKeys.TodayTitle)).toBeNull();
    expect(showNotification).toHaveBeenCalledOnce();
  });

  it('does not repeat the notification on a re-render with the same errors', () => {
    mockUseUsageData.mockReturnValue({
      limits: undefined,
      usage: undefined,
      isLoading: false,
      limitsError: new Error('limits down'),
      usageError: undefined,
    });

    const { rerender } = render(<UsageTab />);
    rerender(<UsageTab />);

    expect(showNotification).toHaveBeenCalledOnce();
  });
});
