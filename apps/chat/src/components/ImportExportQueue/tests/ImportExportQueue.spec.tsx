import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { QueueJob } from '../../../models/conversation-queue';
import { ExportJobStatus } from '../../../types/conversation-export';
import ImportExportQueue from '../ImportExportQueue';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

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
  IconButton: ({
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
  DialIconButton: ({
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
  ButtonAppearance: { Ghost: 'ghost', Solid: 'solid' },
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
  DialEllipsisTooltip: ({
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

const makeJob = (overrides: Partial<QueueJob> = {}): QueueJob => ({
  id: 'job-1',
  label: 'My Chat',
  status: ExportJobStatus.InProgress,
  ...overrides,
});

const TITLE = 'Exporting';

describe('ImportExportQueue', () => {
  const user = userEvent.setup({ delay: null });

  const renderQueue = (
    jobs: QueueJob[],
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
    /* CSS-level assertion (class/attribute presence, not text or role) —
       no semantic query applies. */
    // eslint-disable-next-line testing-library/no-node-access
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
    /* CSS-level assertion (class/attribute presence, not text or role) —
       no semantic query applies. */
    // eslint-disable-next-line testing-library/no-node-access
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

  it('clicking close with an in-progress job shows the confirmation dialog with the in-progress message', async () => {
    const onClose = vi.fn();
    renderQueue([makeJob({ status: ExportJobStatus.InProgress })], { onClose });

    await user.click(
      screen.getByRole('button', {
        name: 'conversationExport.closeQueueAriaLabel',
      }),
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(
      screen.getByText(
        'conversationExport.closeQueueConfirmDescriptionInProgress',
      ),
    ).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('clicking close with a failed job shows the confirmation dialog with the failed message', async () => {
    const onClose = vi.fn();
    renderQueue([makeJob({ status: ExportJobStatus.Failed })], { onClose });

    await user.click(
      screen.getByRole('button', {
        name: 'conversationExport.closeQueueAriaLabel',
      }),
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(
      screen.getByText('conversationExport.closeQueueConfirmDescriptionFailed'),
    ).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('clicking close with both an in-progress and a failed job shows the mixed message', async () => {
    const onClose = vi.fn();
    renderQueue(
      [
        makeJob({ id: 'a', status: ExportJobStatus.InProgress }),
        makeJob({ id: 'b', status: ExportJobStatus.Failed }),
      ],
      { onClose },
    );

    await user.click(
      screen.getByRole('button', {
        name: 'conversationExport.closeQueueAriaLabel',
      }),
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(
      screen.getByText('conversationExport.closeQueueConfirmDescriptionMixed'),
    ).toBeTruthy();
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
        name: 'buttons.close',
      }),
    );

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not reopen the confirmation dialog when a new job arrives after confirming', async () => {
    const onClose = vi.fn();
    const { rerender } = renderQueue(
      [makeJob({ id: 'job-1', status: ExportJobStatus.InProgress })],
      { onClose },
    );

    await user.click(
      screen.getByRole('button', {
        name: 'conversationExport.closeQueueAriaLabel',
      }),
    );
    expect(screen.getByRole('dialog')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'buttons.close' }));
    expect(onClose).toHaveBeenCalledOnce();

    // Parent clears jobs in response to onClose — component stays mounted, renders null.
    rerender(
      <ImportExportQueue
        title={TITLE}
        jobs={[]}
        onDismiss={vi.fn()}
        onRetry={vi.fn()}
        onClose={onClose}
      />,
    );
    expect(screen.queryByRole('status')).toBeNull();

    // A new export starts — the panel reappears and must not reopen the stale confirmation.
    rerender(
      <ImportExportQueue
        title={TITLE}
        jobs={[makeJob({ id: 'job-2', status: ExportJobStatus.InProgress })]}
        onDismiss={vi.fn()}
        onRetry={vi.fn()}
        onClose={onClose}
      />,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
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

  it('renders a job description as a secondary line above the label', () => {
    renderQueue([
      makeJob({
        label: 'My Chat',
        description: 'Folder 1 / Folder 2',
      }),
    ]);

    expect(screen.getByText('Folder 1 / Folder 2')).toBeTruthy();
    expect(screen.getByText('My Chat')).toBeTruthy();
  });

  it('renders no secondary line when a job has no description', () => {
    renderQueue([makeJob({ label: 'My Chat' })]);

    expect(screen.getByText('My Chat')).toBeTruthy();
    /* CSS-level assertion (class/attribute presence, not text or role) —
       no semantic query applies. */
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelectorAll('.text-secondary').length).toBe(0);
  });
});
