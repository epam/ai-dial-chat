import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  ExportJobStatus,
  type ExportJob,
} from '../../../types/conversation-export';
import ImportExportQueue from '../ImportExportQueue';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DialProgressBar: ({
    value,
    ariaLabel,
  }: {
    value: number;
    ariaLabel?: string;
  }) => <div data-progress={value} aria-label={ariaLabel} />,
  DialProgressBarSize: { Small: 'sm', Medium: 'md' },
  DialConfirmationPopup: ({
    open,
    header,
    confirmLabel,
    onConfirm,
    onClose,
  }: {
    open: boolean;
    header: string;
    confirmLabel: string;
    onConfirm: () => void;
    onClose: () => void;
  }) => {
    if (!open) return null;
    return (
      <div role="dialog">
        <span>{header}</span>
        <button onClick={onConfirm}>{confirmLabel}</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    );
  },
  ConfirmationPopupVariant: { Danger: 'danger', Info: 'info' },
}));

vi.mock('@tabler/icons-react', () => ({
  IconX: () => null,
  IconCircleCheckFilled: () => null,
  IconRefresh: () => null,
  IconAlertCircleFilled: () => null,
  IconChevronDown: () => null,
  IconChevronUp: () => null,
}));

const makeJob = (overrides: Partial<ExportJob> = {}): ExportJob => ({
  id: 'job-1',
  label: 'My Chat',
  status: ExportJobStatus.InProgress,
  ...overrides,
});

const TITLE = 'Exporting';

describe('ImportExportQueue', () => {
  const user = userEvent.setup({ delay: null });

  const renderQueue = (
    jobs: ExportJob[],
    props: Partial<{
      onDismiss: (id: string) => void;
      onRetry: (id: string) => void;
      onClose: () => void;
    }> = {},
  ) =>
    render(
      <ImportExportQueue
        title={TITLE}
        jobs={jobs}
        onDismiss={props.onDismiss ?? vi.fn()}
        onRetry={props.onRetry ?? vi.fn()}
        onClose={props.onClose ?? vi.fn()}
      />,
    );

  it('renders nothing when there are no jobs', () => {
    renderQueue([]);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders the panel with a status region and every job label', () => {
    renderQueue([
      makeJob({ id: 'a', label: 'Chat A' }),
      makeJob({ id: 'b', label: 'Chat B', status: ExportJobStatus.Success }),
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
    expect(document.querySelector('.divide-y')).toBeNull();
  });

  it('shows aggregate progress as the fraction of finished jobs', () => {
    renderQueue([
      makeJob({ id: 'a', status: ExportJobStatus.Success }),
      makeJob({ id: 'b', status: ExportJobStatus.InProgress }),
      makeJob({ id: 'c', status: ExportJobStatus.Failed }),
      makeJob({ id: 'd', status: ExportJobStatus.InProgress }),
    ]);
    // 2 of 4 jobs finished (success or failed) = 50%
    expect(document.querySelector('[data-progress="50"]')).toBeTruthy();
  });

  it('clicking close on an in-progress job calls onDismiss with its id', async () => {
    const onDismiss = vi.fn();
    renderQueue([makeJob({ id: 'job-x', label: 'Chat X' })], { onDismiss });

    await user.click(
      screen.getByRole('button', {
        name: 'conversationExport.closeJobAriaLabel',
      }),
    );

    expect(onDismiss).toHaveBeenCalledWith('job-x');
  });

  it('a successful job does not show a per-job close button', () => {
    renderQueue([
      makeJob({
        id: 'job-y',
        label: 'Chat Y',
        status: ExportJobStatus.Success,
      }),
    ]);

    expect(
      screen.queryByRole('button', {
        name: 'conversationExport.closeJobAriaLabel',
      }),
    ).toBeNull();
  });

  it('a failed job shows a retry button but no per-job close button', async () => {
    const onRetry = vi.fn();
    renderQueue(
      [
        makeJob({
          id: 'job-z',
          label: 'Chat Z',
          status: ExportJobStatus.Failed,
        }),
      ],
      { onRetry },
    );

    await user.click(
      screen.getByRole('button', {
        name: 'conversationExport.retryJobAriaLabel',
      }),
    );
    expect(onRetry).toHaveBeenCalledWith('job-z');

    expect(
      screen.queryByRole('button', {
        name: 'conversationExport.closeJobAriaLabel',
      }),
    ).toBeNull();
  });

  it('collapsing the panel hides job rows without removing the header', async () => {
    renderQueue([makeJob({ label: 'Chat A' })]);

    expect(screen.getByText('Chat A')).toBeTruthy();

    await user.click(
      screen.getByRole('button', {
        name: 'conversationExport.collapseQueueAriaLabel',
      }),
    );

    expect(screen.queryByText('Chat A')).toBeNull();
    expect(screen.getByText(TITLE)).toBeTruthy();

    await user.click(
      screen.getByRole('button', {
        name: 'conversationExport.expandQueueAriaLabel',
      }),
    );
    expect(screen.getByText('Chat A')).toBeTruthy();
  });

  it('clicking close when all jobs succeeded calls onClose directly', async () => {
    const onClose = vi.fn();
    renderQueue([makeJob({ status: ExportJobStatus.Success })], { onClose });

    await user.click(
      screen.getByRole('button', {
        name: 'conversationExport.closeQueueAriaLabel',
      }),
    );

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('clicking close with an in-progress job shows the confirmation dialog', async () => {
    const onClose = vi.fn();
    renderQueue([makeJob({ status: ExportJobStatus.InProgress })], { onClose });

    await user.click(
      screen.getByRole('button', {
        name: 'conversationExport.closeQueueAriaLabel',
      }),
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('clicking close with a failed job shows the confirmation dialog', async () => {
    const onClose = vi.fn();
    renderQueue([makeJob({ status: ExportJobStatus.Failed })], { onClose });

    await user.click(
      screen.getByRole('button', {
        name: 'conversationExport.closeQueueAriaLabel',
      }),
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('confirming the dialog calls onClose', async () => {
    const onClose = vi.fn();
    renderQueue([makeJob({ status: ExportJobStatus.InProgress })], { onClose });

    await user.click(
      screen.getByRole('button', {
        name: 'conversationExport.closeQueueAriaLabel',
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: 'conversationExport.closeQueueConfirmButton',
      }),
    );

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('cancelling the dialog closes it without calling onClose', async () => {
    const onClose = vi.fn();
    renderQueue([makeJob({ status: ExportJobStatus.InProgress })], { onClose });

    await user.click(
      screen.getByRole('button', {
        name: 'conversationExport.closeQueueAriaLabel',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a failed count badge when at least one job has failed', () => {
    renderQueue([
      makeJob({ id: 'a', status: ExportJobStatus.Failed }),
      makeJob({ id: 'b', status: ExportJobStatus.InProgress }),
    ]);

    expect(screen.getByText('1')).toBeTruthy();
  });

  it('does not show the failed count badge when no jobs have failed', () => {
    renderQueue([
      makeJob({ id: 'a', status: ExportJobStatus.Success }),
      makeJob({ id: 'b', status: ExportJobStatus.InProgress }),
    ]);

    expect(screen.queryByText('1')).toBeNull();
    expect(screen.queryByText('2')).toBeNull();
  });
});
