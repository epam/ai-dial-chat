import type { DeploymentLimitsResponseDto } from '@epam/ai-dial-chat-api-client';
import {
  type AccountUsage,
  type UseDeploymentUsageLimitsResult,
  useDeploymentUsageLimits,
} from '@epam/ai-dial-chat-hooks';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeployments } from '../../../context/DeploymentsContext';
import { useUiFeature } from '../../../hooks/useUiFeature';
import {
  getDeploymentLimits,
  getDeploymentUsage,
} from '../../../server-api/deployment-limits';
import { getUserUsage } from '../../../server-api/user-limits';
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

vi.mock('@epam/ai-dial-chat-hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-hooks')>()),
  useDeploymentUsageLimits: vi.fn(),
}));

vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: vi.fn(),
}));

vi.mock('../../../server-api/deployment-limits', () => ({
  getDeploymentLimits: vi.fn(),
  getDeploymentUsage: vi.fn(),
}));

vi.mock('../../../server-api/user-limits', () => ({
  getUserUsage: vi.fn(),
}));

vi.mock('../../../hooks/useUiFeature', () => ({
  useUiFeature: vi.fn(() => false),
}));

const mockUseDeploymentUsageLimits = vi.mocked(useDeploymentUsageLimits);
const mockUseDeployments = vi.mocked(useDeployments);
const mockGetDeploymentLimits = vi.mocked(getDeploymentLimits);
const mockGetDeploymentUsage = vi.mocked(getDeploymentUsage);
const mockGetUserUsage = vi.mocked(getUserUsage);
const mockUseUiFeature = vi.mocked(useUiFeature);

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
  dayTokenStats: { used: 80, total: 100 },
  weekTokenStats: { used: 160, total: 200 },
  monthTokenStats: { used: 320, total: 400 },
};

/* A combined fixture: `dto`'s day, week, and month cost stats become the
   account source and the rest the deployment source, as the two endpoints
   return them. */
type HookFixture = Omit<UseDeploymentUsageLimitsResult, 'sources'> & {
  dto?: DeploymentLimitsResponseDto;
};

const COST_KEYS = ['dayCostStats', 'weekCostStats', 'monthCostStats'] as const;

const mockHookResult = ({ dto, ...rest }: HookFixture) => {
  if (dto == null) {
    return mockUseDeploymentUsageLimits.mockReturnValue({
      ...rest,
      sources: { deployment: undefined, account: undefined },
    });
  }
  const deployment: DeploymentLimitsResponseDto = { ...dto };
  const account: AccountUsage = {};
  for (const key of COST_KEYS) {
    account[key] = dto[key];
    delete deployment[key];
  }
  return mockUseDeploymentUsageLimits.mockReturnValue({
    ...rest,
    sources: { deployment, account },
  });
};

const defaultHookResult: HookFixture = {
  dto: threePeriodsDto,
  isLoading: false,
  hasError: false,
  refresh: vi.fn(),
};

/* The footer link is a real `<Link>`, so every case needs a router. */
const renderInRouter = (ui: ReactNode) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

const renderControl = (deploymentId: string | undefined = 'gpt-4o') =>
  renderInRouter(<UsageLimitsControl deploymentId={deploymentId} />);

const openPopover = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button'));
  return screen.getByRole('dialog');
};

describe('UsageLimitsControl', () => {
  beforeEach(() => {
    mockHookResult({
      ...defaultHookResult,
      refresh: vi.fn(),
    });
    mockUseDeployments.mockReturnValue({
      items: [{ id: 'gpt-4o', displayName: DEPLOYMENT_NAME }],
    } as unknown as ReturnType<typeof useDeployments>);
    mockUseUiFeature.mockReturnValue(false);
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
    mockHookResult({
      ...defaultHookResult,
      dto: {
        dayTokenStats: { used: 45000, total: 50000 },
        dayCostStats: { used: 90, total: 100 },
        monthCostStats: { used: 450, total: 500 },
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
    mockHookResult({
      ...defaultHookResult,
      dto: {
        dayTokenStats: { used: 45000, total: 50000 },
        dayCostStats: { used: 90, total: 100 },
      },
    });
    const user = userEvent.setup();
    renderControl();

    await openPopover(user);

    expect(screen.queryByText(/spent/)).toBeNull();
  });

  it('surfaces a stretched account budget while this model is barely used', async () => {
    mockHookResult({
      ...defaultHookResult,
      dto: {
        dayTokenStats: { used: 2, total: 100 },
        weekTokenStats: { used: 2, total: 100 },
        monthTokenStats: { used: 2, total: 100 },
        monthCostStats: { used: 90, total: 100 },
      },
    });
    const user = userEvent.setup();
    renderControl();

    await openPopover(user);

    expect(
      screen.queryByText('conversationInput.usageLimits.tokenGroup'),
    ).toBeNull();
    expect(
      screen.getByText('conversationInput.usageLimits.costGroup'),
    ).toBeTruthy();
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    expect(screen.getByText('90%')).toBeTruthy();
  });

  it('renders nothing when no deployment is selected', () => {
    renderInRouter(<UsageLimitsControl deploymentId={undefined} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders nothing when no period carries a usable limit', () => {
    mockHookResult({
      ...defaultHookResult,
      dto: { minuteTokenStats: { used: 9, total: 10 } },
    });

    renderControl();

    expect(screen.queryByRole('button')).toBeNull();
  });

  describe('trigger', () => {
    it('reports the worst capped period, not the month', () => {
      mockHookResult({
        ...defaultHookResult,
        dto: {
          dayTokenStats: { used: 90, total: 100 },
          monthTokenStats: { used: 80, total: 100 },
        },
      });

      renderControl();

      expect(screen.getByText('90%')).toBeTruthy();
      expect(screen.getByRole('button').getAttribute('aria-label')).toBe(
        TRIGGER_LABEL,
      );
    });

    it('takes the error state when a capped period has reached its limit while the month is low', () => {
      mockHookResult({
        ...defaultHookResult,
        dto: {
          dayTokenStats: { used: 100, total: 100 },
          monthTokenStats: { used: 80, total: 100 },
        },
      });

      renderControl();

      expect(screen.getByRole('button').className).toContain('text-error');
    });

    it('takes the warning state while a capped period is running low', () => {
      mockHookResult({
        ...defaultHookResult,
        dto: { dayTokenStats: { used: 80, total: 100 } },
      });

      renderControl();

      const trigger = screen.getByRole('button');
      expect(trigger.className).toContain('text-warning');
      expect(trigger.className).not.toContain('text-error');
    });

    it('does not render at all while every limit is comfortable', () => {
      mockHookResult({
        ...defaultHookResult,
        dto: {
          dayTokenStats: { used: 2, total: 100 },
          monthCostStats: { used: 1, total: 500 },
        },
      });

      renderControl();

      expect(screen.queryByRole('button')).toBeNull();
    });
  });

  describe('reset line', () => {
    it('shows a reset line for a period that carries one', async () => {
      mockHookResult({
        ...defaultHookResult,
        dto: {
          dayTokenStats: {
            used: 90,
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
      mockHookResult({
        ...defaultHookResult,
        dto: {
          dayTokenStats: { used: 90, total: 100, resetsAt: 'not-a-date' },
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
      mockHookResult({
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
      mockHookResult({
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

    it('links to the Usage tab and dismisses itself on the way there', async () => {
      const user = userEvent.setup();
      renderControl();

      await openPopover(user);
      const link = screen.getByRole('link', {
        name: 'conversationInput.usageLimits.fullUsageLink',
      });
      expect(link.getAttribute('href')).toBe('/settings/usage');

      await user.click(link);

      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('omits the Usage page link when hide-usage-page is on', async () => {
      mockUseUiFeature.mockImplementation(
        (feature) => feature === OverlayFeature.HideUsagePage,
      );
      const user = userEvent.setup();
      renderControl();

      await openPopover(user);

      expect(
        screen.queryByRole('link', {
          name: 'conversationInput.usageLimits.fullUsageLink',
        }),
      ).toBeNull();
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

    it('shifts the panel back inside a narrow viewport instead of clipping it', async () => {
      const user = userEvent.setup();
      /* A 390px phone with the end-anchored 358px panel starting 175px past
         the left edge — the geometry reported in the bug. */
      const clientWidthSpy = vi
        .spyOn(document.documentElement, 'clientWidth', 'get')
        .mockReturnValue(390);
      const rectSpy = vi
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockImplementation(function (this: HTMLElement) {
          if (this.getAttribute('role') !== 'dialog') {
            return new DOMRect();
          }
          const shift = Number(
            /translateX\((-?[\d.]+)px\)/.exec(this.style.transform)?.[1] ?? 0,
          );
          return new DOMRect(-175 + shift, 0, 358, 200);
        });
      renderControl();

      try {
        const dialog = await openPopover(user);

        expect(dialog.style.transform).toBe('translateX(191px)');

        /* A resize re-measures from the anchored position, so the applied
           shift is not compounded. */
        act(() => {
          window.dispatchEvent(new Event('resize'));
        });

        expect(dialog.style.transform).toBe('translateX(191px)');
      } finally {
        clientWidthSpy.mockRestore();
        rectSpy.mockRestore();
      }
    });
  });

  describe('generation lifecycle', () => {
    it('refreshes once when an active generation ends', () => {
      const refresh = vi.fn();
      mockHookResult({
        ...defaultHookResult,
        refresh,
      });

      const { rerender } = renderInRouter(
        <UsageLimitsControl deploymentId="gpt-4o" isGenerationInProgress />,
      );
      rerender(
        <MemoryRouter>
          <UsageLimitsControl
            deploymentId="gpt-4o"
            isGenerationInProgress={false}
          />
        </MemoryRouter>,
      );

      expect(refresh).toHaveBeenCalledOnce();
    });
  });
  describe('usage sources', () => {
    beforeEach(async () => {
      const actual = await vi.importActual<
        typeof import('@epam/ai-dial-chat-hooks')
      >('@epam/ai-dial-chat-hooks');
      mockUseDeploymentUsageLimits.mockImplementation(
        actual.useDeploymentUsageLimits,
      );
    });

    const agentUsage: DeploymentLimitsResponseDto = {
      dayTokenStats: { used: 0, total: 2_000_000 },
      weekCostStats: { used: 130.98, total: Number.MAX_SAFE_INTEGER },
    };

    it('reads the deployment usage and the account usage, never the deployment limits', async () => {
      mockGetDeploymentUsage.mockResolvedValue(agentUsage);
      mockGetUserUsage.mockResolvedValue({
        weekCostStats: { used: 190, total: 200 },
      });
      renderControl('dial-chathub-v2');

      expect(await screen.findByRole('button')).toBeTruthy();
      expect(mockGetDeploymentUsage).toHaveBeenCalledWith('dial-chathub-v2');
      expect(mockGetUserUsage).toHaveBeenCalledOnce();
      expect(mockGetDeploymentLimits).not.toHaveBeenCalled();
    });

    it('renders no trigger for an agent while the account budget is comfortable', async () => {
      mockGetDeploymentUsage.mockResolvedValue(agentUsage);
      mockGetUserUsage.mockResolvedValue({
        weekCostStats: { used: 132.24, total: 200 },
      });
      renderControl('dial-chathub-v2');

      await waitFor(() => expect(mockGetUserUsage).toHaveBeenCalledOnce());
      await act(() => Promise.resolve());

      expect(screen.queryByRole('button')).toBeNull();
    });

    it('keeps the cost rows and announces the error when the deployment usage fails', async () => {
      mockGetDeploymentUsage.mockRejectedValue(new Error('Not Found'));
      mockGetUserUsage.mockResolvedValue({
        dayCostStats: { used: 90, total: 100 },
      });
      const user = userEvent.setup();
      renderControl();

      await screen.findByRole('button');
      await openPopover(user);

      expect(screen.getByText(ERROR_LABEL).getAttribute('aria-live')).toBe(
        'polite',
      );
      expect(screen.getAllByRole('progressbar')).toHaveLength(1);
      expect(
        screen.getByText('conversationInput.usageLimits.costGroup'),
      ).toBeTruthy();
    });
  });
});
