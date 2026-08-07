import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  Spinner: () => <div role="progressbar" />,
  DialSkeleton: (props: Record<string, unknown>) => (
    <div data-skeleton {...props} />
  ),
  DialSkeletonVariant: { Default: 'default', Rectangular: 'rectangular' },
  GhostButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick?: () => void;
  }) => <button onClick={onClick}>{label}</button>,
  GhostIconButton: ({
    onClick,
    'aria-label': ariaLabel,
  }: {
    onClick: () => void;
    icon?: ReactNode;
    'aria-label'?: string;
  }) => <button onClick={onClick} aria-label={ariaLabel} />,
}));

vi.mock('@tabler/icons-react', () => ({
  IconArrowLeft: () => <svg />,
  IconCircleCheck: () => <svg data-icon="success" />,
  IconCircleX: () => <svg data-icon="error" />,
  IconAlertTriangle: () => <svg data-icon="missed" />,
}));

const labels: ScheduledTaskDetailViewLabels = {
  backAriaLabel: 'Back',
  errorLabel: 'Failed to load the scheduled task',
  detailsTitle: 'Details',
  descriptionLabel: 'Description',
  modelLabel: 'Model or Agent',
  repeatsLabel: 'Repeats',
  activeWindowLabel: 'Active',
  configurationTitle: 'Configuration',
  instructionsLabel: 'Instructions',
  retryLabel: 'Retry',
  historyTitle: 'History',
  historyEmptyLabel: 'No runs yet',
  historyErrorLabel: 'Failed to load history',
  historyRetryLabel: 'Retry',
  historyLoadingMoreLabel: 'Loading more…',
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

  describe('scroll-sentinel triggered load-more', () => {
    const mockScrollableAncestor = () => {
      const getComputedStyleSpy = vi
        .spyOn(window, 'getComputedStyle')
        .mockImplementation(
          (el) =>
            ({
              overflow: 'visible',
              overflowY: el === document.body ? 'visible' : ('auto' as string),
            }) as CSSStyleDeclaration,
        );
      return () => getComputedStyleSpy.mockRestore();
    };

    const mockIntersecting = (isIntersecting: boolean) => {
      const rect = (top: number, bottom: number) =>
        ({ top, bottom }) as DOMRect;
      const isSentinel = (el: Element) =>
        el.tagName === 'LI' && el.getAttribute('aria-hidden') === 'true';
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
        function (this: Element) {
          if (isSentinel(this)) {
            return isIntersecting ? rect(700, 750) : rect(900, 950);
          }
          return rect(0, 800);
        },
      );
    };

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('calls onRunsLoadMore when the sentinel intersects and runsHasMore is true', () => {
      const restoreStyle = mockScrollableAncestor();
      mockIntersecting(true);
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

      expect(onRunsLoadMore).toHaveBeenCalledOnce();
      restoreStyle();
    });

    it('does not call onRunsLoadMore when runsHasMore is false', () => {
      const restoreStyle = mockScrollableAncestor();
      mockIntersecting(true);
      const onRunsLoadMore = vi.fn();

      render(
        <ScheduledTaskDetailView
          labels={labels}
          onBack={vi.fn()}
          displayName="Daily summary"
          runs={[buildRun()]}
          runsHasMore={false}
          onRunsLoadMore={onRunsLoadMore}
        />,
      );

      expect(onRunsLoadMore).not.toHaveBeenCalled();
      restoreStyle();
    });

    it('does not call onRunsLoadMore while runsIsLoadingMore is true', () => {
      const restoreStyle = mockScrollableAncestor();
      mockIntersecting(true);
      const onRunsLoadMore = vi.fn();

      render(
        <ScheduledTaskDetailView
          labels={labels}
          onBack={vi.fn()}
          displayName="Daily summary"
          runs={[buildRun()]}
          runsHasMore
          runsIsLoadingMore
          onRunsLoadMore={onRunsLoadMore}
        />,
      );

      expect(onRunsLoadMore).not.toHaveBeenCalled();
      restoreStyle();
    });

    it('does not call onRunsLoadMore when the sentinel is not intersecting', () => {
      const restoreStyle = mockScrollableAncestor();
      mockIntersecting(false);
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

      expect(onRunsLoadMore).not.toHaveBeenCalled();
      restoreStyle();
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
