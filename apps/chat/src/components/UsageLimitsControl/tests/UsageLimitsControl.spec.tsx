import type { DeploymentLimitsResponseDto } from '@epam/ai-dial-chat-api-client';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeployments } from '../../../context/DeploymentsContext';
import { useDeploymentUsageLimits } from '../../../hooks/useDeploymentUsageLimits';
import type { UseDeploymentUsageLimitsResult } from '../../../hooks/useDeploymentUsageLimits';
import UsageLimitsControl from '../UsageLimitsControl';

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();

  return {
    ...actual,
    ProgressBar: ({
      value,
      max,
      'aria-label': ariaLabel,
      'aria-valuetext': ariaValueText,
    }: {
      value: number;
      max: number;
      'aria-label'?: string;
      'aria-valuetext'?: string;
    }) => (
      <div
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuenow={value}
        aria-valuemax={max}
        aria-valuetext={ariaValueText}
      />
    ),
  };
});

vi.mock('../../../hooks/useDeploymentUsageLimits', () => ({
  useDeploymentUsageLimits: vi.fn(),
}));

vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: vi.fn(),
}));

const mockUseDeploymentUsageLimits = vi.mocked(useDeploymentUsageLimits);
const mockUseDeployments = vi.mocked(useDeployments);

const DEPLOYMENT_NAME = 'GPT-4o mini';

/* The global `react-i18next` mock returns each key verbatim, so period rows are
   identified by their key rather than by translated English. */
const DAY_LABEL = 'conversationInput.usageLimits.periodDay';
const WEEK_LABEL = 'conversationInput.usageLimits.periodWeek';
const MONTH_LABEL = 'conversationInput.usageLimits.periodMonth';
const RESET_LABEL = 'usage.resetsAtLabel';
const ERROR_LABEL = 'conversationInput.usageLimits.error';
const TITLE_LABEL = 'conversationInput.usageLimits.popoverTitle';
const TRIGGER_LABEL = 'conversationInput.usageLimits.triggerAriaLabel';

const threePeriodsDto: DeploymentLimitsResponseDto = {
  dayTokenStats: { used: 20, total: 100 },
  weekTokenStats: { used: 30, total: 200 },
  monthTokenStats: { used: 40, total: 400 },
};

const defaultHookResult: UseDeploymentUsageLimitsResult = {
  limitsDto: threePeriodsDto,
  isLoading: false,
  hasError: false,
  refresh: vi.fn(),
};

const renderControl = (deploymentId: string | undefined = 'gpt-4o') =>
  render(<UsageLimitsControl deploymentId={deploymentId} />);

const openPopover = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button'));
  return screen.getByRole('dialog');
};

describe('UsageLimitsControl', () => {
  beforeEach(() => {
    mockUseDeploymentUsageLimits.mockReturnValue({
      ...defaultHookResult,
      refresh: vi.fn(),
    });
    mockUseDeployments.mockReturnValue({
      items: [{ id: 'gpt-4o', displayName: DEPLOYMENT_NAME }],
    } as unknown as ReturnType<typeof useDeployments>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders one row per configured period', async () => {
    const user = userEvent.setup();
    renderControl();

    await openPopover(user);

    expect(screen.getByText(DAY_LABEL)).toBeTruthy();
    expect(screen.getByText(WEEK_LABEL)).toBeTruthy();
    expect(screen.getByText(MONTH_LABEL)).toBeTruthy();
    expect(screen.getAllByRole('progressbar')).toHaveLength(3);
  });

  it('lists the account-wide cost budget as a second group', async () => {
    mockUseDeploymentUsageLimits.mockReturnValue({
      ...defaultHookResult,
      limitsDto: {
        dayTokenStats: { used: 36494, total: 50000 },
        dayCostStats: { used: 0.0440118, total: 100 },
        monthCostStats: { used: 0.0796718, total: 500 },
      },
    });
    const user = userEvent.setup();
    renderControl();

    await openPopover(user);

    expect(
      screen.getByText('conversationInput.usageLimits.tokenGroup'),
    ).toBeTruthy();
    expect(
      screen.getByText('conversationInput.usageLimits.costGroup'),
    ).toBeTruthy();
    /* One token row plus two cost rows. The figures themselves go through `t()`,
       which the global i18n mock returns as the key, so the currency formatting
       is asserted in the mapper's own spec instead. */
    expect(screen.getAllByRole('progressbar')).toHaveLength(3);
    expect(screen.getAllByText(DAY_LABEL)).toHaveLength(2);
  });

  it('shows no spend caption on a token row, the cost counter spanning every agent', async () => {
    mockUseDeploymentUsageLimits.mockReturnValue({
      ...defaultHookResult,
      limitsDto: {
        dayTokenStats: { used: 36494, total: 50000 },
        dayCostStats: { used: 0.0440118, total: 100 },
      },
    });
    const user = userEvent.setup();
    renderControl();

    await openPopover(user);

    expect(screen.queryByText(/spent/)).toBeNull();
  });

  it('renders nothing when no deployment is selected', () => {
    render(<UsageLimitsControl deploymentId={undefined} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders nothing when no period carries a usable limit', () => {
    mockUseDeploymentUsageLimits.mockReturnValue({
      ...defaultHookResult,
      limitsDto: { minuteTokenStats: { used: 1, total: 10 } },
    });

    renderControl();

    expect(screen.queryByRole('button')).toBeNull();
  });

  describe('trigger', () => {
    it('reports the worst capped period, not the month', () => {
      mockUseDeploymentUsageLimits.mockReturnValue({
        ...defaultHookResult,
        limitsDto: {
          dayTokenStats: { used: 90, total: 100 },
          monthTokenStats: { used: 10, total: 100 },
        },
      });

      renderControl();

      expect(screen.getByText('90%')).toBeTruthy();
      expect(screen.getByRole('button').getAttribute('aria-label')).toBe(
        TRIGGER_LABEL,
      );
    });

    it('takes the error state when a capped period has reached its limit while the month is low', () => {
      mockUseDeploymentUsageLimits.mockReturnValue({
        ...defaultHookResult,
        limitsDto: {
          dayTokenStats: { used: 100, total: 100 },
          monthTokenStats: { used: 10, total: 100 },
        },
      });

      renderControl();

      expect(screen.getByRole('button').className).toContain('text-error');
    });

    it('takes the warning state while a capped period is running low', () => {
      mockUseDeploymentUsageLimits.mockReturnValue({
        ...defaultHookResult,
        limitsDto: { dayTokenStats: { used: 80, total: 100 } },
      });

      renderControl();

      const trigger = screen.getByRole('button');
      expect(trigger.className).toContain('text-warning');
      expect(trigger.className).not.toContain('text-error');
    });

    it('stays neutral while every capped period is comfortable', () => {
      renderControl();

      const trigger = screen.getByRole('button');
      expect(trigger.className).toContain('text-secondary');
      expect(trigger.className).not.toContain('text-error');
    });
  });

  describe('reset line', () => {
    it('shows a reset line for a period that carries one', async () => {
      mockUseDeploymentUsageLimits.mockReturnValue({
        ...defaultHookResult,
        limitsDto: {
          dayTokenStats: {
            used: 20,
            total: 100,
            resetsAt: '2026-09-16T00:00:00Z',
          },
        },
      });
      const user = userEvent.setup();
      renderControl();

      await openPopover(user);

      const time = screen.getByText(RESET_LABEL);
      expect(time.tagName).toBe('TIME');
      expect(time.getAttribute('dateTime')).toBe('2026-09-16T00:00:00Z');
    });

    it('shows no reset line for a period that carries none', async () => {
      const user = userEvent.setup();
      renderControl();

      await openPopover(user);

      expect(screen.queryByText(RESET_LABEL)).toBeNull();
      expect(screen.getAllByRole('progressbar')).toHaveLength(3);
    });

    it('renders the rows unchanged when the timestamp cannot be parsed', async () => {
      mockUseDeploymentUsageLimits.mockReturnValue({
        ...defaultHookResult,
        limitsDto: {
          dayTokenStats: { used: 20, total: 100, resetsAt: 'not-a-date' },
        },
      });
      const user = userEvent.setup();
      renderControl();

      await openPopover(user);

      expect(screen.queryByText(RESET_LABEL)).toBeNull();
      expect(screen.getByRole('progressbar')).toBeTruthy();
      expect(screen.getByText(DAY_LABEL)).toBeTruthy();
    });
  });

  describe('popover', () => {
    it('refreshes limits when opened', async () => {
      const refresh = vi.fn();
      mockUseDeploymentUsageLimits.mockReturnValue({
        ...defaultHookResult,
        refresh,
      });
      const user = userEvent.setup();
      renderControl();

      await openPopover(user);

      expect(refresh).toHaveBeenCalledOnce();
    });

    it('closes and returns focus to the trigger on Escape', async () => {
      const user = userEvent.setup();
      renderControl();
      const trigger = screen.getByRole('button');

      await openPopover(user);
      await user.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(trigger.matches(':focus')).toBe(true);
    });

    it('announces a failed refresh politely while keeping the rows visible', async () => {
      mockUseDeploymentUsageLimits.mockReturnValue({
        ...defaultHookResult,
        hasError: true,
      });
      const user = userEvent.setup();
      renderControl();

      await openPopover(user);

      const error = screen.getByText(ERROR_LABEL);
      expect(error.getAttribute('aria-live')).toBe('polite');
      expect(screen.getAllByRole('progressbar')).toHaveLength(3);
    });

    it('titles the popover with the selected deployment and labels the dialog with it', async () => {
      const user = userEvent.setup();
      renderControl();

      const dialog = await openPopover(user);

      expect(screen.getByText(DEPLOYMENT_NAME).id).toBe(
        dialog.getAttribute('aria-labelledby'),
      );
    });

    it('falls back to the generic title when the deployment is not in the list', async () => {
      mockUseDeployments.mockReturnValue({ items: [] } as unknown as ReturnType<
        typeof useDeployments
      >);
      const user = userEvent.setup();
      renderControl();

      const dialog = await openPopover(user);

      expect(screen.getByText(TITLE_LABEL).id).toBe(
        dialog.getAttribute('aria-labelledby'),
      );
    });

    it('anchors the panel with logical properties so it flips under RTL', async () => {
      const user = userEvent.setup();
      document.documentElement.setAttribute('dir', 'rtl');
      renderControl();

      try {
        const dialog = await openPopover(user);

        expect(dialog.className).toContain('end-0');
        expect(dialog.className).not.toMatch(/(^|\s)(left|right)-/);
      } finally {
        document.documentElement.removeAttribute('dir');
      }
    });
  });

  describe('generation lifecycle', () => {
    it('refreshes once when an active generation ends', () => {
      const refresh = vi.fn();
      mockUseDeploymentUsageLimits.mockReturnValue({
        ...defaultHookResult,
        refresh,
      });

      const { rerender } = render(
        <UsageLimitsControl deploymentId="gpt-4o" isGenerationInProgress />,
      );
      rerender(
        <UsageLimitsControl
          deploymentId="gpt-4o"
          isGenerationInProgress={false}
        />,
      );

      expect(refresh).toHaveBeenCalledOnce();
    });
  });
});
