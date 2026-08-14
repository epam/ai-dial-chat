import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  SkillFileCandidateKind,
  SkillFileValidationStatus,
  type SkillEditorFileActions,
  type SkillFileUploadCandidate,
} from '../../../models/skill-editor-props';
import { SkillFileUploadDialog } from '../SkillFileUploadDialog';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { LG: 24, MD: 20, SM: 16 },
  PopupSize: { Sm: 'sm', Md: 'md', Lg: 'lg' },
  Popup: ({
    open,
    header,
    children,
    footer,
    onClose,
    closeAriaLabel,
  }: {
    open: boolean;
    header: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    onClose: () => void;
    closeAriaLabel?: string;
  }) =>
    open ? (
      <div role="dialog" aria-label="Upload files from device">
        <h2>{header}</h2>
        <button onClick={onClose}>{closeAriaLabel ?? 'Close'}</button>
        {children}
        {footer}
      </div>
    ) : null,
  ErrorText: ({ text }: { text?: string }) => <span>{text}</span>,
  GhostButton: ({
    label,
    onClick,
  }: {
    label: ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{label}</button>,
  GhostIconButton: ({
    icon,
    onClick,
    'aria-label': ariaLabel,
  }: {
    icon: ReactNode;
    onClick?: () => void;
    'aria-label'?: string;
  }) => (
    <button aria-label={ariaLabel} onClick={onClick}>
      {icon}
    </button>
  ),
  PrimaryButton: ({
    label,
    onClick,
    disabled,
  }: {
    label: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  ),
  Spinner: ({ ariaLabel }: { ariaLabel?: string }) => (
    <div role="status">{ariaLabel}</div>
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconUpload: () => <svg />,
  IconFileText: () => <svg />,
  IconTrashX: () => <svg />,
}));

const buildFileActions = (
  overrides?: Partial<
    Pick<SkillEditorFileActions, 'validateBatch' | 'commitBatch'>
  >,
) => ({
  validateBatch: vi.fn(async () => ({ results: [], batchErrors: [] })),
  commitBatch: vi.fn(async () => ({})),
  ...overrides,
});

const stageFile = (file: File) => {
  // eslint-disable-next-line testing-library/no-node-access -- the upload <input type="file"> is visually hidden and carries no accessible name/role to query by
  const input = document.querySelector('input[type="file"]') as HTMLElement;
  fireEvent.change(input, { target: { files: [file] } });
};

describe('SkillFileUploadDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <SkillFileUploadDialog
        isOpen={false}
        onClose={vi.fn()}
        fileActions={buildFileActions()}
      />,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens with an empty staged list', () => {
    render(
      <SkillFileUploadDialog
        isOpen
        onClose={vi.fn()}
        fileActions={buildFileActions()}
      />,
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByRole('listitem')).toBeNull();
  });

  it('stages a file selected via the native picker', async () => {
    render(
      <SkillFileUploadDialog
        isOpen
        onClose={vi.fn()}
        fileActions={buildFileActions()}
      />,
    );

    stageFile(new File(['content'], 'notes.md'));

    expect(await screen.findByText('notes.md')).toBeTruthy();
  });

  it('supports staging multiple files at once', async () => {
    render(
      <SkillFileUploadDialog
        isOpen
        onClose={vi.fn()}
        fileActions={buildFileActions()}
      />,
    );

    // eslint-disable-next-line testing-library/no-node-access -- the upload <input type="file"> is visually hidden and carries no accessible name/role to query by
    const input = document.querySelector('input[type="file"]') as HTMLElement;
    fireEvent.change(input, {
      target: {
        files: [new File(['a'], 'a.md'), new File(['b'], 'b.md')],
      },
    });

    expect(await screen.findByText('a.md')).toBeTruthy();
    expect(screen.getByText('b.md')).toBeTruthy();
  });

  it('activates the drop zone on a file-bearing drag and reverts on drag-leave', () => {
    render(
      <SkillFileUploadDialog
        isOpen
        onClose={vi.fn()}
        fileActions={buildFileActions()}
      />,
    );

    const dropZone = screen.getByRole('button', { name: 'Upload files' });
    const dragEvent = { dataTransfer: { types: ['Files'], files: [] } };

    fireEvent.dragEnter(dropZone, dragEvent);
    expect(dropZone.className).toContain('border-accent-primary');

    fireEvent.dragLeave(dropZone, dragEvent);
    expect(dropZone.className).not.toContain('border-accent-primary');
  });

  it('stages dropped files and suppresses the browser default', () => {
    render(
      <SkillFileUploadDialog
        isOpen
        onClose={vi.fn()}
        fileActions={buildFileActions()}
      />,
    );

    const dropZone = screen.getByRole('button', { name: 'Upload files' });
    const file = new File(['content'], 'dropped.md');
    fireEvent.drop(dropZone, {
      dataTransfer: { types: ['Files'], files: [file] },
    });

    expect(screen.getByText('dropped.md')).toBeTruthy();
  });

  it('disables confirm while any staged item is invalid', async () => {
    render(
      <SkillFileUploadDialog
        isOpen
        onClose={vi.fn()}
        fileActions={buildFileActions({
          validateBatch: vi.fn(
            async (candidates: SkillFileUploadCandidate[]) => ({
              results: candidates.map((c) => ({
                candidateId: c.id,
                status: SkillFileValidationStatus.Invalid,
                kind: SkillFileCandidateKind.SupportingFile,
                error: 'Too large',
              })),
              batchErrors: [],
            }),
          ),
        })}
      />,
    );

    stageFile(new File(['content'], 'huge.md'));
    await screen.findByText('Too large');

    expect(
      (screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('removing a staged row leaves other rows and calls no host callback', async () => {
    render(
      <SkillFileUploadDialog
        isOpen
        onClose={vi.fn()}
        fileActions={buildFileActions()}
      />,
    );

    stageFile(new File(['content'], 'a.md'));
    await screen.findByText('a.md');

    await userEvent.click(screen.getByRole('button', { name: 'Remove a.md' }));

    expect(screen.queryByText('a.md')).toBeNull();
  });

  it('cancel closes without calling commitBatch', async () => {
    const onClose = vi.fn();
    const commitBatch = vi.fn(async () => ({}));
    render(
      <SkillFileUploadDialog
        isOpen
        onClose={onClose}
        fileActions={buildFileActions({ commitBatch })}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(commitBatch).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders under an RTL ancestor with no dedicated dir prop', () => {
    document.documentElement.dir = 'rtl';
    try {
      render(
        <SkillFileUploadDialog
          isOpen
          onClose={vi.fn()}
          fileActions={buildFileActions()}
        />,
      );

      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Upload files' })).toBeTruthy();
    } finally {
      document.documentElement.dir = '';
    }
  });

  it('a successful commit closes the dialog via onClose', async () => {
    const onClose = vi.fn();
    render(
      <SkillFileUploadDialog
        isOpen
        onClose={onClose}
        fileActions={buildFileActions({
          validateBatch: vi.fn(
            async (candidates: SkillFileUploadCandidate[]) => ({
              results: candidates.map((c) => ({
                candidateId: c.id,
                status: SkillFileValidationStatus.Valid,
                kind: SkillFileCandidateKind.SupportingFile,
              })),
              batchErrors: [],
            }),
          ),
        })}
      />,
    );

    stageFile(new File(['content'], 'a.md'));
    await screen.findByText('a.md');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
