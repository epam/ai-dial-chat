import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeploymentUsageLimits } from '../../../hooks/useDeploymentUsageLimits';
import type { UseDeploymentUsageLimitsResult } from '../../../hooks/useDeploymentUsageLimits';
import type { MonthlyUsageLimit } from '../../../utils/map-deployment-limits-to-input';
import UsageLimitsControl from '../UsageLimitsControl';
import type { UsageLimitsLabels } from '../UsageLimitsControl';

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();

  return {
    ...actual,
    ProgressBar: ({
      value,
      max,
      'aria-label': ariaLabel,
    }: {
      value: number;
      max: number;
      'aria-label': string;
    }) => (
      <div
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuenow={value}
        aria-valuemax={max}
      />
    ),
  };
});

vi.mock('../../../hooks/useDeploymentUsageLimits', () => ({
  useDeploymentUsageLimits: vi.fn(),
}));

const mockUseDeploymentUsageLimits = vi.mocked(useDeploymentUsageLimits);

const labels: UsageLimitsLabels = {
  triggerAriaLabel: ({ value }) => `Monthly token usage: ${value}`,
  popoverTitle: 'Usage Limit',
  error: 'Could not load usage limits',
  tokensRemaining: ({ count }) => `${count} tokens remaining`,
  progressAriaLabel: ({ used, total }) =>
    `Monthly token usage: ${used} of ${total} tokens used`,
};

const defaultLimit: MonthlyUsageLimit = {
  used: 2500,
  total: 10000,
  remaining: 7500,
  usedPercent: 25,
};

const defaultHookResult: UseDeploymentUsageLimitsResult = {
  limit: defaultLimit,
  isLoading: false,
  hasError: false,
  refresh: vi.fn(),
};

const renderControl = (deploymentId: string | undefined) =>
  render(<UsageLimitsControl deploymentId={deploymentId} labels={labels} />);

describe('UsageLimitsControl', () => {
  beforeEach(() => {
    mockUseDeploymentUsageLimits.mockReturnValue({
      ...defaultHookResult,
      refresh: vi.fn(),
    });
  });

  afterEach(() => {
    document.documentElement.dir = '';
    vi.clearAllMocks();
  });

  it('renders nothing without a deployment or monthly limit', () => {
    const { container, rerender } = renderControl(undefined);
    expect(container.firstChild).toBeNull();

    mockUseDeploymentUsageLimits.mockReturnValue({
      ...defaultHookResult,
      limit: undefined,
    });
    rerender(<UsageLimitsControl deploymentId="gpt-4o" labels={labels} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows a ring-only trigger at rest with an accessible percentage', () => {
    renderControl('gpt-4o');

    const trigger = screen.getByRole('button', {
      name: 'Monthly token usage: 25%',
    });
    const percentage = screen.getByText('25%');

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(percentage.className).toContain('dial-tiny-text');
    expect(percentage.className).toContain('opacity-0');
    expect(percentage.nextElementSibling?.getAttribute('aria-hidden')).not.toBe(
      null,
    );
  });

  it('uses one rounded capsule for hover and focus reveal', () => {
    renderControl('gpt-4o');

    const trigger = screen.getByRole('button', {
      name: 'Monthly token usage: 25%',
    });

    expect(trigger.className).toContain('rounded-full');
    expect(trigger.className).toContain('border-transparent');
    expect(trigger.className).toContain('hover:border-primary');
    expect(trigger.className).toContain('focus-visible:outline-primary');
    expect(screen.getByText('25%').className).toContain(
      'group-hover:opacity-100',
    );
  });

  it('uses the error palette at and above the 90% threshold', () => {
    mockUseDeploymentUsageLimits.mockReturnValue({
      ...defaultHookResult,
      limit: {
        ...defaultLimit,
        usedPercent: 90,
      },
    });
    const { unmount } = renderControl('gpt-4o');

    expect(
      screen.getByRole('button', {
        name: 'Monthly token usage: 90%',
      }).className,
    ).toContain('text-error');

    mockUseDeploymentUsageLimits.mockReturnValue({
      ...defaultHookResult,
      limit: {
        ...defaultLimit,
        usedPercent: 89,
      },
    });
    unmount();
    renderControl('gpt-4o');

    expect(
      screen.getByRole('button', {
        name: 'Monthly token usage: 89%',
      }).className,
    ).not.toContain('text-error');
  });

  it('opens a minimal monthly popover and refreshes data', async () => {
    const refresh = vi.fn();
    mockUseDeploymentUsageLimits.mockReturnValue({
      ...defaultHookResult,
      refresh,
    });
    renderControl('gpt-4o');

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Monthly token usage: 25%',
      }),
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBeNull();
    expect(screen.getByText('Usage Limit')).toBeTruthy();
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    expect(
      screen.getByRole('progressbar', {
        name: 'Monthly token usage: 2,500 of 10,000 tokens used',
      }),
    ).toBeTruthy();
    expect(screen.getByText('7,500 tokens remaining')).toBeTruthy();
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.getByText('25%').className).toContain('opacity-100');
  });

  it('keeps refreshed content visible without a loading indicator', async () => {
    mockUseDeploymentUsageLimits.mockReturnValue({
      ...defaultHookResult,
      isLoading: true,
    });
    renderControl('gpt-4o');

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Monthly token usage: 25%',
      }),
    );

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    expect(screen.getByText('7,500 tokens remaining')).toBeTruthy();
    expect(screen.getByText('25%').className).toContain('opacity-100');
  });

  it('refreshes limits when generation completes', () => {
    const refresh = vi.fn();
    mockUseDeploymentUsageLimits.mockReturnValue({
      ...defaultHookResult,
      refresh,
    });
    const { rerender } = render(
      <UsageLimitsControl
        deploymentId="gpt-4o"
        isGenerationInProgress
        labels={labels}
      />,
    );

    rerender(
      <UsageLimitsControl
        deploymentId="gpt-4o"
        isGenerationInProgress={false}
        labels={labels}
      />,
    );

    expect(refresh).toHaveBeenCalledOnce();
  });

  it('waits for an active limits request before refreshing after generation', () => {
    const refresh = vi.fn();
    mockUseDeploymentUsageLimits.mockReturnValue({
      ...defaultHookResult,
      isLoading: true,
      refresh,
    });
    const { rerender } = render(
      <UsageLimitsControl
        deploymentId="gpt-4o"
        isGenerationInProgress
        labels={labels}
      />,
    );

    rerender(
      <UsageLimitsControl
        deploymentId="gpt-4o"
        isGenerationInProgress={false}
        labels={labels}
      />,
    );
    expect(refresh).not.toHaveBeenCalled();

    mockUseDeploymentUsageLimits.mockReturnValue({
      ...defaultHookResult,
      refresh,
    });
    rerender(
      <UsageLimitsControl
        deploymentId="gpt-4o"
        isGenerationInProgress={false}
        labels={{ ...labels }}
      />,
    );

    expect(refresh).toHaveBeenCalledOnce();
  });

  it('shows refresh errors without disabling adjacent input', async () => {
    mockUseDeploymentUsageLimits.mockReturnValue({
      ...defaultHookResult,
      hasError: true,
    });
    render(
      <>
        <input aria-label="Message" />
        <UsageLimitsControl deploymentId="gpt-4o" labels={labels} />
      </>,
    );

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Monthly token usage: 25%',
      }),
    );

    expect(screen.getByText('Could not load usage limits')).toBeTruthy();
    expect(
      (screen.getByRole('textbox', { name: 'Message' }) as HTMLInputElement)
        .disabled,
    ).toBe(false);
  });

  it('closes on Escape and restores trigger focus', async () => {
    renderControl('gpt-4o');
    const trigger = screen.getByRole('button', {
      name: 'Monthly token usage: 25%',
    });

    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes when the user points outside the popover', async () => {
    render(
      <>
        <div>Outside</div>
        <UsageLimitsControl deploymentId="gpt-4o" labels={labels} />
      </>,
    );
    const trigger = screen.getByRole('button', {
      name: 'Monthly token usage: 25%',
    });
    await userEvent.click(trigger);

    await userEvent.pointer({
      keys: '[MouseLeft]',
      target: screen.getByText('Outside'),
    });

    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  it('uses logical placement and mobile-safe dimensions', async () => {
    document.documentElement.dir = 'rtl';
    renderControl('gpt-4o');

    const trigger = screen.getByRole('button', {
      name: 'Monthly token usage: 25%',
    });
    expect(trigger.className).toContain('mobile:min-h-11');
    expect(trigger.className).not.toMatch(/\b(?:ml|mr|left|right)-/);

    await userEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('end-0');
    expect(dialog.className).toContain('max-w-[calc(100vw-2rem)]');
  });
});
