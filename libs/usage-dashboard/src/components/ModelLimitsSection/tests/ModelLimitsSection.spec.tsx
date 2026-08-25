import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  ModelLimitMetricCell,
  ModelLimitMetricKind,
  ModelLimitPeriodCell,
  ModelLimitRow,
  ModelLimitsLabels,
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
  itemColumnLabel: 'Item',
  last24HoursColumnLabel: 'Last 24 hours',
  last7DaysColumnLabel: 'Last 7 days',
  last30DaysColumnLabel: 'Last 30 days',
  statusColumnLabel: 'Status',
  tokensLabel: 'Tokens',
  costLabel: 'Cost',
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

const buildFiniteTokensCell = (
  usedLabel: string,
  totalLabel: string,
  usedPercent: number,
  status = ModelLimitStatus.WithinLimits,
): ModelLimitMetricCell => ({
  kind: ModelLimitMetricKind.Finite,
  usedLabel,
  totalLabel,
  usedPercent,
  status,
  ariaLabel: `${usedLabel} of ${totalLabel}, ${usedPercent}% used`,
});

const buildCostCell = (usedLabel: string): ModelLimitMetricCell => ({
  kind: ModelLimitMetricKind.Unlimited,
  usedLabel,
  ariaLabel: usedLabel,
});

const buildPeriodCell = (
  tokens: ModelLimitMetricCell,
  costLabel: string,
): ModelLimitPeriodCell => ({
  tokens,
  cost: buildCostCell(costLabel),
});

const baseRow: ModelLimitRow = {
  id: 'gpt-4o',
  name: 'GPT-4o',
  version: '2024-08-06',
  last24Hours: buildPeriodCell(buildFiniteTokensCell('4K', '10K', 40), '$3.20'),
  last7Days: buildPeriodCell(buildFiniteTokensCell('21K', '70K', 30), '$18.60'),
  last30Days: buildPeriodCell(
    buildFiniteTokensCell('65K', '300K', 22),
    '$55.10',
  ),
  status: ModelLimitStatus.WithinLimits,
};

const renderSection = (
  overrides: Partial<Parameters<typeof ModelLimitsSection>[0]> = {},
) =>
  render(
    <ModelLimitsSection rows={[baseRow]} labels={labels} {...overrides} />,
  );

describe('ModelLimitsSection', () => {
  it('renders the row count separately in the section heading', () => {
    renderSection({ rows: [baseRow, { ...baseRow, id: 'gpt-4o-mini' }] });

    expect(
      screen.getByRole('heading', { name: 'Model limits 2' }),
    ).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Model limits 2' })).toBeTruthy();
  });

  it('renders the empty state while preserving the section shell', () => {
    renderSection({ rows: [] });

    expect(
      screen.getByRole('heading', { name: 'Model limits 0' }),
    ).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Model limits 0' })).toBeTruthy();
    expect(screen.queryAllByRole('cell')).toHaveLength(0);
    expect(screen.getByText('No models to show yet.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders exactly the fixed comparison headers in order', () => {
    renderSection();

    expect(
      screen.getAllByRole('columnheader').map((header) => header.textContent),
    ).toEqual([
      'Item',
      'Last 24 hours',
      'Last 7 days',
      'Last 30 days',
      'Status',
    ]);
    expect(screen.queryByText('Requests')).toBeNull();
    expect(screen.queryByText('Last minute')).toBeNull();
    expect(screen.queryByText('Last hour')).toBeNull();
  });

  it('renders one semantic row with Item, three period cells, and Status', () => {
    renderSection();

    const dataRow = screen.getAllByRole('row')[1];
    const cells = within(dataRow).getAllByRole('cell');
    expect(cells).toHaveLength(5);
    expect(cells[0].textContent).toContain('GPT-4o');
    expect(cells[1].textContent).toContain('Last 24 hours');
    expect(cells[2].textContent).toContain('Last 7 days');
    expect(cells[3].textContent).toContain('Last 30 days');
    expect(cells[4].textContent).toContain('Status');
  });

  it('vertically centers desktop row content without changing horizontal alignment', () => {
    renderSection();

    const dataRow = screen.getAllByRole('row')[1];
    expect(dataRow.classList).toContain('desktop:items-center');
    expect(dataRow.classList).not.toContain('desktop:items-start');
    expect(dataRow.classList).not.toContain('text-center');
    expect(
      screen.getByRole('progressbar', { name: 'Last 24 hours Tokens' })
        .classList,
    ).toContain('w-full');
  });

  it('renders Tokens progress and value-only Cost in every period cell', () => {
    renderSection();

    expect(screen.getAllByText('Tokens')).toHaveLength(3);
    const costAccessibilityLabels = screen.getAllByText(/Cost:/);
    expect(costAccessibilityLabels).toHaveLength(3);
    costAccessibilityLabels.forEach((label) => {
      expect(label.classList).toContain('sr-only');
    });
    expect(
      screen.getByRole('progressbar', { name: 'Last 24 hours Tokens' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('progressbar', { name: 'Last 7 days Tokens' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('progressbar', { name: 'Last 30 days Tokens' }),
    ).toBeTruthy();
    expect(screen.getByText('$3.20')).toBeTruthy();
    expect(screen.getByText('$18.60')).toBeTruthy();
    expect(screen.getByText('$55.10')).toBeTruthy();
    [
      ['Last 24 hours Tokens', '4K', '$3.20'],
      ['Last 7 days Tokens', '21K', '$18.60'],
      ['Last 30 days Tokens', '65K', '$55.10'],
    ].forEach(([name, tokens, cost]) => {
      const valueRow = screen.getByRole('group', { name });
      expect(within(valueRow).getByText(tokens)).toBeTruthy();
      expect(within(valueRow).getByText(cost)).toBeTruthy();
    });
    expect(screen.queryByText('No limit')).toBeNull();
    expect(screen.queryByRole('progressbar', { name: /Cost/ })).toBeNull();
  });

  it('renders unavailable Cost as a value without a visible Cost label', () => {
    renderSection({
      rows: [
        {
          ...baseRow,
          last24Hours: {
            ...baseRow.last24Hours,
            cost: {
              kind: ModelLimitMetricKind.Unavailable,
              ariaLabel: 'Not available',
            },
          },
        },
      ],
    });

    const last24HoursCell = screen.getAllByRole('cell')[1];
    expect(within(last24HoursCell).getByText('Not available')).toBeTruthy();
    expect(within(last24HoursCell).getByText(/Cost:/).classList).toContain(
      'sr-only',
    );
    const valueRow = within(last24HoursCell).getByRole('group', {
      name: 'Last 24 hours Tokens',
    });
    expect(within(valueRow).getByText('4K')).toBeTruthy();
    expect(within(valueRow).getByText('Not available')).toBeTruthy();
    expect(last24HoursCell.textContent).not.toContain('No limit');
  });

  it('renders unlimited and unavailable token states without progress bars', () => {
    renderSection({
      rows: [
        {
          ...baseRow,
          last7Days: {
            ...baseRow.last7Days,
            tokens: {
              kind: ModelLimitMetricKind.Unlimited,
              usedLabel: '21K',
              ariaLabel: '21,000 tokens used, unlimited',
            },
          },
          last30Days: {
            ...baseRow.last30Days,
            tokens: {
              kind: ModelLimitMetricKind.Unavailable,
              ariaLabel: 'Not available',
            },
          },
        },
      ],
    });

    expect(
      screen.queryByRole('progressbar', { name: 'Last 7 days Tokens' }),
    ).toBeNull();
    expect(
      screen.queryByRole('progressbar', { name: 'Last 30 days Tokens' }),
    ).toBeNull();
    expect(screen.getAllByText('Not available')).toHaveLength(1);
    expect(screen.getAllByText('No limit')).toHaveLength(1);

    const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell');
    const last7DaysValueRow = within(cells[2]).getByRole('group', {
      name: 'Last 7 days Tokens',
    });
    expect(within(last7DaysValueRow).getByText('21K')).toBeTruthy();
    expect(within(last7DaysValueRow).getByText('$18.60')).toBeTruthy();

    const last30DaysValueRow = within(cells[3]).getByRole('group', {
      name: 'Last 30 days Tokens',
    });
    expect(within(last30DaysValueRow).getByText('Not available')).toBeTruthy();
    expect(within(last30DaysValueRow).getByText('$55.10')).toBeTruthy();
  });

  it('clamps progress visually while retaining the real accessible value', () => {
    renderSection({
      rows: [
        {
          ...baseRow,
          last24Hours: {
            ...baseRow.last24Hours,
            tokens: buildFiniteTokensCell(
              '15K',
              '10K',
              150,
              ModelLimitStatus.LimitReached,
            ),
          },
        },
      ],
    });

    const progress = screen.getByRole('progressbar', {
      name: 'Last 24 hours Tokens',
    });
    expect(progress.getAttribute('aria-valuenow')).toBe('100');
    expect(progress.getAttribute('aria-valuetext')).toBe(
      '15K of 10K, 150% used',
    );
  });

  it.each([
    [ModelLimitStatus.LimitReached, 'Limit reached', true],
    [ModelLimitStatus.RunningLow, 'Running low', true],
    [ModelLimitStatus.WithinLimits, 'Within limits', true],
    [ModelLimitStatus.NoLimit, 'No limit configured', false],
    [ModelLimitStatus.Unavailable, 'Unavailable', false],
  ])('renders the host-provided %s status', (status, label, isBadge) => {
    renderSection({
      rows: [{ ...baseRow, status }],
      labels: { ...labels, noLimitBadgeLabel: 'No limit configured' },
    });

    const statusElement = screen.getByText(label);
    expect(statusElement.classList.contains('rounded-full')).toBe(isBadge);
  });

  it('renders rows in supplied order with avatar fallback and accessible names', () => {
    renderSection({
      rows: [
        { ...baseRow, id: 'first', name: 'First model' },
        { ...baseRow, id: 'second', name: 'Second model' },
      ],
    });

    const dataRows = screen.getAllByRole('row').slice(1);
    expect(dataRows[0].textContent).toContain('First model');
    expect(dataRows[1].textContent).toContain('Second model');
    expect(screen.getByText('FM')).toBeTruthy();
    expect(screen.getByText('SM')).toBeTruthy();
  });

  it('keeps long identity content constrained inside the Item cell', () => {
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
    expect(nameElement.classList).toContain('truncate');
    expect(screen.getByText('2025-12-11').classList).toContain('shrink-0');
  });

  it('uses one responsive semantic subtree under an RTL ancestor', () => {
    render(
      <div dir="rtl">
        <ModelLimitsSection rows={[baseRow]} labels={labels} />
      </div>,
    );

    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getAllByRole('rowgroup')).toHaveLength(1);
    expect(screen.getAllByRole('cell')).toHaveLength(5);
    expect(screen.getAllByText('Last 24 hours')).toHaveLength(2);
    expect(screen.getAllByText('Last 7 days')).toHaveLength(2);
    expect(screen.getAllByText('Last 30 days')).toHaveLength(2);
  });
});
