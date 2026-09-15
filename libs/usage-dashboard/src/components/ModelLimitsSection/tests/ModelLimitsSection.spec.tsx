import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  ModelLimitMetricCell,
  ModelLimitMetricKind,
  ModelLimitPeriodCell,
  ModelLimitPeriodStatuses,
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
  headingLabel: 'Model tokens limits',
  itemColumnLabel: 'Item',
  dayColumnLabel: 'Today',
  weekColumnLabel: 'This week',
  monthColumnLabel: 'This month',
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

const periodStatuses: ModelLimitPeriodStatuses = {
  day: { status: ModelLimitStatus.WithinLimits },
  week: { status: ModelLimitStatus.WithinLimits },
  month: { status: ModelLimitStatus.WithinLimits },
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
  day: buildPeriodCell(buildFiniteTokensCell('4K', '10K', 40), '$3.20 spent'),
  week: buildPeriodCell(
    buildFiniteTokensCell('21K', '70K', 30),
    '$18.60 spent',
  ),
  month: buildPeriodCell(
    buildFiniteTokensCell('65K', '300K', 22),
    '$55.10 spent',
  ),
  status: ModelLimitStatus.WithinLimits,
};

const renderSection = (
  overrides: Partial<Parameters<typeof ModelLimitsSection>[0]> = {},
) =>
  render(
    <ModelLimitsSection
      rows={[baseRow]}
      labels={labels}
      periodStatuses={periodStatuses}
      {...overrides}
    />,
  );

describe('ModelLimitsSection', () => {
  it('renders the row count separately in the section heading', () => {
    renderSection({ rows: [baseRow, { ...baseRow, id: 'gpt-4o-mini' }] });

    expect(
      screen.getByRole('heading', { name: 'Model tokens limits 2' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('table', { name: 'Model tokens limits 2' }),
    ).toBeTruthy();
  });

  it('renders the empty state while preserving the section shell', () => {
    renderSection({ rows: [] });

    expect(
      screen.getByRole('heading', { name: 'Model tokens limits 0' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('table', { name: 'Model tokens limits 0' }),
    ).toBeTruthy();
    expect(screen.queryAllByRole('cell')).toHaveLength(0);
    expect(screen.getByText('No models to show yet.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders exactly the fixed comparison headers in order', () => {
    renderSection();

    expect(
      screen.getAllByRole('columnheader').map((header) => header.textContent),
    ).toEqual(['Item', 'Today', 'This week', 'This month', 'Status']);
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
    expect(cells[1].textContent).toContain('Today');
    expect(cells[2].textContent).toContain('This week');
    expect(cells[3].textContent).toContain('This month');
    expect(cells[4].textContent).toContain('Status');
  });

  it('vertically centers desktop row content without changing horizontal alignment', () => {
    renderSection();

    const dataRow = screen.getAllByRole('row')[1];
    expect(dataRow.classList).toContain('desktop:items-center');
    expect(dataRow.classList).not.toContain('desktop:items-start');
    expect(dataRow.classList).not.toContain('text-center');
    expect(
      screen.getByRole('progressbar', { name: 'Today Tokens' }).classList,
    ).toContain('w-full');
  });

  it('renders token progress followed by attributed Cost in every period cell', () => {
    renderSection();

    const costAccessibilityLabels = screen.getAllByText(/Cost:/);
    expect(costAccessibilityLabels).toHaveLength(3);
    costAccessibilityLabels.forEach((label) => {
      expect(label.classList).toContain('sr-only');
    });
    screen.getAllByText(/Tokens:/).forEach((label) => {
      expect(label.classList).toContain('sr-only');
    });
    expect(
      screen.getByRole('progressbar', { name: 'Today Tokens' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('progressbar', { name: 'This week Tokens' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('progressbar', { name: 'This month Tokens' }),
    ).toBeTruthy();
    expect(screen.getByText('$3.20 spent')).toBeTruthy();
    expect(screen.getByText('$18.60 spent')).toBeTruthy();
    expect(screen.getByText('$55.10 spent')).toBeTruthy();
    [
      ['Today Tokens', '4K', '$3.20 spent'],
      ['This week Tokens', '21K', '$18.60 spent'],
      ['This month Tokens', '65K', '$55.10 spent'],
    ].forEach(([name, tokens, cost]) => {
      const valueRow = screen.getByRole('group', { name });
      expect(within(valueRow).getByText(tokens)).toBeTruthy();
      expect(within(valueRow).queryByText(cost)).toBeNull();
      expect(screen.getByText(cost)).toBeTruthy();
    });
    expect(screen.queryByText('No limit')).toBeNull();
    expect(screen.queryByRole('progressbar', { name: /Cost/ })).toBeNull();
  });

  it('renders unavailable Cost as a value without a visible Cost label', () => {
    renderSection({
      rows: [
        {
          ...baseRow,
          day: {
            ...baseRow.day,
            cost: {
              kind: ModelLimitMetricKind.Unavailable,
              ariaLabel: 'Not available',
            },
          },
        },
      ],
    });

    const dayCell = screen.getAllByRole('cell')[1];
    expect(within(dayCell).getByText('Not available')).toBeTruthy();
    expect(within(dayCell).getByText(/Cost:/).classList).toContain('sr-only');
    const valueRow = within(dayCell).getByRole('group', {
      name: 'Today Tokens',
    });
    expect(within(valueRow).getByText('4K')).toBeTruthy();
    expect(within(valueRow).queryByText('Not available')).toBeNull();
    expect(dayCell.textContent).not.toContain('No limit');
  });

  it('renders unlimited and unavailable token states without progress bars', () => {
    renderSection({
      rows: [
        {
          ...baseRow,
          week: {
            ...baseRow.week,
            tokens: {
              kind: ModelLimitMetricKind.Unlimited,
              usedLabel: '21K',
              supportingLabel: 'Follows cost limit',
              ariaLabel: '21,000 tokens used, unlimited',
            },
          },
          month: {
            ...baseRow.month,
            tokens: {
              kind: ModelLimitMetricKind.Unavailable,
              ariaLabel: 'Not available',
            },
          },
        },
      ],
    });

    expect(
      screen.queryByRole('progressbar', { name: 'This week Tokens' }),
    ).toBeNull();
    expect(
      screen.queryByRole('progressbar', { name: 'This month Tokens' }),
    ).toBeNull();
    expect(screen.getAllByText('Not available')).toHaveLength(1);
    expect(screen.getAllByText('Follows cost limit')).toHaveLength(1);

    const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell');
    const weekValueRow = within(cells[2]).getByRole('group', {
      name: 'This week Tokens',
    });
    expect(within(weekValueRow).getByText('21K')).toBeTruthy();
    expect(within(weekValueRow).queryByText('$18.60 spent')).toBeNull();
    expect(within(cells[2]).getByText('$18.60 spent')).toBeTruthy();

    const monthValueRow = within(cells[3]).getByRole('group', {
      name: 'This month Tokens',
    });
    expect(within(monthValueRow).getByText('Not available')).toBeTruthy();
    expect(within(monthValueRow).queryByText('$55.10 spent')).toBeNull();
    expect(within(cells[3]).getByText('$55.10 spent')).toBeTruthy();
  });

  it('clamps progress visually while retaining the real accessible value', () => {
    renderSection({
      rows: [
        {
          ...baseRow,
          day: {
            ...baseRow.day,
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
      name: 'Today Tokens',
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
        <ModelLimitsSection
          rows={[baseRow]}
          labels={labels}
          periodStatuses={periodStatuses}
        />
      </div>,
    );

    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getAllByRole('rowgroup')).toHaveLength(1);
    expect(screen.getAllByRole('cell')).toHaveLength(5);
    expect(screen.getAllByText('Today')).toHaveLength(2);
    expect(screen.getAllByText('This week')).toHaveLength(2);
    expect(screen.getAllByText('This month')).toHaveLength(2);
  });

  it('renders accessible overall Cost indicators for affected period headers', () => {
    const reachedTooltip =
      "Overall last 24 hours cost limit is reached. Models can't be used until it resets, regardless of remaining token limits.";
    const warningTooltip = 'Overall last 7 days cost limit is running low.';

    renderSection({
      periodStatuses: {
        day: {
          status: ModelLimitStatus.LimitReached,
          tooltipLabel: reachedTooltip,
        },
        week: {
          status: ModelLimitStatus.RunningLow,
          tooltipLabel: warningTooltip,
        },
        month: { status: ModelLimitStatus.WithinLimits },
      },
    });

    expect(screen.getAllByRole('img', { name: reachedTooltip })).toHaveLength(
      2,
    );
    const warningIndicators = screen.getAllByRole('img', {
      name: warningTooltip,
    });
    expect(warningIndicators).toHaveLength(2);
    warningIndicators.forEach((indicator) => {
      expect(indicator.getAttribute('tabindex')).toBe('0');
      expect(indicator.classList).toContain('size-11');
      expect(indicator.classList).toContain('desktop:size-4');
    });
  });

  describe('period header reset line', () => {
    const DAY_RESETS_AT = '2026-09-16T00:00:00Z';
    const DAY_RESET_LABEL = 'Resets Sep 16, 2026, 2:00 AM GMT+2';
    /* The spoken form names the zone in full, which is what it adds over the visible line. */
    const DAY_SPOKEN_LABEL =
      'Usage resets Sep 16, 2026, 2:00 AM Central European Summer Time';

    const withDayReset: ModelLimitPeriodStatuses = {
      ...periodStatuses,
      day: {
        status: ModelLimitStatus.WithinLimits,
        resetLabel: DAY_RESET_LABEL,
        resetIsoValue: DAY_RESETS_AT,
        resetAriaLabel: DAY_SPOKEN_LABEL,
      },
    };

    it('renders the reset label beneath its column label in a <time>', () => {
      renderSection({ periodStatuses: withDayReset });

      const header = screen.getByRole('columnheader', { name: /Today/ });
      expect(header.textContent).toContain('Today');
      expect(header.textContent).toContain(DAY_RESET_LABEL);

      /* Desktop header plus the mobile per-period block both carry the line. */
      const [resetLine] = screen.getAllByText(DAY_RESET_LABEL);
      expect(resetLine.tagName).toBe('TIME');
      expect(resetLine.getAttribute('dateTime')).toBe(DAY_RESETS_AT);
    });

    it('carries the spoken form on a visually-hidden sibling, not on the <time>', () => {
      renderSection({ periodStatuses: withDayReset });

      for (const resetLine of screen.getAllByText(DAY_RESET_LABEL)) {
        expect(resetLine.hasAttribute('aria-label')).toBe(false);
        expect(resetLine.getAttribute('aria-hidden')).toBe('true');
      }

      for (const spoken of screen.getAllByText(DAY_SPOKEN_LABEL)) {
        expect(spoken.className).toContain('sr-only');
      }
    });

    it('renders no reset line for a period status without one', () => {
      renderSection({ periodStatuses: withDayReset });

      const weekHeader = screen.getByRole('columnheader', {
        name: /This week/,
      });
      expect(weekHeader.textContent).not.toContain('Resets');
    });

    it('renders nothing when no period carries a reset label', () => {
      renderSection();

      expect(screen.queryByText(/^Resets /)).toBeNull();
    });

    it('keeps the period status indicator in place alongside the reset line', () => {
      const reachedTooltip = 'Overall cost limit for today is reached.';
      renderSection({
        periodStatuses: {
          ...withDayReset,
          day: {
            ...withDayReset.day,
            status: ModelLimitStatus.LimitReached,
            tooltipLabel: reachedTooltip,
          },
        },
      });

      expect(screen.getAllByRole('img', { name: reachedTooltip })).toHaveLength(
        2,
      );
      expect(screen.getAllByText(DAY_RESET_LABEL).length).toBeGreaterThan(0);
    });

    it('wraps the reset line rather than forcing horizontal overflow', () => {
      renderSection({ periodStatuses: withDayReset });

      for (const resetLine of screen.getAllByText(DAY_RESET_LABEL)) {
        expect(resetLine.className).toContain('break-words');
        expect(resetLine.className).not.toContain('whitespace-nowrap');
      }
    });
  });
});
