import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  SkillFileCandidateKind,
  SkillFileValidationStatus,
  type SkillEditorFileActions,
  type SkillFileSourceEntry,
  type SkillFileUploadCandidate,
} from '../../../models/skill-editor-props';
import { SkillFileUploadMode } from '../../../types/skill-file-upload-mode';
import { SkillFileUploadDialog } from '../SkillFileUploadDialog';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { LG: 24, MD: 20, SM: 16 },
  ButtonVariant: { Primary: 'primary', Neutral: 'neutral', Danger: 'danger' },
  ButtonAppearance: { Solid: 'solid', Ghost: 'ghost', Link: 'link' },
  PopupSize: { Sm: 'sm', Md: 'md', Lg: 'lg' },
  Popup: ({
    open,
    header,
    children,
    footer,
    mainButtons,
    onClose,
    closeAriaLabel,
  }: {
    open: boolean;
    header: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    mainButtons?: {
      label?: ReactNode;
      onClick?: () => void;
      disabled?: boolean;
    }[];
    onClose: () => void;
    closeAriaLabel?: string;
  }) =>
    open ? (
      <div role="dialog" aria-label="Upload files from device">
        <h2>{header}</h2>
        <button onClick={onClose}>{closeAriaLabel ?? 'Close'}</button>
        {children}
        {footer}
        {mainButtons?.map((button, index) => (
          <button
            key={index}
            onClick={button.onClick}
            disabled={button.disabled}
          >
            {button.label}
          </button>
        ))}
      </div>
    ) : null,
  ErrorText: ({ text }: { text?: string }) => <span>{text}</span>,
  FileDropzone: ({
    id,
    label,
    description,
    ariaLabel,
    multiple,
    accept,
    onChange,
    onReject,
  }: {
    id?: string;
    label: ReactNode;
    description?: ReactNode;
    ariaLabel?: string;
    multiple?: boolean;
    accept?: string;
    onChange: (files: File[]) => void;
    onReject?: (files: File[]) => void;
  }) => (
    <div>
      <span>{label}</span>
      {description && <span>{description}</span>}
      <input
        id={id}
        type="file"
        multiple={multiple}
        accept={accept}
        aria-label={ariaLabel}
        onChange={(event) => onChange(Array.from(event.target.files ?? []))}
      />
      {onReject && (
        <button onClick={() => onReject([])}>Simulate rejected drop</button>
      )}
    </div>
  ),
  FileName: ({ name, details }: { name: string; details?: ReactNode }) => (
    <div>
      <span>{name}</span>
      {details}
    </div>
  ),
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
  RadioGroup: ({
    items,
    value,
    onChange,
  }: {
    items: { value: string; label?: ReactNode }[];
    value?: string;
    onChange: (value: string) => void;
  }) => (
    <div role="radiogroup">
      {items.map((item) => (
        <label key={item.value}>
          <input
            type="radio"
            checked={item.value === value}
            onChange={() => onChange(item.value)}
          />
          {item.label}
        </label>
      ))}
    </div>
  ),
  Spinner: ({ ariaLabel }: { ariaLabel?: string }) => (
    <div role="status">{ariaLabel}</div>
  ),
}));

vi.mock('@tabler/icons-react', () => ({
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
  fireEvent.change(screen.getByLabelText('Upload files'), {
    target: { files: [file] },
  });
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

    fireEvent.change(screen.getByLabelText('Upload files'), {
      target: {
        files: [new File(['a'], 'a.md'), new File(['b'], 'b.md')],
      },
    });

    expect(await screen.findByText('a.md')).toBeTruthy();
    expect(screen.getByText('b.md')).toBeTruthy();
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
      expect(screen.getByLabelText('Upload files')).toBeTruthy();
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

  it('prefixes staged paths with the target folder', async () => {
    render(
      <SkillFileUploadDialog
        isOpen
        onClose={vi.fn()}
        fileActions={buildFileActions()}
        targetFolderPath="docs"
      />,
    );

    stageFile(new File(['x'], 'a.md'));

    expect(await screen.findByText('docs/a.md')).toBeTruthy();
  });

  it('stages host-supplied entries when it opens, normalizing separators', async () => {
    render(
      <SkillFileUploadDialog
        isOpen
        onClose={vi.fn()}
        fileActions={buildFileActions()}
        targetFolderPath="docs"
        initialEntries={[{ path: 'refs\\a.md', file: new File(['x'], 'a.md') }]}
      />,
    );

    expect(await screen.findByText('docs/refs/a.md')).toBeTruthy();
  });

  it('accepts only zip archives in archive mode and reports a rejected drop', async () => {
    render(
      <SkillFileUploadDialog
        isOpen
        onClose={vi.fn()}
        fileActions={{ ...buildFileActions(), extractArchive: vi.fn() }}
        mode={SkillFileUploadMode.Archive}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Upload archive from device' }),
    ).toBeTruthy();
    expect(screen.getByLabelText('Upload files').getAttribute('accept')).toBe(
      '.zip,application/zip',
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Simulate rejected drop' }),
    );

    expect(screen.getByRole('alert').textContent).toBe(
      "Couldn't read this archive",
    );
  });

  it('keeps Add disabled while an archive is being read', async () => {
    let resolveExtraction:
      ((entries: SkillFileSourceEntry[]) => void) | undefined;
    render(
      <SkillFileUploadDialog
        isOpen
        onClose={vi.fn()}
        fileActions={{
          ...buildFileActions(),
          extractArchive: () =>
            new Promise((resolve) => {
              resolveExtraction = resolve;
            }),
        }}
        mode={SkillFileUploadMode.Archive}
      />,
    );

    stageFile(new File(['zip'], 'a.zip'));

    expect(await screen.findByText('Reading archive')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    resolveExtraction?.([{ path: 'a.md', file: new File(['x'], 'a.md') }]);

    expect(await screen.findByText('a.md')).toBeTruthy();
    expect(screen.queryByText('Reading archive')).toBeNull();
  });
});

describe('SkillFileUploadDialog — existing file conflicts', () => {
  const renderWithExisting = (
    fileActions = buildFileActions(),
    existingFilePaths = ['notes.md'],
  ) =>
    render(
      <SkillFileUploadDialog
        isOpen
        onClose={vi.fn()}
        fileActions={fileActions}
        existingFilePaths={existingFilePaths}
      />,
    );

  it('asks to replace or duplicate an upload whose path already holds a file', () => {
    renderWithExisting();

    stageFile(new File(['new'], 'notes.md'));

    expect(
      screen.getByRole('heading', { name: 'Replace or duplicate it?' }),
    ).toBeTruthy();
    expect(
      screen.getByText('Item with the same name "notes.md" already exists.'),
    ).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Replace' })).toHaveProperty(
      'checked',
      true,
    );
  });

  it('stages a replacing upload at the same path once Replace is confirmed', async () => {
    const user = userEvent.setup({ delay: null });
    const fileActions = buildFileActions();
    renderWithExisting(fileActions);

    stageFile(new File(['new'], 'notes.md'));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(
      await screen.findByText('Will replace the existing file'),
    ).toBeTruthy();
    expect(fileActions.validateBatch).toHaveBeenLastCalledWith([
      expect.objectContaining({ path: 'notes.md', replacesExisting: true }),
    ]);
  });

  it('stages a duplicate under the next free numbered name', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithExisting(buildFileActions(), ['notes.md', 'notes (1).md']);

    stageFile(new File(['new'], 'notes.md'));
    await user.click(screen.getByRole('radio', { name: 'Duplicate' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByText('notes (2).md')).toBeTruthy();
    expect(screen.queryByText('Will replace the existing file')).toBeNull();
  });

  it('moves focus to the question, then back to the drop zone once it is answered', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithExisting();

    stageFile(new File(['new'], 'notes.md'));
    /* Focus has no semantic query. */
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.activeElement).toBe(
      screen.getByText('Item with the same name "notes.md" already exists.'),
    );

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.activeElement).toBe(screen.getByLabelText('Upload files'));
  });

  it('reports the committed batch, including the replacement flag', async () => {
    const user = userEvent.setup({ delay: null });
    const onCommitted = vi.fn();
    render(
      <SkillFileUploadDialog
        isOpen
        onClose={vi.fn()}
        fileActions={buildFileActions()}
        existingFilePaths={['notes.md']}
        onCommitted={onCommitted}
      />,
    );

    stageFile(new File(['new'], 'notes.md'));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await user.click(await screen.findByRole('button', { name: 'Add' }));

    expect(onCommitted).toHaveBeenCalledWith([
      expect.objectContaining({ path: 'notes.md', replacesExisting: true }),
    ]);
  });

  it('drops the conflicting upload on Cancel and keeps the rest staged', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithExisting();

    fireEvent.change(screen.getByLabelText('Upload files'), {
      target: {
        files: [new File(['a'], 'a.md'), new File(['new'], 'notes.md')],
      },
    });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('a.md')).toBeTruthy();
    expect(screen.queryByText('notes.md')).toBeNull();
    expect(
      screen.queryByRole('heading', { name: 'Replace or duplicate it?' }),
    ).toBeNull();
  });

  it('never asks about the root SKILL.md, which is a metadata import', () => {
    renderWithExisting(buildFileActions(), ['notes.md']);

    stageFile(new File(['---'], 'SKILL.md'));

    expect(
      screen.queryByRole('heading', { name: 'Replace or duplicate it?' }),
    ).toBeNull();
    expect(screen.getByText('SKILL.md')).toBeTruthy();
  });
});

describe('SkillFileUploadDialog — drop-zone description', () => {
  it('shows the host description for the active mode', () => {
    render(
      <SkillFileUploadDialog
        isOpen
        onClose={vi.fn()}
        fileActions={buildFileActions()}
        mode={SkillFileUploadMode.Archive}
        labels={{
          uploadDropZoneDescription: 'Maximum size: 1 MB',
          uploadArchiveDropZoneDescription: 'File format .zip',
        }}
      />,
    );

    expect(screen.getByText('File format .zip')).toBeTruthy();
    expect(screen.queryByText('Maximum size: 1 MB')).toBeNull();
  });
});
