import { DIAL_ICON_SIZE, DIAL_KIT_ICON_STROKE } from '@epam/ai-dial-ui-kit';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ScheduledTaskRunHistoryListLabels } from '../../../models/scheduled-task-run-history-list-props';
import type { ScheduledTaskRunItem } from '../../../models/scheduled-task-run-item';
import { ScheduledTaskRunStatus } from '../../../types/scheduled-task-run-status';
import { ScheduledTaskRunHistoryList } from '../ScheduledTaskRunHistoryList';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  LiveRegionPoliteness: { Polite: 'polite', Assertive: 'assertive' },
  LiveRegionElement: { Div: 'div', Span: 'span', P: 'p' },
  LiveRegion: ({
    politeness = 'polite',
    visuallyHidden,
    as: Tag = 'div',
    atomic,
    className,
    children,
    ...rest
  }: {
    politeness?: string;
    visuallyHidden?: boolean;
    as?: 'div' | 'span' | 'p';
    atomic?: boolean;
  } & React.HTMLAttributes<HTMLElement>) => (
    <Tag
      {...rest}
      role={politeness === 'assertive' ? 'alert' : 'status'}
      aria-live={politeness as 'polite' | 'assertive'}
      aria-atomic={atomic}
      className={visuallyHidden ? 'sr-only' : className}
    >
      {children}
    </Tag>
  ),
  DIAL_KIT_ICON_STROKE: 1.5,
  NoDataContent: ({
    title,
    description,
    live,
  }: {
    title: string;
    description?: string;
    live?: boolean;
  }) => (
    <div role={live ? 'status' : undefined}>
      <span>{title}</span>
      {description != null && <span>{description}</span>}
    </div>
  ),
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  Spinner: () => <div role="progressbar" />,
  Skeleton: (props: Record<string, unknown>) => (
    <div data-skeleton {...props} />
  ),
  SkeletonVariant: { Default: 'default', Rectangular: 'rectangular' },
  GhostButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick?: () => void;
  }) => <button onClick={onClick}>{label}</button>,
  LinkButton: ({ label, onClick }: { label: string; onClick?: () => void }) => (
    <button onClick={onClick}>{label}</button>
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconCheck: (props: Record<string, unknown>) => (
    <svg data-icon="success" {...props} />
  ),
  IconChevronDown: (props: Record<string, unknown>) => (
    <svg data-icon="chevron" {...props} />
  ),
  IconCircleX: (props: Record<string, unknown>) => (
    <svg data-icon="error" {...props} />
  ),
  IconAlertTriangle: (props: Record<string, unknown>) => (
    <svg data-icon="missed" {...props} />
  ),
}));

const labels: ScheduledTaskRunHistoryListLabels = {
  historyTitle: 'History',
  emptyLabel: 'No runs yet',
  errorLabel: 'Failed to load history',
  retryLabel: 'Retry',
  runStatusLabels: {
    [ScheduledTaskRunStatus.Success]: 'Succeeded',
    [ScheduledTaskRunStatus.Error]: 'Failed',
    [ScheduledTaskRunStatus.InProgress]: 'Running',
    [ScheduledTaskRunStatus.Missed]: 'Missed',
  },
  currentRunLabel: 'Current run',
};

const buildRun = (
  overrides?: Partial<ScheduledTaskRunItem>,
): ScheduledTaskRunItem => ({
  id: 'run_1',
  status: ScheduledTaskRunStatus.Success,
  timestampLabel: 'today at 9:01 AM (99s)',
  ...overrides,
});

describe('ScheduledTaskRunHistoryList', () => {
  it('renders a row per item with its timestamp and status icon', () => {
    render(
      <ScheduledTaskRunHistoryList
        items={[
          buildRun({ id: 'run_1' }),
          buildRun({
            id: 'run_2',
            status: ScheduledTaskRunStatus.Error,
            timestampLabel: 'Jul 10 at 9:46 AM (154s)',
          }),
        ]}
        labels={labels}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('today at 9:01 AM (99s)')).toBeTruthy();
    expect(screen.getByText('Jul 10 at 9:46 AM (154s)')).toBeTruthy();
  });

  it('renders the duration as a separate secondary-colored label and includes it in the accessible name', () => {
    render(
      <ScheduledTaskRunHistoryList
        items={[
          buildRun({
            timestampLabel: 'today at 9:01 AM',
            durationLabel: '(3s)',
          }),
        ]}
        labels={labels}
      />,
    );

    expect(screen.getByText('today at 9:01 AM')).toBeTruthy();
    expect(screen.getByText('(3s)').className).toContain('subtitleText');
    expect(
      screen.getByRole('listitem', {
        name: 'Succeeded today at 9:01 AM (3s)',
      }),
    ).toBeTruthy();
  });

  it('shows skeleton rows during initial loading', () => {
    const { container } = render(
      <ScheduledTaskRunHistoryList items={[]} isLoading labels={labels} />,
    );

    expect(
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- skeleton rows are plain divs with no accessible role/text; only their data-skeleton CSS hook distinguishes them
      container.querySelectorAll('[data-skeleton]').length,
    ).toBeGreaterThan(0);
  });

  it('shows the empty label when there are no runs and loading has finished', () => {
    render(<ScheduledTaskRunHistoryList items={[]} labels={labels} />);

    expect(screen.getByText('No runs yet')).toBeTruthy();
  });

  it('shows a scoped error message with a retry action', async () => {
    const onRetry = vi.fn();
    render(
      <ScheduledTaskRunHistoryList
        items={[]}
        error={new Error('failed')}
        onRetry={onRetry}
        labels={labels}
      />,
    );

    expect(
      screen.getByText('Failed to load history').getAttribute('role'),
    ).toBe('status');
    expect(screen.queryByRole('alert')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('announces a failure below loaded rows through an alert region mounted with the list', () => {
    const items = [buildRun({ id: 'run_1' })];
    const { rerender } = render(
      <ScheduledTaskRunHistoryList items={items} labels={labels} />,
    );
    const region = screen.getByRole('alert');
    expect(region.textContent).toBe('');

    rerender(
      <ScheduledTaskRunHistoryList
        items={items}
        error={new Error('failed')}
        onRetry={vi.fn()}
        labels={labels}
      />,
    );

    expect(screen.getByRole('alert')).toBe(region);
    expect(region.textContent).toBe('Failed to load history');
  });

  it('marks the row matching currentRunId as current, visually and accessibly', () => {
    render(
      <ScheduledTaskRunHistoryList
        items={[buildRun({ id: 'run_1' }), buildRun({ id: 'run_2' })]}
        currentRunId="run_1"
        labels={labels}
      />,
    );

    const rows = screen.getAllByRole('listitem');
    expect(rows[0].getAttribute('aria-current')).toBe('true');
    expect(rows[0].getAttribute('aria-label')).toContain('Current run');
    expect(rows[1].getAttribute('aria-current')).toBeNull();
  });

  it('does not mark any row as current when currentRunId is not among the loaded items', () => {
    render(
      <ScheduledTaskRunHistoryList
        items={[buildRun({ id: 'run_1' })]}
        currentRunId="run_99"
        labels={labels}
      />,
    );

    expect(
      screen.queryByRole('listitem')?.getAttribute('aria-current'),
    ).toBeNull();
  });

  it('rows are not clickable when onRunClick is not supplied, even with a conversationId', () => {
    render(
      <ScheduledTaskRunHistoryList
        items={[buildRun({ id: 'run_1', conversationId: 'conversations/c1' })]}
        labels={labels}
      />,
    );

    const row = screen.getByRole('listitem');
    expect(row.getAttribute('role')).toBeNull();
  });

  it('invokes onRunClick with the run when a row with a conversationId is clicked', async () => {
    const onRunClick = vi.fn();
    const run = buildRun({ id: 'run_1', conversationId: 'conversations/c1' });
    render(
      <ScheduledTaskRunHistoryList
        items={[run]}
        onRunClick={onRunClick}
        labels={labels}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Succeeded/ }));
    expect(onRunClick).toHaveBeenCalledWith(run);
  });

  it('keeps a clickable row a listitem that holds the row button', () => {
    render(
      <ScheduledTaskRunHistoryList
        items={[buildRun({ id: 'run_1', conversationId: 'conversations/c1' })]}
        onRunClick={vi.fn()}
        labels={labels}
      />,
    );

    const item = screen.getByRole('listitem');
    expect(
      within(item).getByRole('button', { name: /Succeeded/ }),
    ).toBeTruthy();
  });

  it('invokes onRunClick when a row is activated via keyboard', async () => {
    const onRunClick = vi.fn();
    const run = buildRun({ id: 'run_1', conversationId: 'conversations/c1' });
    render(
      <ScheduledTaskRunHistoryList
        items={[run]}
        onRunClick={onRunClick}
        labels={labels}
      />,
    );

    screen.getByRole('button', { name: /Succeeded/ }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onRunClick).toHaveBeenCalledWith(run);
  });

  it('applies styles.rowFocusOutline as the focused row outline color', () => {
    const run = buildRun({ id: 'run_1', conversationId: 'conversations/c1' });
    render(
      <ScheduledTaskRunHistoryList
        items={[run]}
        onRunClick={vi.fn()}
        labels={labels}
        styles={{ rowFocusOutline: '#123456' }}
      />,
    );

    const list = screen.getByRole('list', { name: 'History' });

    expect(list.style.getPropertyValue('--strhl-row-focus-outline')).toBe(
      '#123456',
    );
  });

  it('does not render as clickable, and never invokes onRunClick, when the run has no conversationId', async () => {
    const onRunClick = vi.fn();
    render(
      <ScheduledTaskRunHistoryList
        items={[buildRun({ id: 'run_1' })]}
        onRunClick={onRunClick}
        labels={labels}
      />,
    );

    const row = screen.getByRole('listitem');
    expect(row.getAttribute('role')).toBeNull();
    expect(row.className).not.toContain('cursor-pointer');

    await userEvent.click(row);
    expect(onRunClick).not.toHaveBeenCalled();
  });

  it('folds the unread label into the row accessible name when isUnread is true', () => {
    render(
      <ScheduledTaskRunHistoryList
        items={[buildRun({ id: 'run_1', isUnread: true })]}
        labels={labels}
      />,
    );

    expect(screen.getByRole('listitem', { name: /Unread$/ })).toBeTruthy();
  });

  describe('ScheduledTaskRunHistoryList — expandable failed runs', () => {
    const errorText = 'target request failed with status 502';
    const failedRowName = 'Failed today at 9:01 AM (99s)';
    const conversationId = 'conversations/bucket/.scheduler/sched_123/run_1';

    const getDetailsWrapper = (header: HTMLElement) =>
      // eslint-disable-next-line testing-library/no-node-access -- the inert grid wrapper has no role; its `inert` attribute is the assertion
      header.nextElementSibling as HTMLElement;

    it('renders a collapsed disclosure with a chevron and keeps the error text out of its name', () => {
      render(
        <ScheduledTaskRunHistoryList
          items={[
            buildRun({ status: ScheduledTaskRunStatus.Error, errorText }),
          ]}
          labels={labels}
        />,
      );

      const header = screen.getByRole('button', { name: failedRowName });
      expect(header.getAttribute('aria-expanded')).toBe('false');
      const details = screen.getByRole('region', {
        name: failedRowName,
        hidden: true,
      });
      expect(header.getAttribute('aria-controls')).toBe(details.id);
      expect(details.textContent).toContain(errorText);
      expect(getDetailsWrapper(header).hasAttribute('inert')).toBe(true);
      // eslint-disable-next-line testing-library/no-node-access -- the chevron is aria-hidden; its presence in the end slot is the assertion
      expect(header.querySelector('[data-icon="chevron"]')).toBeTruthy();
    });

    it('toggles the details when the header is clicked, without calling onRunClick', async () => {
      const onRunClick = vi.fn();
      render(
        <ScheduledTaskRunHistoryList
          items={[
            buildRun({
              status: ScheduledTaskRunStatus.Error,
              errorText,
              conversationId,
            }),
          ]}
          onRunClick={onRunClick}
          labels={labels}
        />,
      );

      const header = screen.getByRole('button', { name: failedRowName });
      await userEvent.click(header);

      expect(header.getAttribute('aria-expanded')).toBe('true');
      expect(getDetailsWrapper(header).hasAttribute('inert')).toBe(false);
      expect(screen.getByRole('region', { name: failedRowName })).toBeTruthy();
      // eslint-disable-next-line testing-library/no-node-access -- the chevron's rotation is a CSS-level assertion
      const chevron = header.querySelector('[data-icon="chevron"]');
      expect(chevron?.getAttribute('class')).toContain('rotate-180');

      await userEvent.click(header);
      expect(header.getAttribute('aria-expanded')).toBe('false');
      expect(onRunClick).not.toHaveBeenCalled();
    });

    it('toggles the details with Enter and Space', async () => {
      render(
        <ScheduledTaskRunHistoryList
          items={[
            buildRun({ status: ScheduledTaskRunStatus.Error, errorText }),
          ]}
          labels={labels}
        />,
      );

      const header = screen.getByRole('button', { name: failedRowName });
      header.focus();
      await userEvent.keyboard('{Enter}');
      expect(header.getAttribute('aria-expanded')).toBe('true');
      await userEvent.keyboard(' ');
      expect(header.getAttribute('aria-expanded')).toBe('false');
    });

    it('offers an Open conversation link that calls onRunClick once when the run has a conversation', async () => {
      const onRunClick = vi.fn();
      const run = buildRun({
        status: ScheduledTaskRunStatus.Error,
        errorText,
        conversationId,
      });
      render(
        <ScheduledTaskRunHistoryList
          items={[run]}
          onRunClick={onRunClick}
          labels={{ ...labels, openConversationLabel: 'Open chat' }}
        />,
      );

      await userEvent.click(
        screen.getByRole('button', { name: failedRowName }),
      );
      await userEvent.click(screen.getByRole('button', { name: 'Open chat' }));

      expect(onRunClick).toHaveBeenCalledOnce();
      expect(onRunClick).toHaveBeenCalledWith(run);
    });

    it('defaults the link label to Open conversation', async () => {
      render(
        <ScheduledTaskRunHistoryList
          items={[
            buildRun({
              status: ScheduledTaskRunStatus.Error,
              errorText,
              conversationId,
            }),
          ]}
          onRunClick={vi.fn()}
          labels={labels}
        />,
      );

      await userEvent.click(
        screen.getByRole('button', { name: failedRowName }),
      );
      expect(
        screen.getByRole('button', { name: 'Open conversation' }),
      ).toBeTruthy();
    });

    it('renders no link without a conversation id or without onRunClick', async () => {
      const { rerender } = render(
        <ScheduledTaskRunHistoryList
          items={[
            buildRun({ status: ScheduledTaskRunStatus.Error, errorText }),
          ]}
          onRunClick={vi.fn()}
          labels={labels}
        />,
      );
      await userEvent.click(
        screen.getByRole('button', { name: failedRowName }),
      );
      expect(
        screen.queryByRole('button', { name: 'Open conversation' }),
      ).toBeNull();

      rerender(
        <ScheduledTaskRunHistoryList
          items={[
            buildRun({
              status: ScheduledTaskRunStatus.Error,
              errorText,
              conversationId,
            }),
          ]}
          labels={labels}
        />,
      );
      expect(
        screen.queryByRole('button', { name: 'Open conversation' }),
      ).toBeNull();
    });

    it('keeps an Error row without errorText a plain row with no chevron', () => {
      render(
        <ScheduledTaskRunHistoryList
          items={[buildRun({ status: ScheduledTaskRunStatus.Error })]}
          labels={labels}
        />,
      );

      const row = screen.getByRole('listitem', { name: failedRowName });
      expect(screen.queryByRole('button')).toBeNull();
      expect(screen.queryByRole('region', { hidden: true })).toBeNull();
      // eslint-disable-next-line testing-library/no-node-access -- the chevron is aria-hidden; its absence is the assertion
      expect(row.querySelector('[data-icon="chevron"]')).toBeNull();
    });

    it('ignores errorText on a non-Error row', () => {
      render(
        <ScheduledTaskRunHistoryList
          items={[
            buildRun({ status: ScheduledTaskRunStatus.Success, errorText }),
          ]}
          labels={labels}
        />,
      );

      expect(screen.queryByText(errorText)).toBeNull();
      expect(
        screen.getByRole('listitem', {
          name: 'Succeeded today at 9:01 AM (99s)',
        }),
      ).toBeTruthy();
    });

    it('shows the chevron instead of the dot on an unread failed run and keeps the unread suffix', () => {
      render(
        <ScheduledTaskRunHistoryList
          items={[
            buildRun({
              status: ScheduledTaskRunStatus.Error,
              errorText,
              isUnread: true,
            }),
          ]}
          labels={labels}
        />,
      );

      const header = screen.getByRole('button', {
        name: `${failedRowName} — Unread`,
      });
      // eslint-disable-next-line testing-library/no-node-access -- the end slot is aria-hidden decoration; its contents are the assertion
      const endSlot = header.lastElementChild as HTMLElement;
      // eslint-disable-next-line testing-library/no-node-access -- see above
      expect(endSlot.querySelector('[data-icon="chevron"]')).toBeTruthy();
      // eslint-disable-next-line testing-library/no-node-access -- see above
      expect(endSlot.querySelector('.rounded-full')).toBeNull();
      expect(screen.getByText('today at 9:01 AM (99s)').className).toContain(
        'dial-small-paragraph-semi-text',
      );
    });

    it('keeps a row expanded when more runs are appended', async () => {
      const failed = buildRun({
        id: 'run_failed',
        status: ScheduledTaskRunStatus.Error,
        errorText,
      });
      const { rerender } = render(
        <ScheduledTaskRunHistoryList items={[failed]} labels={labels} />,
      );
      await userEvent.click(
        screen.getByRole('button', { name: failedRowName }),
      );

      rerender(
        <ScheduledTaskRunHistoryList
          items={[
            { ...failed },
            buildRun({
              id: 'run_older',
              status: ScheduledTaskRunStatus.Error,
              errorText: 'older failure',
              timestampLabel: 'Jun 26 at 9:46 AM',
            }),
          ]}
          labels={labels}
        />,
      );

      expect(
        screen
          .getByRole('button', { name: failedRowName })
          .getAttribute('aria-expanded'),
      ).toBe('true');
      expect(
        screen
          .getByRole('button', { name: 'Failed Jun 26 at 9:46 AM' })
          .getAttribute('aria-expanded'),
      ).toBe('false');
    });

    it('applies the error-details typography and color overrides', async () => {
      render(
        <ScheduledTaskRunHistoryList
          items={[
            buildRun({ status: ScheduledTaskRunStatus.Error, errorText }),
          ]}
          labels={labels}
          styles={{
            typography: { errorDetailsClassName: 'custom-details' },
            colors: { errorDetailsTextColor: '#111111' },
            rowExpandedBackground: '#222222',
          }}
        />,
      );

      const text = screen.getByText(errorText);
      expect(text.className).toContain('custom-details');
      expect(text.className).toMatch(/errorDetailsText/);
      const list = screen.getByRole('list', { name: 'History' });
      expect(list.style.getPropertyValue('--strhl-error-details-text')).toBe(
        '#111111',
      );
      expect(list.style.getPropertyValue('--strhl-row-expanded-bg')).toBe(
        '#222222',
      );

      const header = screen.getByRole('button', { name: failedRowName });
      expect(header.className).not.toMatch(/expandedRow/);
      await userEvent.click(header);
      expect(header.className).toMatch(/expandedRow/);
    });

    it('defaults the error details to the tiny text step', () => {
      render(
        <ScheduledTaskRunHistoryList
          items={[
            buildRun({ status: ScheduledTaskRunStatus.Error, errorText }),
          ]}
          labels={labels}
        />,
      );

      expect(screen.getByText(errorText).className).toContain('dial-tiny-text');
    });
  });

  it('gives hover feedback to navigable and expandable rows but not to static rows', () => {
    render(
      <ScheduledTaskRunHistoryList
        items={[
          buildRun({ id: 'run_1', conversationId: 'conversations/c1' }),
          buildRun({
            id: 'run_2',
            status: ScheduledTaskRunStatus.Error,
            errorText: 'boom',
            timestampLabel: 'Jul 10 at 9:46 AM',
          }),
          buildRun({ id: 'run_3', timestampLabel: 'Jul 3 at 9:46 AM' }),
        ]}
        onRunClick={vi.fn()}
        labels={labels}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Succeeded today at 9:01 AM (99s)' })
        .className,
    ).toMatch(/interactiveRow/);
    expect(
      screen.getByRole('button', { name: 'Failed Jul 10 at 9:46 AM' })
        .className,
    ).toMatch(/interactiveRow/);
    expect(
      screen.getByRole('listitem', { name: 'Succeeded Jul 3 at 9:46 AM' })
        .className,
    ).not.toMatch(/interactiveRow/);
  });

  it('keeps the status icon first and the end slot last under RTL', () => {
    render(
      <div dir="rtl">
        <ScheduledTaskRunHistoryList
          items={[
            buildRun({
              status: ScheduledTaskRunStatus.Error,
              errorText: 'boom',
            }),
          ]}
          labels={labels}
        />
      </div>,
    );

    const header = screen.getByRole('button', {
      name: 'Failed today at 9:01 AM (99s)',
    });
    /* DOM order stays start → end; `dir` flips it visually, and the chevron is never mirrored. */
    // eslint-disable-next-line testing-library/no-node-access -- row-internal child order has no semantic query
    const startGroup = header.firstElementChild as HTMLElement;
    // eslint-disable-next-line testing-library/no-node-access -- see above
    const chevron = header.lastElementChild?.querySelector(
      '[data-icon="chevron"]',
    );
    // eslint-disable-next-line testing-library/no-node-access -- see above
    expect(startGroup.querySelector('[data-icon="error"]')).toBeTruthy();
    expect(chevron?.getAttribute('class')).not.toContain('rtl:');
  });

  it('uses a custom unreadIndicatorLabel when provided', () => {
    render(
      <ScheduledTaskRunHistoryList
        items={[buildRun({ id: 'run_1', isUnread: true })]}
        labels={{ ...labels, unreadIndicatorLabel: 'New task' }}
      />,
    );

    expect(screen.getByRole('listitem', { name: /New task$/ })).toBeTruthy();
    expect(screen.queryByRole('listitem', { name: /Unread$/ })).toBeNull();
  });

  it('does not append an unread suffix when isUnread is false or omitted', () => {
    render(
      <ScheduledTaskRunHistoryList
        items={[buildRun({ id: 'run_1', isUnread: false })]}
        labels={labels}
      />,
    );

    expect(
      screen.getByRole('listitem', {
        name: 'Succeeded today at 9:01 AM (99s)',
      }),
    ).toBeTruthy();
  });

  it('renders a not-yet-viewed row timestamp semibold and a viewed one regular', () => {
    render(
      <ScheduledTaskRunHistoryList
        items={[
          buildRun({
            id: 'run_1',
            isUnread: true,
            timestampLabel: 'today at 9:01 AM',
          }),
          buildRun({
            id: 'run_2',
            isUnread: false,
            timestampLabel: 'Jul 10 at 9:46 AM',
          }),
        ]}
        labels={labels}
      />,
    );

    expect(screen.getByText('today at 9:01 AM').className).toContain(
      'dial-small-paragraph-semi-text',
    );
    expect(screen.getByText('Jul 10 at 9:46 AM').className).toContain(
      'dial-small-paragraph-text',
    );
  });

  it('lets a host override the viewed and not-yet-viewed timestamp classes', () => {
    render(
      <ScheduledTaskRunHistoryList
        items={[buildRun({ id: 'run_1', isUnread: true })]}
        labels={labels}
        styles={{
          typography: {
            runTimestampClassName: 'custom-viewed',
            runTimestampUnreadClassName: 'custom-unread',
          },
        }}
      />,
    );

    expect(screen.getByText('today at 9:01 AM (99s)').className).toContain(
      'custom-unread',
    );
  });

  it('renders the status icon before the timestamp at the kit stroke scale, and the unread dot at the row end', () => {
    render(
      <ScheduledTaskRunHistoryList
        items={[buildRun({ id: 'run_1', isUnread: true })]}
        labels={labels}
      />,
    );

    const row = screen.getByRole('listitem', { name: /Unread$/ });
    // eslint-disable-next-line testing-library/no-node-access -- row-internal child order has no semantic query
    const startGroup = row.firstElementChild as HTMLElement;
    // eslint-disable-next-line testing-library/no-node-access -- row-internal child order has no semantic query
    const endSlot = row.lastElementChild as HTMLElement;

    // eslint-disable-next-line testing-library/no-node-access -- the status icon has no accessible name; its position and stroke are the assertion
    const icon = startGroup.querySelector('[data-icon="success"]');
    expect(icon).toBeTruthy();
    expect(icon?.getAttribute('stroke')).toBe(`${DIAL_KIT_ICON_STROKE}`);
    expect(icon?.getAttribute('size')).toBe(`${DIAL_ICON_SIZE.SM}`);
    /* The pill carries the design's 12px horizontal padding on both sides. */
    expect(row.className).toContain('px-3');
    expect(row.className).not.toContain('pe-2');
    /* The timestamp follows the icon inside the same start group. */
    expect(startGroup.textContent).toContain('today at 9:01 AM (99s)');
    /* The unread dot renders inside the reserved end slot. */
    expect(endSlot.firstElementChild?.className).toContain('rounded-full');
  });

  it('renders the supplied footer after the rows', () => {
    render(
      <ScheduledTaskRunHistoryList
        items={[buildRun({ id: 'run_1' })]}
        labels={labels}
        footer={<li data-testid-footer="show-more">Show more</li>}
      />,
    );

    expect(screen.getByText('Show more')).toBeTruthy();
  });

  it('appends loading-more skeletons below the loaded rows', () => {
    const { container } = render(
      <ScheduledTaskRunHistoryList
        items={[buildRun({ id: 'run_1' })]}
        isLoadingMore
        labels={labels}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(
      screen.getAllByRole('listitem', { hidden: true }).length,
    ).toBeGreaterThan(1);
    expect(
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- skeleton rows are plain divs with no accessible role/text; only their data-skeleton CSS hook distinguishes them
      container.querySelectorAll('[data-skeleton]').length,
    ).toBeGreaterThan(0);
  });

  it('keeps already-loaded rows visible and shows an inline retry notice when a loadMore fails', async () => {
    const onRetry = vi.fn();
    render(
      <ScheduledTaskRunHistoryList
        items={[buildRun({ id: 'run_1' })]}
        error={new Error('failed')}
        onRetry={onRetry}
        labels={labels}
        footer={<li>Show more</li>}
      />,
    );

    expect(screen.getByText('today at 9:01 AM (99s)')).toBeTruthy();
    expect(
      within(screen.getByRole('list')).getByText('Failed to load history'),
    ).toBeTruthy();
    expect(screen.queryByText('Show more')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
