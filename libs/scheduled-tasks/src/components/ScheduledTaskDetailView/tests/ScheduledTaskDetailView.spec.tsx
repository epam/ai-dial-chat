import { readFileSync } from 'fs';
import { join } from 'path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ScheduledTaskDetailViewLabels } from '../../../models/scheduled-task-detail-view-props';
import type { ScheduledTaskRunItem } from '../../../models/scheduled-task-run-item';
import { ScheduledTaskRunStatus } from '../../../types/scheduled-task-run-status';
import { ScheduledTaskDetailView } from '../ScheduledTaskDetailView';

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return {
    ...actual,
    MDMessageViewer: ({ content }: { content: string }) => <div>{content}</div>,
  };
});

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  ButtonVariant: { Primary: 'primary', Neutral: 'neutral' },
  Switch: ({
    id,
    isOn,
    disabled,
    onChange,
    'aria-label': ariaLabel,
  }: {
    id?: string;
    isOn?: boolean;
    disabled?: boolean;
    onChange?: (value: boolean) => void;
    'aria-label'?: string;
  }) => (
    <input
      type="checkbox"
      role="switch"
      id={id}
      aria-label={ariaLabel}
      aria-checked={!!isOn}
      checked={!!isOn}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.checked)}
    />
  ),
  Spinner: () => <div role="progressbar" />,
  Skeleton: (props: Record<string, unknown>) => (
    <div data-skeleton {...props} />
  ),
  SkeletonVariant: { Default: 'default', Rectangular: 'rectangular' },
  GhostButton: ({
    label,
    onClick,
    disabled,
  }: {
    label: string;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  ),
  GhostIconButton: ({
    onClick,
    'aria-label': ariaLabel,
  }: {
    onClick: () => void;
    icon?: ReactNode;
    'aria-label'?: string;
  }) => <button onClick={onClick} aria-label={ariaLabel} />,
  NeutralButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick?: () => void;
  }) => <button onClick={onClick}>{label}</button>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconArrowLeft: () => <svg />,
  IconCircleCheck: () => <svg data-icon="success" />,
  IconCircleX: () => <svg data-icon="error" />,
  IconAlertTriangle: () => <svg data-icon="missed" />,
  IconPencilMinus: () => <svg data-icon="edit" />,
}));

const labels: ScheduledTaskDetailViewLabels = {
  backAriaLabel: 'Back',
  editButtonLabel: 'Edit',
  errorLabel: 'Failed to load the scheduled task',
  detailsTitle: 'Details',
  descriptionLabel: 'Description',
  modelLabel: 'Model or Agent',
  repeatsLabel: 'Repeats',
  activeWindowLabel: 'Active',
  activeStatusLabel: 'Active',
  configurationTitle: 'Configuration',
  instructionsLabel: 'Instructions',
  retryLabel: 'Retry',
  historyTitle: 'History',
  historyEmptyLabel: 'No runs yet',
  historyErrorLabel: 'Failed to load history',
  historyRetryLabel: 'Retry',
  historyLoadingMoreLabel: 'Loading more…',
  historyShowMoreLabel: 'Show more',
  runStatusLabels: {
    [ScheduledTaskRunStatus.Success]: 'Succeeded',
    [ScheduledTaskRunStatus.Error]: 'Failed',
    [ScheduledTaskRunStatus.InProgress]: 'Running',
    [ScheduledTaskRunStatus.Missed]: 'Missed',
  },
};

const buildRun = (
  overrides?: Partial<ScheduledTaskRunItem>,
): ScheduledTaskRunItem => ({
  id: 'run_1',
  status: ScheduledTaskRunStatus.Success,
  timestampLabel: 'today at 9:01 AM (99s)',
  ...overrides,
});

describe('ScheduledTaskDetailView — library isolation', () => {
  it('contains no imports of host apps, generated API clients, routing, feature-flag, auth, env, or analytics modules', () => {
    const source = readFileSync(
      join(__dirname, '../ScheduledTaskDetailView.tsx'),
      'utf-8',
    );

    expect(source).not.toMatch(
      /from ['"](apps\/chat|@epam\/chat-api-client|react-router|react-i18next)/,
    );
  });
});

describe('ScheduledTaskDetailView', () => {
  it('renders the back control and title', () => {
    render(
      <ScheduledTaskDetailView
        labels={labels}
        onBack={vi.fn()}
        displayName="Daily summary"
        runs={[]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Daily summary' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
  });

  it('calls onBack when the back control is activated', async () => {
    const onBack = vi.fn();
    render(
      <ScheduledTaskDetailView
        labels={labels}
        onBack={onBack}
        displayName="Daily summary"
        runs={[]}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledOnce();
  });

  it('does not render an Edit button when onEdit is omitted', () => {
    render(
      <ScheduledTaskDetailView
        labels={labels}
        onBack={vi.fn()}
        displayName="Daily summary"
        runs={[]}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeTruthy();
  });

  it('renders an Edit button when onEdit is supplied', () => {
    render(
      <ScheduledTaskDetailView
        labels={labels}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        displayName="Daily summary"
        runs={[]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
  });

  it('calls onEdit exactly once when the Edit button is activated', async () => {
    const onEdit = vi.fn();
    render(
      <ScheduledTaskDetailView
        labels={labels}
        onBack={vi.fn()}
        onEdit={onEdit}
        displayName="Daily summary"
        runs={[]}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('shows a page-level spinner while isLoading', () => {
    render(
      <ScheduledTaskDetailView
        labels={labels}
        onBack={vi.fn()}
        displayName="Daily summary"
        isLoading
        runs={[]}
      />,
    );

    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByText('Details')).toBeNull();
  });

  it('shows a page-level error with retry, and no Details/History content', async () => {
    const onRetry = vi.fn();
    render(
      <ScheduledTaskDetailView
        labels={labels}
        onBack={vi.fn()}
        displayName="Daily summary"
        error={new Error('Failed to load task')}
        onRetry={onRetry}
        runs={[]}
      />,
    );

    expect(screen.getByText('Failed to load the scheduled task')).toBeTruthy();
    expect(screen.queryByText('Details')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders description, model, and repeats fields when provided', () => {
    render(
      <ScheduledTaskDetailView
        labels={labels}
        onBack={vi.fn()}
        displayName="Daily summary"
        description="Summarizes unread inbox items"
        modelLabel="GPT-4.1 mini"
        repeatsLabel="Every Monday 12:00"
        runs={[]}
      />,
    );

    expect(screen.getByText('Summarizes unread inbox items')).toBeTruthy();
    expect(screen.getByText('GPT-4.1 mini')).toBeTruthy();
    expect(screen.getByText('Every Monday 12:00')).toBeTruthy();
  });

  it('renders the activity-window field when provided', () => {
    render(
      <ScheduledTaskDetailView
        labels={labels}
        onBack={vi.fn()}
        displayName="Daily summary"
        activeWindowLabel="Aug 1, 2026 – Dec 31, 2026"
        runs={[]}
      />,
    );

    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Aug 1, 2026 – Dec 31, 2026')).toBeTruthy();
  });

  it('omits the activity-window field when not provided', () => {
    render(
      <ScheduledTaskDetailView
        labels={labels}
        onBack={vi.fn()}
        displayName="Daily summary"
        runs={[]}
      />,
    );

    expect(screen.queryByText('Active')).toBeNull();
  });

  it('renders the next-run label under the History title when provided', () => {
    render(
      <ScheduledTaskDetailView
        labels={labels}
        onBack={vi.fn()}
        displayName="Daily summary"
        runs={[]}
        nextRunLabel="Next run: Jul 31 at 9:00 AM"
      />,
    );

    expect(screen.getByText('Next run: Jul 31 at 9:00 AM')).toBeTruthy();
  });

  it('omits the next-run label when not provided', () => {
    render(
      <ScheduledTaskDetailView
        labels={labels}
        onBack={vi.fn()}
        displayName="Daily summary"
        runs={[]}
      />,
    );

    expect(screen.queryByText(/Next run/)).toBeNull();
  });

  it('renders instructions markdown via the default MDMessageViewer when renderInstructions is omitted', () => {
    render(
      <ScheduledTaskDetailView
        labels={labels}
        onBack={vi.fn()}
        displayName="Daily summary"
        instructionsMarkdown="# Summarize my inbox"
        runs={[]}
      />,
    );

    expect(screen.getByText('# Summarize my inbox')).toBeTruthy();
  });

  it('delegates instructions rendering to renderInstructions when supplied', () => {
    const renderInstructions = vi.fn((markdown: string) => (
      <div>custom:{markdown}</div>
    ));
    render(
      <ScheduledTaskDetailView
        labels={labels}
        onBack={vi.fn()}
        displayName="Daily summary"
        instructionsMarkdown="Summarize my inbox"
        renderInstructions={renderInstructions}
        runs={[]}
      />,
    );

    expect(renderInstructions).toHaveBeenCalledWith('Summarize my inbox');
    expect(screen.getByText('custom:Summarize my inbox')).toBeTruthy();
  });

  it('shows exactly 6 skeleton rows during initial history load', () => {
    const { container } = render(
      <ScheduledTaskDetailView
        labels={labels}
        onBack={vi.fn()}
        displayName="Daily summary"
        runs={[]}
        runsIsLoading
      />,
    );

    expect(
      container.querySelectorAll('li[aria-hidden="true"] [data-skeleton]'),
    ).toHaveLength(12); // 2 skeleton bars per row × 6 rows
  });

  it('shows the empty-history message when there are no runs and not loading', () => {
    render(
      <ScheduledTaskDetailView
        labels={labels}
        onBack={vi.fn()}
        displayName="Daily summary"
        runs={[]}
      />,
    );

    expect(screen.getByText('No runs yet')).toBeTruthy();
  });

  it('shows the history error state with retry', async () => {
    const onRunsRetry = vi.fn();
    render(
      <ScheduledTaskDetailView
        labels={labels}
        onBack={vi.fn()}
        displayName="Daily summary"
        runs={[]}
        runsError={new Error('boom')}
        onRunsRetry={onRunsRetry}
      />,
    );

    expect(screen.getByText('Failed to load history')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRunsRetry).toHaveBeenCalledOnce();
  });

  it('renders each run row with a status icon and an accessible name including status and timestamp', () => {
    render(
      <ScheduledTaskDetailView
        labels={labels}
        onBack={vi.fn()}
        displayName="Daily summary"
        runs={[
          buildRun({ id: 'r1', status: ScheduledTaskRunStatus.Success }),
          buildRun({ id: 'r2', status: ScheduledTaskRunStatus.Error }),
          buildRun({ id: 'r3', status: ScheduledTaskRunStatus.Missed }),
        ]}
      />,
    );

    expect(
      screen.getByLabelText('Succeeded today at 9:01 AM (99s)'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Failed today at 9:01 AM (99s)')).toBeTruthy();
    expect(screen.getByLabelText('Missed today at 9:01 AM (99s)')).toBeTruthy();
  });

  it('shows 6 trailing skeleton rows during load-more, below the loaded runs', () => {
    const { container } = render(
      <ScheduledTaskDetailView
        labels={labels}
        onBack={vi.fn()}
        displayName="Daily summary"
        runs={[buildRun()]}
        runsIsLoadingMore
        runsHasMore
      />,
    );

    expect(
      container.querySelectorAll('li[aria-hidden="true"] [data-skeleton]'),
    ).toHaveLength(12);
    expect(
      screen.getByLabelText('Succeeded today at 9:01 AM (99s)'),
    ).toBeTruthy();
  });

  it('renders no interactive semantics on a run row when onRunClick is omitted', () => {
    render(
      <ScheduledTaskDetailView
        labels={labels}
        onBack={vi.fn()}
        displayName="Daily summary"
        runs={[buildRun()]}
      />,
    );

    expect(
      screen.queryByRole('button', {
        name: 'Succeeded today at 9:01 AM (99s)',
      }),
    ).toBeNull();
  });

  describe('"Show more" button triggered load-more', () => {
    it('renders a "Show more" button and calls onRunsLoadMore when activated, while runsHasMore is true', async () => {
      const onRunsLoadMore = vi.fn();

      render(
        <ScheduledTaskDetailView
          labels={labels}
          onBack={vi.fn()}
          displayName="Daily summary"
          runs={[buildRun()]}
          runsHasMore
          onRunsLoadMore={onRunsLoadMore}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: 'Show more' }));
      expect(onRunsLoadMore).toHaveBeenCalledOnce();
    });

    it('does not render the "Show more" button when runsHasMore is false', () => {
      render(
        <ScheduledTaskDetailView
          labels={labels}
          onBack={vi.fn()}
          displayName="Daily summary"
          runs={[buildRun()]}
          runsHasMore={false}
          onRunsLoadMore={vi.fn()}
        />,
      );

      expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    });

    it('does not render the "Show more" button when onRunsLoadMore is omitted', () => {
      render(
        <ScheduledTaskDetailView
          labels={labels}
          onBack={vi.fn()}
          displayName="Daily summary"
          runs={[buildRun()]}
          runsHasMore
        />,
      );

      expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    });

    it('disables the "Show more" button while runsIsLoadingMore is true', () => {
      render(
        <ScheduledTaskDetailView
          labels={labels}
          onBack={vi.fn()}
          displayName="Daily summary"
          runs={[buildRun()]}
          runsHasMore
          runsIsLoadingMore
          onRunsLoadMore={vi.fn()}
        />,
      );

      expect(
        (screen.getByRole('button', { name: 'Show more' }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
    });

    it('does not render the "Show more" button when historyShowMoreLabel is omitted', () => {
      render(
        <ScheduledTaskDetailView
          labels={{ ...labels, historyShowMoreLabel: undefined }}
          onBack={vi.fn()}
          displayName="Daily summary"
          runs={[buildRun()]}
          runsHasMore
          onRunsLoadMore={vi.fn()}
        />,
      );

      expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    });
  });

  describe('Active switch', () => {
    it('does not render when isActive is undefined', () => {
      render(
        <ScheduledTaskDetailView
          labels={labels}
          onBack={vi.fn()}
          onEdit={vi.fn()}
          displayName="Daily summary"
          runs={[]}
        />,
      );

      expect(screen.queryByRole('switch')).toBeNull();
    });

    it('renders checked when isActive is true', () => {
      render(
        <ScheduledTaskDetailView
          labels={labels}
          onBack={vi.fn()}
          displayName="Daily summary"
          isActive={true}
          runs={[]}
        />,
      );

      expect(screen.getByRole('switch')).toHaveProperty('checked', true);
    });

    it('renders unchecked when isActive is false', () => {
      render(
        <ScheduledTaskDetailView
          labels={labels}
          onBack={vi.fn()}
          displayName="Daily summary"
          isActive={false}
          runs={[]}
        />,
      );

      expect(screen.getByRole('switch')).toHaveProperty('checked', false);
    });

    it('calls onActiveChange exactly once with the requested value on toggle, with no navigation or network side effects', async () => {
      const onActiveChange = vi.fn();
      render(
        <ScheduledTaskDetailView
          labels={labels}
          onBack={vi.fn()}
          displayName="Daily summary"
          isActive={true}
          onActiveChange={onActiveChange}
          runs={[]}
        />,
      );

      await userEvent.click(screen.getByRole('switch'));

      expect(onActiveChange).toHaveBeenCalledOnce();
      expect(onActiveChange).toHaveBeenCalledWith(false);
    });

    it('renders disabled while isActiveUpdating is true', () => {
      render(
        <ScheduledTaskDetailView
          labels={labels}
          onBack={vi.fn()}
          displayName="Daily summary"
          isActive={true}
          isActiveUpdating
          runs={[]}
        />,
      );

      expect(screen.getByRole('switch')).toHaveProperty('disabled', true);
    });

    it('renders disabled while isActiveDisabled is true', () => {
      render(
        <ScheduledTaskDetailView
          labels={labels}
          onBack={vi.fn()}
          displayName="Daily summary"
          isActive={false}
          isActiveDisabled
          runs={[]}
        />,
      );

      expect(screen.getByRole('switch')).toHaveProperty('disabled', true);
    });

    it('does not call onActiveChange when interacted with while disabled', async () => {
      const onActiveChange = vi.fn();
      render(
        <ScheduledTaskDetailView
          labels={labels}
          onBack={vi.fn()}
          displayName="Daily summary"
          isActive={false}
          isActiveDisabled
          onActiveChange={onActiveChange}
          runs={[]}
        />,
      );

      await userEvent.click(screen.getByRole('switch'));

      expect(onActiveChange).not.toHaveBeenCalled();
    });

    it('renders before the Edit button in DOM order', () => {
      render(
        <ScheduledTaskDetailView
          labels={labels}
          onBack={vi.fn()}
          onEdit={vi.fn()}
          displayName="Daily summary"
          isActive={true}
          runs={[]}
        />,
      );

      const switchEl = screen.getByRole('switch');
      const editButton = screen.getByRole('button', { name: 'Edit' });
      expect(
        switchEl.compareDocumentPosition(editButton) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('announces a status message via an aria-live region, separate from the switch label', () => {
      render(
        <ScheduledTaskDetailView
          labels={{
            ...labels,
            activeStatusAnnouncement: 'Task paused',
          }}
          onBack={vi.fn()}
          displayName="Daily summary"
          isActive={false}
          runs={[]}
        />,
      );

      const announcement = screen.getByText('Task paused');
      expect(announcement.getAttribute('role')).toBe('status');
    });
  });

  it('invokes onRunClick with the run id when a row is clicked, when supplied', async () => {
    const onRunClick = vi.fn();
    render(
      <ScheduledTaskDetailView
        labels={labels}
        onBack={vi.fn()}
        displayName="Daily summary"
        runs={[buildRun()]}
        onRunClick={onRunClick}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Succeeded today at 9:01 AM (99s)' }),
    );

    expect(onRunClick).toHaveBeenCalledWith('run_1');
  });
});
