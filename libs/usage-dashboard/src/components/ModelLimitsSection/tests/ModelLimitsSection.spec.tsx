import { render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
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

/*
 * Renders the real ui-kit Grid: ag-grid mounts its header and rows after the
 * first paint, so the helper waits for them before a test queries the table.
 */
const renderSection = async (
  overrides: Partial<Parameters<typeof ModelLimitsSection>[0]> = {},
  wrap: (node: ReactElement) => ReactElement = (node) => node,
) => {
  render(
    wrap(
      <ModelLimitsSection
        rows={[baseRow]}
        labels={labels}
        periodStatuses={periodStatuses}
        {...overrides}
      />,
    ),
  );
  await screen.findAllByRole('columnheader');
  if ((overrides.rows ?? [baseRow]).length > 0) {
    await screen.findAllByRole('gridcell');
  }
};

/** Body rows: the rows that hold grid cells, leaving out the header row. */
const dataRows = () =>
  screen
    .getAllByRole('row')
    .filter((row) => within(row).queryAllByRole('gridcell').length > 0);

/** Cells of the first body row, in column order. */
const firstRowCells = () => within(dataRows()[0]).getAllByRole('gridcell');

const withRtl = (node: ReactElement) => <div dir="rtl">{node}</div>;

describe('ModelLimitsSection', () => {
  it('renders the row count separately in the section heading', async () => {
    await renderSection({ rows: [baseRow, { ...baseRow, id: 'gpt-4o-mini' }] });

    expect(
      screen.getByRole('heading', { name: 'Model tokens limits 2' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('region', { name: 'Model tokens limits 2' }),
    ).toBeTruthy();
  });

  it('renders the grid empty state while preserving the section shell', async () => {
    await renderSection({ rows: [] });

    expect(
      screen.getByRole('heading', { name: 'Model tokens limits 0' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('region', { name: 'Model tokens limits 0' }),
    ).toBeTruthy();
    expect(screen.queryAllByRole('gridcell')).toHaveLength(0);
    expect(await screen.findByText('No models to show yet.')).toBeTruthy();
    expect(screen.queryByText(/find any results/)).toBeNull();
  });

  it('renders exactly the fixed comparison headers in order', async () => {
    await renderSection();

    expect(
      screen.getAllByRole('columnheader').map((header) => header.textContent),
    ).toEqual(['Item', 'Today', 'This week', 'This month', 'Status']);
    expect(screen.queryByText('Requests')).toBeNull();
    expect(screen.queryByText('Last minute')).toBeNull();
    expect(screen.queryByText('Last hour')).toBeNull();
  });

  it('renders one row with Item, three period cells, and Status in reading order', async () => {
    await renderSection();

    const cells = firstRowCells();
    expect(cells).toHaveLength(5);
    expect(cells[0].textContent).toContain('GPT-4o');
    expect(cells[1].textContent).toContain('4K');
    expect(cells[2].textContent).toContain('21K');
    expect(cells[3].textContent).toContain('65K');
    expect(cells[4].textContent).toContain('Within limits');
  });

  it('renders the kit Chat table appearance', async () => {
    await renderSection();

    expect(
      screen.getByRole('region', { name: 'Model tokens limits 1' }).classList,
    ).toContain('dial-kit-grid-chat');
  });

  it('gives each period cell a full-width progress track', async () => {
    await renderSection();

    expect(
      screen.getByRole('progressbar', { name: 'Today Tokens' }).classList,
    ).toContain('w-full');
  });

  it('renders token progress followed by attributed Cost in every period cell', async () => {
    await renderSection();

    const costAccessibilityLabels = screen.getAllByText(/Cost:/);
    expect(costAccessibilityLabels).toHaveLength(3);
    costAccessibilityLabels.forEach((label) => {
      expect(label.classList).toContain('sr-only');
    });
    screen.getAllByText(/Tokens:/).forEach((label) => {
      expect(label.classList).toContain('sr-only');
    });
    [
      ['Today Tokens', '4K', '$3.20 spent'],
      ['This week Tokens', '21K', '$18.60 spent'],
      ['This month Tokens', '65K', '$55.10 spent'],
    ].forEach(([name, tokens, cost]) => {
      expect(screen.getByRole('progressbar', { name })).toBeTruthy();
      const valueRow = screen.getByRole('group', { name });
      expect(within(valueRow).getByText(tokens)).toBeTruthy();
      expect(within(valueRow).queryByText(cost)).toBeNull();
      expect(screen.getByText(cost)).toBeTruthy();
    });
    expect(screen.queryByText('No limit')).toBeNull();
    expect(screen.queryByRole('progressbar', { name: /Cost/ })).toBeNull();
  });

  it('renders unavailable Cost as a value without a visible Cost label', async () => {
    await renderSection({
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

    const dayCell = firstRowCells()[1];
    expect(within(dayCell).getByText('Not available')).toBeTruthy();
    expect(within(dayCell).getByText(/Cost:/).classList).toContain('sr-only');
    const valueRow = within(dayCell).getByRole('group', {
      name: 'Today Tokens',
    });
    expect(within(valueRow).getByText('4K')).toBeTruthy();
    expect(within(valueRow).queryByText('Not available')).toBeNull();
    expect(dayCell.textContent).not.toContain('No limit');
  });

  it('renders unlimited and unavailable token states without progress bars', async () => {
    await renderSection({
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

    const cells = firstRowCells();
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

  it('clamps progress visually while retaining the real accessible value', async () => {
    await renderSection({
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
  ])('renders the host-provided %s status', async (status, label, isBadge) => {
    await renderSection({
      rows: [{ ...baseRow, status }],
      labels: { ...labels, noLimitBadgeLabel: 'No limit configured' },
    });

    const statusElement = within(firstRowCells()[4]).getByText(label);
    expect(statusElement.classList.contains('rounded-full')).toBe(isBadge);
  });

  it('renders rows in supplied order with avatar fallback', async () => {
    await renderSection({
      rows: [
        { ...baseRow, id: 'first', name: 'First model' },
        { ...baseRow, id: 'second', name: 'Second model' },
      ],
    });

    const rows = dataRows();
    expect(rows[0].textContent).toContain('First model');
    expect(rows[1].textContent).toContain('Second model');
    expect(screen.getByText('FM')).toBeTruthy();
    expect(screen.getByText('SM')).toBeTruthy();
  });

  it('keeps long identity content constrained inside the Item cell', async () => {
    await renderSection({
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

  it('renders each period label once, in its column header, under an RTL ancestor', async () => {
    await renderSection({}, withRtl);

    expect(screen.getAllByRole('region')).toHaveLength(1);
    expect(screen.getAllByText('Today')).toHaveLength(1);
    expect(screen.getAllByText('This week')).toHaveLength(1);
    expect(screen.getAllByText('This month')).toHaveLength(1);
    expect(firstRowCells()[0].textContent).toContain('GPT-4o');
  });

  it('renders accessible overall Cost indicators in the affected period headers', async () => {
    const reachedTooltip =
      'Overall today cost limit is reached. Models cannot be used until it resets.';
    const warningTooltip = 'Overall this week cost limit is running low.';

    await renderSection({
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

    expect(
      within(screen.getByRole('columnheader', { name: /Today/ })).getByRole(
        'img',
        { name: reachedTooltip },
      ),
    ).toBeTruthy();
    const warningIndicator = within(
      screen.getByRole('columnheader', { name: /This week/ }),
    ).getByRole('img', { name: warningTooltip });
    expect(warningIndicator.getAttribute('tabindex')).toBe('0');
    expect(warningIndicator.classList).toContain('size-11');
    expect(warningIndicator.classList).toContain('desktop:size-4');
  });

  it('accepts only content colors, leaving the table chrome to the grid theme', async () => {
    await renderSection({
      rows: [{ ...baseRow, status: ModelLimitStatus.LimitReached }],
      styles: {
        colors: {
          // @ts-expect-error — the row divider is the grid theme's, not a prop.
          rowDividerColor: '#000',
          errorBadgeBackground: '#f00',
        },
      },
    });

    expect(
      within(firstRowCells()[4]).getByText('Limit reached').classList,
    ).toContain('rounded-full');
  });

  describe('row type caption and cost supporting label', () => {
    const agentCost: ModelLimitMetricCell = {
      kind: ModelLimitMetricKind.Unlimited,
      usedLabel: '$1.50 spent',
      supportingLabel: 'Includes cost of models it called',
      ariaLabel: '$1.50 spent',
    };
    const agentRow: ModelLimitRow = {
      ...baseRow,
      id: 'llm-router',
      name: 'LLM Router',
      version: undefined,
      typeLabel: 'Agent',
      day: { tokens: baseRow.day.tokens, cost: agentCost },
    };

    it('shows a row-supplied type caption while other rows keep the section label', async () => {
      await renderSection({ rows: [baseRow, agentRow] });

      const [modelRow, routerRow] = dataRows();
      expect(within(modelRow).getByText('Model')).toBeTruthy();
      expect(within(routerRow).getByText('Agent')).toBeTruthy();
      expect(within(routerRow).queryByText('Model')).toBeNull();
    });

    it('falls back to the section label for an empty type caption', async () => {
      await renderSection({ rows: [{ ...baseRow, typeLabel: '' }] });

      expect(screen.getByText('Model')).toBeTruthy();
    });

    it('shows the cost supporting label beneath the spent value in the same cell', async () => {
      await renderSection({ rows: [agentRow] });

      // Cells in order: Item, Today, This week, This month, Status.
      const dayCell = firstRowCells()[1];
      expect(within(dayCell).getByText('$1.50 spent')).toBeTruthy();
      const supporting = within(dayCell).getByText(
        'Includes cost of models it called',
      );
      expect(supporting.classList).toContain('break-words');
    });

    it('ignores a supporting label on an unavailable cost cell', async () => {
      await renderSection({
        rows: [
          {
            ...agentRow,
            day: {
              tokens: baseRow.day.tokens,
              cost: {
                kind: ModelLimitMetricKind.Unavailable,
                supportingLabel: 'Includes cost of models it called',
                ariaLabel: 'Unavailable',
              },
            },
          },
        ],
      });

      expect(
        screen.queryByText('Includes cost of models it called'),
      ).toBeNull();
    });

    it('renders only the spent line when no supporting label is given', async () => {
      await renderSection();

      const dayCell = firstRowCells()[1];
      expect(within(dayCell).getAllByText(/spent/)).toHaveLength(1);
      expect(
        within(dayCell).queryByText('Includes cost of models it called'),
      ).toBeNull();
    });

    it('renders both additions under an RTL ancestor', async () => {
      await renderSection({ rows: [agentRow] }, withRtl);

      expect(screen.getByText('Agent')).toBeTruthy();
      expect(
        screen.getByText('Includes cost of models it called'),
      ).toBeTruthy();
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

    it('renders the reset time as a focusable info icon named by the spoken form, not as a header line', async () => {
      await renderSection({ periodStatuses: withDayReset });

      const header = screen.getByRole('columnheader', { name: /Today/ });
      expect(header.textContent).not.toContain(DAY_RESET_LABEL);

      const info = within(header).getByRole('img', { name: DAY_SPOKEN_LABEL });
      expect(info.getAttribute('tabindex')).toBe('0');
    });

    it('names the info icon by the visible label when no spoken form is supplied', async () => {
      await renderSection({
        periodStatuses: {
          ...withDayReset,
          day: { ...withDayReset.day, resetAriaLabel: undefined },
        },
      });

      expect(screen.getByRole('img', { name: DAY_RESET_LABEL })).toBeTruthy();
    });

    it('renders no reset line for a period status without one', async () => {
      await renderSection({ periodStatuses: withDayReset });

      const weekHeader = screen.getByRole('columnheader', {
        name: /This week/,
      });
      expect(weekHeader.textContent).not.toContain('Resets');
    });

    it('renders nothing when no period carries a reset label', async () => {
      await renderSection();

      expect(screen.queryByText(/^Resets /)).toBeNull();
    });

    it('keeps the period status indicator in place alongside the reset info icon', async () => {
      const reachedTooltip = 'Overall cost limit for today is reached.';
      await renderSection({
        periodStatuses: {
          ...withDayReset,
          day: {
            ...withDayReset.day,
            status: ModelLimitStatus.LimitReached,
            tooltipLabel: reachedTooltip,
          },
        },
      });

      const header = screen.getByRole('columnheader', { name: /Today/ });
      expect(
        within(header).getByRole('img', { name: reachedTooltip }),
      ).toBeTruthy();
      expect(
        within(header).getByRole('img', { name: DAY_SPOKEN_LABEL }),
      ).toBeTruthy();
    });
  });
});
