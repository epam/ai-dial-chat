import {
  ConversationTransferErrorCode,
  ConversationTransferJobStatus,
  ConversationTransferSubjectKind,
  ConversationTransferWarningCode,
  type ConversationTransferJob,
  type ConversationTransferProgress,
} from '@epam/ai-dial-chat-shared';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  ImportExportQueue,
  type ImportExportQueueLabels,
  type ImportExportQueueStyles,
} from '../ImportExportQueue';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  ElementSize: { Small: 'small', Standard: 'standard', Large: 'large' },
  GhostIconButton: ({
    icon: _icon,
    size: _size,
    ...rest
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    icon?: ReactNode;
    size?: string;
  }) => <button type="button" {...rest} />,
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
  Spinner: ({
    ariaLabel,
    className,
  }: {
    ariaLabel?: string;
    className?: string;
  }) => (
    <div role="status" className={className}>
      <div role="img" aria-label={ariaLabel} />
    </div>
  ),
  EllipsisTooltip: ({
    text,
    className,
  }: {
    text: ReactNode;
    className?: string;
  }) => <span className={className}>{text}</span>,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  ProgressBar: ({ value, ...rest }: { value: number; size?: string }) => (
    <div role="progressbar" aria-valuenow={value} {...rest} />
  ),
}));

const DEFAULT_LABELS: ImportExportQueueLabels = {
  cancelJobAriaLabel: (fileName) => `Cancel ${fileName}`,
  canceledLabel: 'Canceled',
  jobErrorMessage: (code) =>
    code === ConversationTransferErrorCode.FileTooLarge
      ? 'Export failed. File is too large'
      : 'Export failed. Please try again',
  jobProgressAriaLabel: (fileName) => `Exporting ${fileName}`,
  jobWarningMessage: () => 'Some attachments could not be exported.',
  queueProgressAriaLabel: 'Export progress',
  queueProgressValueText: (completed, total) =>
    `${completed} of ${total} files done`,
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
  fileName = '2026-09-01_ai_dial_chat_with_attachments.dial',
  title = 'My Chat',
  status = ConversationTransferJobStatus.InProgress,
  progress = { percent: 0 },
  errorCode,
  warningCode,
}: {
  id?: string;
  fileName?: string;
  title?: string;
  status?: ConversationTransferJobStatus;
  progress?: ConversationTransferProgress;
  errorCode?: ConversationTransferErrorCode;
  warningCode?: ConversationTransferWarningCode;
} = {}): ConversationTransferJob => ({
  id,
  subject: {
    kind: ConversationTransferSubjectKind.Single,
    title,
    sourceBreadcrumb: 'Work / ',
  },
  status,
  fileName,
  progress,
  errorCode,
  warningCode,
});

const renderQueue = ({
  jobs = [makeJob()],
  title = 'Exporting 1 file',
  onClose = vi.fn(),
  onCancel = vi.fn(),
  styles,
}: {
  jobs?: ConversationTransferJob[];
  title?: string;
  onClose?: () => void;
  onCancel?: (jobId: string) => void;
  styles?: ImportExportQueueStyles;
} = {}) =>
  render(
    <ImportExportQueue
      title={title}
      jobs={jobs}
      onClose={onClose}
      onCancel={onCancel}
      labels={DEFAULT_LABELS}
      styles={styles}
    />,
  );

describe('ImportExportQueue', () => {
  it('renders nothing with an empty queue', () => {
    renderQueue({ jobs: [] });
    expect(screen.queryByRole('status')).toBeNull();
  });

  describe('row identity', () => {
    it('is identified by its file name, with no title or breadcrumb', () => {
      renderQueue({
        jobs: [
          makeJob({ fileName: 'my-export.dial', title: 'Dynamic Weather' }),
        ],
      });

      expect(screen.getByText('my-export.dial')).toBeTruthy();
      expect(screen.queryByText('Dynamic Weather')).toBeNull();
      expect(screen.queryByText('Work / ')).toBeNull();
    });
  });

  describe('status slot', () => {
    it('shows a named spinner for an in-progress job', () => {
      renderQueue({ jobs: [makeJob({ fileName: 'export.dial' })] });

      expect(
        screen.getByRole('img', { name: 'Exporting export.dial' }),
      ).toBeTruthy();
    });

    it('renders no aggregate indicator — one spinner per in-progress row', () => {
      renderQueue({
        jobs: [
          makeJob({ id: 'a' }),
          makeJob({ id: 'b' }),
          makeJob({ id: 'c', status: ConversationTransferJobStatus.Success }),
        ],
      });

      expect(screen.getAllByRole('img', { name: /^Exporting / })).toHaveLength(
        2,
      );
    });

    it('explains a failed job and offers no retry', () => {
      renderQueue({
        jobs: [
          makeJob({
            status: ConversationTransferJobStatus.Failed,
            errorCode: ConversationTransferErrorCode.FileTooLarge,
          }),
        ],
      });

      expect(
        screen.getByRole('img', {
          name: 'Export failed. File is too large',
        }),
      ).toBeTruthy();
      expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
    });

    it('names a warned job on the icon, reachable without hovering', () => {
      renderQueue({
        jobs: [
          makeJob({
            status: ConversationTransferJobStatus.Warning,
            warningCode: ConversationTransferWarningCode.AttachmentSkipped,
          }),
        ],
      });

      expect(
        screen.getByRole('img', {
          name: 'Some attachments could not be exported.',
        }),
      ).toBeTruthy();
      expect(screen.queryByRole('button', { name: /^Cancel / })).toBeNull();
    });

    it('keeps a canceled row visible with its label and no spinner', () => {
      renderQueue({
        jobs: [
          makeJob({
            fileName: 'export.dial',
            status: ConversationTransferJobStatus.Canceled,
            progress: { percent: 42 },
          }),
        ],
      });

      expect(screen.getByText('Canceled')).toBeTruthy();
      expect(screen.getByText('export.dial')).toBeTruthy();
      expect(screen.queryByRole('img', { name: /^Exporting / })).toBeNull();
    });

    it('dims the file name once a job is canceled', () => {
      const { rerender } = renderQueue({
        jobs: [makeJob({ fileName: 'export.dial' })],
      });
      const inProgressClass = screen
        .getByText('export.dial')
        .getAttribute('class');

      rerender(
        <ImportExportQueue
          title="Exporting 1 file"
          jobs={[
            makeJob({
              fileName: 'export.dial',
              status: ConversationTransferJobStatus.Canceled,
            }),
          ]}
          onClose={vi.fn()}
          onCancel={vi.fn()}
          labels={DEFAULT_LABELS}
        />,
      );

      expect(screen.getByText('export.dial').getAttribute('class')).not.toBe(
        inProgressClass,
      );
    });

    it('exposes no control on a settled row', () => {
      renderQueue({
        jobs: [
          makeJob({ id: 'a', status: ConversationTransferJobStatus.Success }),
          makeJob({ id: 'b', status: ConversationTransferJobStatus.Failed }),
          makeJob({ id: 'c', status: ConversationTransferJobStatus.Canceled }),
        ],
      });

      /* Only the header's collapse and close controls remain. */
      expect(screen.getAllByRole('button')).toHaveLength(2);
    });
  });

  describe('cancel control', () => {
    it('is mounted and reachable without hovering', async () => {
      const onCancel = vi.fn();
      renderQueue({
        jobs: [makeJob({ id: 'job-9', fileName: 'export.dial' })],
        onCancel,
      });

      /*
       * Tab order is header collapse, header close, then the row's cancel —
       * reaching it without ever hovering is the point of the assertion.
       */
      await userEvent.tab();
      await userEvent.tab();
      await userEvent.tab();
      await userEvent.keyboard('{Enter}');

      expect(onCancel).toHaveBeenCalledWith('job-9');
    });

    it('coexists with the spinner rather than replacing it', () => {
      renderQueue({ jobs: [makeJob({ fileName: 'export.dial' })] });

      expect(
        screen.getByRole('button', { name: 'Cancel export.dial' }),
      ).toBeTruthy();
      expect(
        screen.getByRole('img', { name: 'Exporting export.dial' }),
      ).toBeTruthy();
    });
  });

  describe('header', () => {
    it('renders the host-composed title verbatim', () => {
      renderQueue({ title: 'Exporting 3 files' });
      expect(screen.getByText('Exporting 3 files')).toBeTruthy();
    });

    it('collapses the rows without hiding itself', async () => {
      renderQueue({ jobs: [makeJob({ fileName: 'export.dial' })] });

      await userEvent.click(
        screen.getByRole('button', { name: 'Collapse queue' }),
      );

      expect(screen.queryByText('export.dial')).toBeNull();
      expect(screen.getByText('Exporting 1 file')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Expand queue' })).toBeTruthy();
    });

    it('shows the failed count only when a job has failed', () => {
      const { rerender } = renderQueue({ jobs: [makeJob()] });
      expect(screen.queryByText('1')).toBeNull();

      rerender(
        <ImportExportQueue
          title="Exporting 1 file"
          jobs={[makeJob({ status: ConversationTransferJobStatus.Failed })]}
          onClose={vi.fn()}
          onCancel={vi.fn()}
          labels={DEFAULT_LABELS}
        />,
      );
      expect(screen.getByText('1')).toBeTruthy();
    });
  });

  describe('closing', () => {
    it('closes immediately when every job succeeded', async () => {
      const onClose = vi.fn();
      renderQueue({
        jobs: [makeJob({ status: ConversationTransferJobStatus.Success })],
        onClose,
      });

      await userEvent.click(
        screen.getByRole('button', { name: 'Close queue' }),
      );

      expect(onClose).toHaveBeenCalledOnce();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('closes immediately when the only unfinished work was canceled', async () => {
      const onClose = vi.fn();
      renderQueue({
        jobs: [
          makeJob({ id: 'a', status: ConversationTransferJobStatus.Success }),
          makeJob({ id: 'b', status: ConversationTransferJobStatus.Canceled }),
        ],
        onClose,
      });

      await userEvent.click(
        screen.getByRole('button', { name: 'Close queue' }),
      );

      expect(onClose).toHaveBeenCalledOnce();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('asks for confirmation while work is in progress', async () => {
      const onClose = vi.fn();
      renderQueue({ onClose });

      await userEvent.click(
        screen.getByRole('button', { name: 'Close queue' }),
      );

      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(screen.getByText('Jobs are still in progress.')).toBeTruthy();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('asks for confirmation while a failure is unacknowledged', async () => {
      const onClose = vi.fn();
      renderQueue({
        jobs: [makeJob({ status: ConversationTransferJobStatus.Failed })],
        onClose,
      });

      await userEvent.click(
        screen.getByRole('button', { name: 'Close queue' }),
      );

      expect(screen.getByText('Some jobs have failed.')).toBeTruthy();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('uses the mixed description with both kinds present', async () => {
      renderQueue({
        jobs: [
          makeJob({ id: 'a' }),
          makeJob({ id: 'b', status: ConversationTransferJobStatus.Failed }),
        ],
      });

      await userEvent.click(
        screen.getByRole('button', { name: 'Close queue' }),
      );

      expect(
        screen.getByText('Some jobs are in progress or failed.'),
      ).toBeTruthy();
    });

    it('leaves the queue open when the confirmation is dismissed', async () => {
      const onClose = vi.fn();
      renderQueue({ onClose });

      await userEvent.click(
        screen.getByRole('button', { name: 'Close queue' }),
      );
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('collapsed aggregate progress', () => {
    const collapse = async () =>
      userEvent.click(screen.getByRole('button', { name: 'Collapse queue' }));

    it('shows the mean of every job once collapsed', async () => {
      renderQueue({
        jobs: [
          makeJob({
            id: 'a',
            status: ConversationTransferJobStatus.Success,
            progress: { percent: 100 },
          }),
          makeJob({ id: 'b', progress: { percent: 40 } }),
          makeJob({ id: 'c', progress: { percent: 10 } }),
        ],
      });
      await collapse();

      expect(
        screen
          .getByRole('progressbar', { name: 'Export progress' })
          .getAttribute('aria-valuenow'),
      ).toBe('50');
    });

    it('renders no bar while expanded', () => {
      renderQueue({ jobs: [makeJob({ progress: { percent: 40 } })] });

      expect(screen.queryByRole('progressbar')).toBeNull();
    });

    it('renders no bar once nothing is in progress', async () => {
      renderQueue({
        jobs: [
          makeJob({ id: 'a', status: ConversationTransferJobStatus.Success }),
          makeJob({ id: 'b', status: ConversationTransferJobStatus.Failed }),
        ],
      });
      await collapse();

      expect(screen.queryByRole('progressbar')).toBeNull();
    });

    it('announces settled file counts rather than a percentage', async () => {
      renderQueue({
        jobs: [
          makeJob({ id: 'a', status: ConversationTransferJobStatus.Success }),
          makeJob({ id: 'b', status: ConversationTransferJobStatus.Warning }),
          makeJob({ id: 'c', progress: { percent: 20 } }),
        ],
      });
      await collapse();

      expect(
        screen.getByRole('progressbar').getAttribute('aria-valuetext'),
      ).toBe('2 of 3 files done');
    });

    it('never renders the percentage as visible text', async () => {
      renderQueue({ jobs: [makeJob({ progress: { percent: 50 } })] });
      await collapse();

      expect(screen.queryByText(/50\s*%/)).toBeNull();
    });
  });

  describe('auto-close', () => {
    const advance = (ms: number) => {
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    };

    const withFakeTimers = (assertions: () => void) => {
      vi.useFakeTimers();
      try {
        assertions();
      } finally {
        vi.useRealTimers();
      }
    };

    it('closes 8 seconds after every job succeeds', () => {
      withFakeTimers(() => {
        const onClose = vi.fn();
        renderQueue({
          jobs: [makeJob({ status: ConversationTransferJobStatus.Success })],
          onClose,
        });

        advance(8000);
        expect(onClose).toHaveBeenCalledOnce();
      });
    });

    it('does not close while a job is still in progress', () => {
      withFakeTimers(() => {
        const onClose = vi.fn();
        renderQueue({ onClose });

        advance(8000);
        expect(onClose).not.toHaveBeenCalled();
      });
    });

    it('does not close while a job has failed', () => {
      withFakeTimers(() => {
        const onClose = vi.fn();
        renderQueue({
          jobs: [makeJob({ status: ConversationTransferJobStatus.Failed })],
          onClose,
        });

        advance(8000);
        expect(onClose).not.toHaveBeenCalled();
      });
    });

    it('does not close while a warned row is unread', () => {
      withFakeTimers(() => {
        const onClose = vi.fn();
        renderQueue({
          jobs: [
            makeJob({ id: 'a', status: ConversationTransferJobStatus.Success }),
            makeJob({
              id: 'b',
              status: ConversationTransferJobStatus.Warning,
              warningCode: ConversationTransferWarningCode.AttachmentSkipped,
            }),
          ],
          onClose,
        });

        advance(8000);
        expect(onClose).not.toHaveBeenCalled();
      });
    });

    it('does not close while a canceled row is unread', () => {
      withFakeTimers(() => {
        const onClose = vi.fn();
        renderQueue({
          jobs: [
            makeJob({ id: 'a', status: ConversationTransferJobStatus.Success }),
            makeJob({
              id: 'b',
              status: ConversationTransferJobStatus.Canceled,
            }),
          ],
          onClose,
        });

        advance(8000);
        expect(onClose).not.toHaveBeenCalled();
      });
    });

    it('cancels the countdown when a new job starts', () => {
      withFakeTimers(() => {
        const onClose = vi.fn();
        const { rerender } = renderQueue({
          jobs: [
            makeJob({ id: 'a', status: ConversationTransferJobStatus.Success }),
          ],
          onClose,
        });

        advance(4000);
        rerender(
          <ImportExportQueue
            title="Exporting 2 files"
            jobs={[
              makeJob({
                id: 'a',
                status: ConversationTransferJobStatus.Success,
              }),
              makeJob({ id: 'b' }),
            ]}
            onClose={onClose}
            onCancel={vi.fn()}
            labels={DEFAULT_LABELS}
          />,
        );
        advance(8000);

        expect(onClose).not.toHaveBeenCalled();
      });
    });
  });

  describe('style overrides', () => {
    it('applies typed colors as CSS custom properties', () => {
      renderQueue({
        jobs: [makeJob({ status: ConversationTransferJobStatus.Success })],
        styles: {
          colors: {
            background: 'rebeccapurple',
            successIcon: 'tomato',
          },
          rootClassName: 'custom-root',
        },
      });

      const root = screen.getByRole('status');
      const style = root.style as CSSStyleDeclaration & CSSProperties;
      expect(style.getPropertyValue('--cp-transfer-queue-bg')).toBe(
        'rebeccapurple',
      );
      expect(style.getPropertyValue('--cp-transfer-queue-success-icon')).toBe(
        'tomato',
      );
      expect(root.className).toContain('custom-root');
    });
  });
});
