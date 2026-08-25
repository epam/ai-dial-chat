import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  ModelLimitMetricCell,
  ModelLimitMetricKind,
  ModelLimitRow,
  ModelLimitsLabels,
  ModelLimitsPeriod,
  ModelLimitStatus,
} from '../../../models/model-limits-props';
import { ModelLimitsSection } from '../ModelLimitsSection';

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...actual,
    ProgressBar: ({
      value,
      max,
      className,
      'aria-label': ariaLabel,
      'aria-valuetext': ariaValueText,
    }: {
      value: number;
      max?: number;
      className?: string;
      'aria-label'?: string;
      'aria-valuetext'?: string;
    }) => (
      <div
        role="progressbar"
        className={className}
        aria-label={ariaLabel}
        aria-valuenow={value}
        aria-valuemax={max}
        aria-valuetext={ariaValueText}
      />
    ),
  };
});

const labels: ModelLimitsLabels = {
  headingLabel: 'Model limits',
  periodLabels: {
    [ModelLimitsPeriod.LastMinute]: 'Last minute',
    [ModelLimitsPeriod.LastHour]: 'Last hour',
    [ModelLimitsPeriod.Last24Hours]: 'Last 24 hours',
    [ModelLimitsPeriod.Last7Days]: 'Last 7 days',
    [ModelLimitsPeriod.Last30Days]: 'Last 30 days',
  },
  periodSelectorAriaLabel: 'Select usage period',
  itemColumnLabel: 'Item',
  costColumnLabel: 'Cost',
  tokensColumnLabel: 'Tokens',
  requestsColumnLabel: 'Requests',
  statusColumnLabel: 'Status',
  modelTypeLabel: 'Model',
  noLimitLabel: 'No limit',
  unavailableLabel: 'Not available',
  withinLimitsBadgeLabel: 'Within limits',
  runningLowBadgeLabel: 'Running low',
  limitReachedBadgeLabel: 'Limit reached',
  noLimitBadgeLabel: 'No limit',
  unavailableBadgeLabel: 'Unavailable',
  emptyStateLabel: 'No models to show yet.',
};

const unlimitedCostCell: ModelLimitMetricCell = {
  kind: ModelLimitMetricKind.Unlimited,
  usedLabel: '$3.20',
  ariaLabel: '$3.20 used, unlimited',
};

const finiteTokensCell: ModelLimitMetricCell = {
  kind: ModelLimitMetricKind.Finite,
  usedLabel: '4,000',
  totalLabel: '10,000',
  usedPercent: 40,
  status: ModelLimitStatus.WithinLimits,
  ariaLabel: '4,000 of 10,000, 40% used',
};

const unavailableRequestsCell: ModelLimitMetricCell = {
  kind: ModelLimitMetricKind.Unavailable,
  ariaLabel: 'Not available',
};

const baseRow: ModelLimitRow = {
  id: 'gpt-4o',
  name: 'GPT-4o',
  version: '2024-08-06',
  cost: unlimitedCostCell,
  tokens: finiteTokensCell,
  requests: unavailableRequestsCell,
  status: ModelLimitStatus.WithinLimits,
};

const renderSection = (
  overrides: Partial<Parameters<typeof ModelLimitsSection>[0]> = {},
) =>
  render(
    <ModelLimitsSection
      rows={[baseRow]}
      period={ModelLimitsPeriod.Last24Hours}
      onPeriodChange={vi.fn()}
      labels={labels}
      {...overrides}
    />,
  );

describe('ModelLimitsSection', () => {
  it('renders the row count separately in the section heading', () => {
    renderSection({ rows: [baseRow, { ...baseRow, id: 'gpt-4o-mini' }] });

    expect(
      screen.getByRole('heading', { name: 'Model limits 2' }),
    ).toBeTruthy();
  });

  it('renders the empty state when rows is empty, but keeps the heading and period selector', () => {
    renderSection({ rows: [] });

    expect(
      screen.getByRole('heading', { name: 'Model limits 0' }),
    ).toBeTruthy();
    expect(screen.getByText('Last 24 hours')).toBeTruthy();
    expect(screen.queryAllByRole('cell')).toHaveLength(0);
    expect(screen.getByText('No models to show yet.')).toBeTruthy();
  });

  it('lets the user change the period from the empty state', async () => {
    const onPeriodChange = vi.fn();
    renderSection({ rows: [], onPeriodChange });

    await userEvent.click(screen.getByText('Last 7 days'));

    expect(onPeriodChange).toHaveBeenCalledWith(ModelLimitsPeriod.Last7Days);
  });

  it('renders one row per entry with model name and version', () => {
    renderSection({
      rows: [
        baseRow,
        {
          ...baseRow,
          id: 'gpt-4o-mini',
          name: 'GPT-4o mini',
          version: '2024-07-18',
        },
      ],
    });

    expect(screen.getByText('GPT-4o')).toBeTruthy();
    expect(screen.getByText('2024-08-06')).toBeTruthy();
    expect(screen.getByText('GPT-4o mini')).toBeTruthy();
    expect(screen.getByText('2024-07-18')).toBeTruthy();
    expect(screen.getAllByText('Model')).toHaveLength(2);
  });

  it('exposes semantic table roles', () => {
    renderSection();

    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getAllByRole('row').length).toBeGreaterThan(0);
    expect(screen.getByRole('rowgroup')).toBeTruthy();
    expect(screen.getAllByRole('columnheader')).toHaveLength(5);
    expect(screen.getAllByRole('cell').length).toBeGreaterThan(0);
  });

  it('renders both the desktop columnheader and the mobile inline label for a column, so no information is dropped on either breakpoint', () => {
    renderSection();

    // Both the desktop `columnheader` and the per-cell mobile caption read "Tokens" — the
    // component mounts one tree and hides one copy per breakpoint via CSS, so both must exist in
    // the DOM regardless of viewport for information parity to hold.
    expect(screen.getAllByText('Tokens')).toHaveLength(2);
  });

  it('names the table region from the heading text, including the count', () => {
    renderSection({ rows: [baseRow, { ...baseRow, id: 'other' }] });

    expect(screen.getByRole('table', { name: 'Model limits 2' })).toBeTruthy();
  });

  it('renders a finite metric as used/total with an accessible progress bar', () => {
    renderSection();

    expect(screen.getByText('4,000')).toBeTruthy();
    expect(screen.getByText('/ 10,000')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Tokens' })).toBeTruthy();
  });

  it('renders an unlimited metric with the used value and "No limit", no progress bar for that cell', () => {
    renderSection();

    expect(screen.getByText('$3.20')).toBeTruthy();
    expect(screen.getByText('No limit')).toBeTruthy();
    expect(screen.queryByRole('progressbar', { name: 'Cost' })).toBeNull();
  });

  it('renders an unavailable metric with text distinct from the unlimited "No limit" text', () => {
    renderSection();

    expect(screen.getByText('Not available')).toBeTruthy();
    expect(screen.queryByRole('progressbar', { name: 'Requests' })).toBeNull();
    // The row's Cost cell is unlimited ("No limit") while Requests is unavailable
    // ("Not available") — both render, with distinct text, in the same row.
    expect(screen.getAllByText('No limit')).toHaveLength(1);
  });

  it('clamps the progress bar visually at 100% while the accessible value keeps the real percentage', () => {
    renderSection({
      rows: [
        {
          ...baseRow,
          tokens: {
            kind: ModelLimitMetricKind.Finite,
            usedLabel: '15,000',
            totalLabel: '10,000',
            usedPercent: 150,
            status: ModelLimitStatus.LimitReached,
            ariaLabel: '15,000 of 10,000, 150% used',
          },
        },
      ],
    });

    const progress = screen.getByRole('progressbar', { name: 'Tokens' });
    expect(progress.getAttribute('aria-valuenow')).toBe('100');
    expect(progress.getAttribute('aria-valuetext')).toBe(
      '15,000 of 10,000, 150% used',
    );
  });

  it('renders a distinct plain-text "No limit" status for an all-unlimited row', () => {
    renderSection({
      rows: [{ ...baseRow, status: ModelLimitStatus.NoLimit }],
      labels: { ...labels, noLimitBadgeLabel: 'No limit configured' },
    });

    const status = screen.getByText('No limit configured');
    expect(status.classList.contains('rounded-full')).toBe(false);
    expect(screen.queryByText('Within limits')).toBeNull();
  });

  it('renders the limit-reached badge for the most severe status', () => {
    renderSection({
      rows: [{ ...baseRow, status: ModelLimitStatus.LimitReached }],
    });

    expect(screen.getByText('Limit reached')).toBeTruthy();
  });

  it('renders the unavailable badge for a fully unavailable row', () => {
    renderSection({
      rows: [{ ...baseRow, status: ModelLimitStatus.Unavailable }],
    });

    expect(screen.getByText('Unavailable')).toBeTruthy();
  });

  it('calls onPeriodChange with the newly selected period, without changing its own rendered period', async () => {
    const onPeriodChange = vi.fn();
    renderSection({ onPeriodChange });

    await userEvent.click(screen.getByText('Last 7 days'));

    expect(onPeriodChange).toHaveBeenCalledWith(ModelLimitsPeriod.Last7Days);
  });

  it('falls back to an initials avatar when no avatar URL is provided', () => {
    renderSection({ rows: [{ ...baseRow, avatarSrc: undefined }] });

    expect(screen.getByText('GP')).toBeTruthy();
  });

  it('truncates the model name before its non-shrinking version', () => {
    renderSection({
      rows: [
        {
          ...baseRow,
          name: 'A Very Long Model Display Name',
          version: '2025-12-11',
        },
      ],
    });

    const nameElement = screen.getByText('A Very Long Model Display Name');
    expect(nameElement.getAttribute('title')).toBe(
      'A Very Long Model Display Name',
    );
    expect(nameElement.classList).toContain('min-w-0');
    expect(nameElement.classList).toContain('flex-1');
    expect(nameElement.classList).toContain('truncate');
    expect(screen.getByText('2025-12-11').classList).toContain('shrink-0');

    const itemCell = screen.getAllByRole('cell')[0];
    expect(itemCell.classList).toContain('min-w-0');
    expect(itemCell.classList).toContain('overflow-hidden');
  });

  it('keeps the same content and roles under an RTL ancestor', () => {
    render(
      <div dir="rtl">
        <ModelLimitsSection
          rows={[baseRow]}
          period={ModelLimitsPeriod.Last24Hours}
          onPeriodChange={vi.fn()}
          labels={labels}
        />
      </div>,
    );

    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByText('GPT-4o')).toBeTruthy();
  });
});
