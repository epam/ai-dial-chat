import {
  ConversationTransferJobStatus,
  ConversationTransferSubjectKind,
  type ConversationTransferJob,
} from '@epam/ai-dial-chat-shared';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CSSProperties, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  ImportExportQueue,
  type ImportExportQueueLabels,
  type ImportExportQueueStyles,
} from '../ImportExportQueue';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  ProgressBar: ({
    value,
    'aria-label': ariaLabel,
  }: {
    value: number;
    'aria-label'?: string;
  }) => <div data-progress={value} aria-label={ariaLabel} />,
  GhostIconButton: ({
    'aria-label': ariaLabel,
    onClick,
    className,
  }: {
    'aria-label'?: string;
    onClick?: () => void;
    className?: string;
  }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={className}
    />
  ),
  ElementSize: { Small: 'small', Standard: 'standard', Large: 'large' },
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  ConfirmationPopup: ({
    open,
    header,
    description,
    confirmLabel,
    onConfirm,
    onClose,
  }: {
    open: boolean;
    header: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
    onClose: () => void;
  }) => {
    if (!open) return null;
    return (
      <div role="dialog">
        <span>{header}</span>
        <span>{description}</span>
        <button onClick={onConfirm}>{confirmLabel}</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    );
  },
  ConfirmationPopupVariant: { Danger: 'danger', Info: 'info' },
  EllipsisTooltip: ({
    text,
    className,
  }: {
    text: ReactNode;
    className?: string;
  }) => <span className={className}>{text}</span>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconX: () => null,
  IconCircleCheckFilled: () => null,
  IconRefresh: () => null,
  IconAlertCircleFilled: () => null,
  IconChevronDown: () => null,
  IconChevronUp: () => null,
}));

const DEFAULT_LABELS: ImportExportQueueLabels = {
  allConversationsJobLabel: 'All conversations',
  closeJobAriaLabel: (title) => `Dismiss ${title}`,
  retryJobAriaLabel: (title) => `Retry ${title}`,
  collapseQueueAriaLabel: 'Collapse queue',
  expandQueueAriaLabel: 'Expand queue',
  closeQueueAriaLabel: 'Close queue',
  closeQueueConfirmHeader: 'Close queue?',
  closeQueueConfirmDescriptionInProgress: 'Jobs are still in progress.',
  closeQueueConfirmDescriptionFailed: 'Some jobs have failed.',
  closeQueueConfirmDescriptionMixed: 'Some jobs are in progress or failed.',
  closeLabel: 'Close',
  cancelLabel: 'Cancel',
};

const makeJob = ({
  id = 'job-1',
  title = 'My Chat',
  description,
  status = ConversationTransferJobStatus.InProgress,
}: {
  id?: string;
  title?: string;
  description?: string;
  status?: ConversationTransferJobStatus;
} = {}): ConversationTransferJob => ({
  id,
  subject: {
    kind: ConversationTransferSubjectKind.Single,
    title,
    sourceBreadcrumb: description,
  },
  status,
});

const TITLE = 'Exporting';

describe('ImportExportQueue', () => {
  const user = userEvent.setup({ delay: null });

  const renderQueue = (
    jobs: ConversationTransferJob[],
    props: Partial<{
      onDismiss: (id: string) => void;
      onRetry: (id: string) => void;
      onClose: () => void;
      labels: ImportExportQueueLabels;
      styles: ImportExportQueueStyles;
    }> = {},
  ) =>
    render(
      <ImportExportQueue
        title={TITLE}
        jobs={jobs}
        onDismiss={props.onDismiss ?? vi.fn()}
        onRetry={props.onRetry ?? vi.fn()}
        onClose={props.onClose ?? vi.fn()}
        labels={props.labels ?? DEFAULT_LABELS}
        styles={props.styles}
      />,
    );

  it('renders nothing when there are no jobs', () => {
    renderQueue([]);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders the panel with a status region and every job label', () => {
    renderQueue([
      makeJob({ id: 'a', title: 'Chat A' }),
      makeJob({
        id: 'b',
        title: 'Chat B',
        status: ConversationTransferJobStatus.Success,
      }),
    ]);
    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(screen.getByText('Chat A')).toBeTruthy();
    expect(screen.getByText('Chat B')).toBeTruthy();
  });

  it('never renders a dialog role — it is not a modal', () => {
    renderQueue([makeJob()]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders job rows without divider borders between them', () => {
    renderQueue([makeJob({ id: 'a' }), makeJob({ id: 'b' })]);
    /* CSS-level assertion — no semantic query applies. */
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector('.divide-y')).toBeNull();
  });

  it('shows aggregate progress as the fraction of finished jobs', () => {
    renderQueue([
      makeJob({ id: 'a', status: ConversationTransferJobStatus.Success }),
      makeJob({ id: 'b', status: ConversationTransferJobStatus.InProgress }),
      makeJob({ id: 'c', status: ConversationTransferJobStatus.Failed }),
      makeJob({ id: 'd', status: ConversationTransferJobStatus.InProgress }),
    ]);
    // 2 of 4 jobs finished (success or failed) = 50%
    /* CSS-level assertion — no semantic query applies. */
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector('[data-progress="50"]')).toBeTruthy();
  });

  it('clicking close on an in-progress job calls onDismiss with its id', async () => {
    const onDismiss = vi.fn();
    renderQueue([makeJob({ id: 'job-x', title: 'Chat X' })], { onDismiss });

    await user.click(screen.getByRole('button', { name: 'Dismiss Chat X' }));

    expect(onDismiss).toHaveBeenCalledWith('job-x');
  });

  it('a successful job does not show a per-job close button', () => {
    renderQueue([
      makeJob({
        id: 'job-y',
        title: 'Chat Y',
        status: ConversationTransferJobStatus.Success,
      }),
    ]);

    expect(screen.queryByRole('button', { name: 'Dismiss Chat Y' })).toBeNull();
  });

  it('a failed job shows a retry button but no per-job close button', async () => {
    const onRetry = vi.fn();
    renderQueue(
      [
        makeJob({
          id: 'job-z',
          title: 'Chat Z',
          status: ConversationTransferJobStatus.Failed,
        }),
      ],
      { onRetry },
    );

    await user.click(screen.getByRole('button', { name: 'Retry Chat Z' }));
    expect(onRetry).toHaveBeenCalledWith('job-z');

    expect(screen.queryByRole('button', { name: 'Dismiss Chat Z' })).toBeNull();
  });

  it('collapsing the panel hides job rows without removing the header', async () => {
    renderQueue([makeJob({ title: 'Chat A' })]);

    expect(screen.getByText('Chat A')).toBeTruthy();

    await user.click(
      screen.getByRole('button', {
        name: DEFAULT_LABELS.collapseQueueAriaLabel,
      }),
    );

    expect(screen.queryByText('Chat A')).toBeNull();
    expect(screen.getByText(TITLE)).toBeTruthy();

    await user.click(
      screen.getByRole('button', { name: DEFAULT_LABELS.expandQueueAriaLabel }),
    );
    expect(screen.getByText('Chat A')).toBeTruthy();
  });

  it('clicking close when all jobs succeeded calls onClose directly', async () => {
    const onClose = vi.fn();
    renderQueue([makeJob({ status: ConversationTransferJobStatus.Success })], {
      onClose,
    });

    await user.click(
      screen.getByRole('button', { name: DEFAULT_LABELS.closeQueueAriaLabel }),
    );

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('clicking close with an in-progress job shows the confirmation dialog with the in-progress message', async () => {
    const onClose = vi.fn();
    renderQueue(
      [makeJob({ status: ConversationTransferJobStatus.InProgress })],
      { onClose },
    );

    await user.click(
      screen.getByRole('button', { name: DEFAULT_LABELS.closeQueueAriaLabel }),
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(
      screen.getByText(DEFAULT_LABELS.closeQueueConfirmDescriptionInProgress),
    ).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('clicking close with a failed job shows the confirmation dialog with the failed message', async () => {
    const onClose = vi.fn();
    renderQueue([makeJob({ status: ConversationTransferJobStatus.Failed })], {
      onClose,
    });

    await user.click(
      screen.getByRole('button', { name: DEFAULT_LABELS.closeQueueAriaLabel }),
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(
      screen.getByText(DEFAULT_LABELS.closeQueueConfirmDescriptionFailed),
    ).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('clicking close with both an in-progress and a failed job shows the mixed message', async () => {
    const onClose = vi.fn();
    renderQueue(
      [
        makeJob({ id: 'a', status: ConversationTransferJobStatus.InProgress }),
        makeJob({ id: 'b', status: ConversationTransferJobStatus.Failed }),
      ],
      { onClose },
    );

    await user.click(
      screen.getByRole('button', { name: DEFAULT_LABELS.closeQueueAriaLabel }),
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(
      screen.getByText(DEFAULT_LABELS.closeQueueConfirmDescriptionMixed),
    ).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('confirming the dialog calls onClose', async () => {
    const onClose = vi.fn();
    renderQueue(
      [makeJob({ status: ConversationTransferJobStatus.InProgress })],
      { onClose },
    );

    await user.click(
      screen.getByRole('button', { name: DEFAULT_LABELS.closeQueueAriaLabel }),
    );
    await user.click(
      screen.getByRole('button', { name: DEFAULT_LABELS.closeLabel }),
    );

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not reopen the confirmation dialog when a new job arrives after confirming', async () => {
    const onClose = vi.fn();
    const { rerender } = renderQueue(
      [
        makeJob({
          id: 'job-1',
          status: ConversationTransferJobStatus.InProgress,
        }),
      ],
      { onClose },
    );

    await user.click(
      screen.getByRole('button', { name: DEFAULT_LABELS.closeQueueAriaLabel }),
    );
    expect(screen.getByRole('dialog')).toBeTruthy();

    await user.click(
      screen.getByRole('button', { name: DEFAULT_LABELS.closeLabel }),
    );
    expect(onClose).toHaveBeenCalledOnce();

    /* Parent clears jobs in response to onClose — component stays mounted, renders null. */
    rerender(
      <ImportExportQueue
        title={TITLE}
        jobs={[]}
        onDismiss={vi.fn()}
        onRetry={vi.fn()}
        onClose={onClose}
        labels={DEFAULT_LABELS}
      />,
    );
    expect(screen.queryByRole('status')).toBeNull();

    /* A new export starts — the panel reappears and must not reopen the stale confirmation. */
    rerender(
      <ImportExportQueue
        title={TITLE}
        jobs={[
          makeJob({
            id: 'job-2',
            status: ConversationTransferJobStatus.InProgress,
          }),
        ]}
        onDismiss={vi.fn()}
        onRetry={vi.fn()}
        onClose={onClose}
        labels={DEFAULT_LABELS}
      />,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('cancelling the dialog closes it without calling onClose', async () => {
    const onClose = vi.fn();
    renderQueue(
      [makeJob({ status: ConversationTransferJobStatus.InProgress })],
      { onClose },
    );

    await user.click(
      screen.getByRole('button', { name: DEFAULT_LABELS.closeQueueAriaLabel }),
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a failed count badge when at least one job has failed', () => {
    renderQueue([
      makeJob({ id: 'a', status: ConversationTransferJobStatus.Failed }),
      makeJob({ id: 'b', status: ConversationTransferJobStatus.InProgress }),
    ]);

    expect(screen.getByText('1')).toBeTruthy();
  });

  it('does not show the failed count badge when no jobs have failed', () => {
    renderQueue([
      makeJob({ id: 'a', status: ConversationTransferJobStatus.Success }),
      makeJob({ id: 'b', status: ConversationTransferJobStatus.InProgress }),
    ]);

    expect(screen.queryByText('1')).toBeNull();
    expect(screen.queryByText('2')).toBeNull();
  });

  it('renders a job description as a secondary line above the label', () => {
    renderQueue([
      makeJob({
        title: 'My Chat',
        description: 'Folder 1 / Folder 2',
      }),
    ]);

    expect(screen.getByText('Folder 1 / Folder 2')).toBeTruthy();
    expect(screen.getByText('My Chat')).toBeTruthy();
  });

  it('applies typed color, typography, and class overrides', () => {
    renderQueue([makeJob({ title: 'My Chat', description: 'Folder' })], {
      styles: {
        colors: { background: '#ffffff', text: '#111111' },
        typography: {
          titleClassName: 'custom-title',
          jobLabelClassName: 'custom-job-label',
          jobDescriptionClassName: 'custom-job-description',
        },
        rootClassName: 'custom-root',
        bodyClassName: 'custom-body',
        cssVars: {
          '--consumer-override': '#abcdef',
        } as CSSProperties,
      },
    });

    const region = screen.getByRole('status');
    expect(region.classList.contains('custom-root')).toBe(true);
    expect(region.style.getPropertyValue('--cp-transfer-queue-bg')).toBe(
      '#ffffff',
    );
    expect(region.style.getPropertyValue('--cp-transfer-queue-text')).toBe(
      '#111111',
    );
    expect(region.style.getPropertyValue('--consumer-override')).toBe(
      '#abcdef',
    );
    expect(screen.getByText(TITLE).classList.contains('custom-title')).toBe(
      true,
    );
    expect(
      screen.getByText('My Chat').classList.contains('custom-job-label'),
    ).toBe(true);
    expect(
      screen.getByText('Folder').classList.contains('custom-job-description'),
    ).toBe(true);
    // eslint-disable-next-line testing-library/no-node-access
    expect(region.querySelector('.custom-body')).toBeTruthy();
  });

  it('renders no secondary line when a job has no description', () => {
    renderQueue([makeJob({ title: 'My Chat' })]);

    expect(screen.getByText('My Chat')).toBeTruthy();
    /* CSS-level assertion — no semantic query applies. */
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelectorAll('.text-secondary').length).toBe(0);
  });

  it('uses allConversationsJobLabel for All-subject jobs', () => {
    renderQueue([
      {
        id: 'job-all',
        subject: { kind: ConversationTransferSubjectKind.All },
        status: ConversationTransferJobStatus.InProgress,
      },
    ]);

    expect(
      screen.getByText(DEFAULT_LABELS.allConversationsJobLabel),
    ).toBeTruthy();
  });

  it('automatically closes eight seconds after every job succeeds', () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      renderQueue(
        [makeJob({ status: ConversationTransferJobStatus.Success })],
        { onClose },
      );

      act(() => vi.advanceTimersByTime(7999));
      expect(onClose).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));
      expect(onClose).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not auto-close while a job is failed or in progress', () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      renderQueue(
        [
          makeJob({ id: 'a', status: ConversationTransferJobStatus.Failed }),
          makeJob({
            id: 'b',
            status: ConversationTransferJobStatus.InProgress,
          }),
        ],
        { onClose },
      );

      act(() => vi.advanceTimersByTime(16000));
      expect(onClose).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels an auto-close countdown when a new in-progress job arrives', () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      const successfulJob = makeJob({
        id: 'done',
        status: ConversationTransferJobStatus.Success,
      });
      const { rerender } = renderQueue([successfulJob], { onClose });

      act(() => vi.advanceTimersByTime(4000));
      rerender(
        <ImportExportQueue
          title={TITLE}
          jobs={[
            successfulJob,
            makeJob({
              id: 'new',
              status: ConversationTransferJobStatus.InProgress,
            }),
          ]}
          onDismiss={vi.fn()}
          onRetry={vi.fn()}
          onClose={onClose}
          labels={DEFAULT_LABELS}
        />,
      );
      act(() => vi.advanceTimersByTime(8000));

      expect(onClose).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
