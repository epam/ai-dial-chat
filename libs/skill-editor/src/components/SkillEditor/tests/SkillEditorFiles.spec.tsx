import type { DialFile } from '@epam/ai-dial-react-file-manager';
import type { DropdownItem } from '@epam/ai-dial-ui-kit';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  ComponentProps,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from 'react';
import { describe, expect, it, vi } from 'vitest';
import type {
  SkillEditorFileActions,
  SkillEditorProps,
  SkillFileUploadCandidate,
} from '../../../models/skill-editor-props';
import {
  SkillFileCandidateKind,
  SkillFileValidationStatus,
} from '../../../models/skill-editor-props';
import { SkillFileNodeKind } from '../../../types/skill-file-node-kind';
import { SkillEditor } from '../SkillEditor';

// Dropdown/context-menu mocks below only need a stand-in event object — its
// fields are never read by the code under test.
const fakeMouseEvent = new MouseEvent('click') as unknown as ReactMouseEvent;

const renderFileNode = (
  file: DialFile,
  onItemClick?: (f: DialFile) => void,
  getContextMenuItems?: (f: DialFile) => DropdownItem[],
) => (
  <li key={file.path}>
    <button onClick={() => onItemClick?.(file)}>{file.name}</button>
    {getContextMenuItems?.(file).map((item) => (
      <button
        key={item.key}
        onClick={() =>
          item.onClick?.({ key: item.key, domEvent: fakeMouseEvent })
        }
      >
        {item.label}
      </button>
    ))}
    {file.items?.map((child) =>
      renderFileNode(child, onItemClick, getContextMenuItems),
    )}
  </li>
);

vi.mock('@epam/ai-dial-react-file-manager', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-react-file-manager')>();
  return {
    ...actual,
    DialFoldersTree: (props: ComponentProps<typeof actual.DialFoldersTree>) => (
      <ul role="tree">
        {props.items.map((file) =>
          renderFileNode(file, props.onItemClick, props.getContextMenuItems),
        )}
      </ul>
    ),
  };
});

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { LG: 24, MD: 20, SM: 16 },
  Accordion: ({
    title,
    children,
  }: {
    title: ReactNode;
    children: ReactNode;
  }) => (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  ),
  CaptionText: ({ text }: { text?: string }) => <span>{text}</span>,
  ErrorText: ({ text }: { text?: string }) => <span>{text}</span>,
  ConfirmationPopupVariant: { Danger: 'danger' },
  ConfirmationPopup: ({
    header,
    onConfirm,
    onCancel,
    confirmLabel,
    cancelLabel,
  }: {
    header: ReactNode;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
  }) => (
    <div role="dialog">
      <h2>{header}</h2>
      <button onClick={onConfirm}>{confirmLabel ?? 'Confirm'}</button>
      <button onClick={onCancel}>{cancelLabel ?? 'Cancel'}</button>
    </div>
  ),
  GhostButton: ({
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
  NeutralButton: ({
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
  Input: ({
    labelProps,
    value,
    onChange,
    error,
  }: {
    labelProps?: { label: ReactNode; required?: boolean };
    value?: string;
    onChange?: (value: string) => void;
    error?: string;
  }) => (
    <label>
      {labelProps?.label}
      <input value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} />
      {error && <span>{error}</span>}
    </label>
  ),
  Textarea: ({
    labelProps,
    value,
    onChange,
  }: {
    labelProps?: { label: ReactNode; required?: boolean };
    value?: string;
    onChange?: (value: string) => void;
  }) => (
    <label>
      {labelProps?.label}
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </label>
  ),
  Spinner: ({ ariaLabel }: { ariaLabel?: string }) => (
    <div role="status">{ariaLabel}</div>
  ),
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
      <div
        role="dialog"
        aria-label={typeof header === 'string' ? header : undefined}
      >
        <h2>{header}</h2>
        <button onClick={onClose}>{closeAriaLabel ?? 'Close'}</button>
        {children}
        {footer}
      </div>
    ) : null,
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
  LazyMarkdownEditor: () =>
    Promise.resolve({
      MarkdownEditor: ({
        value,
        onChange,
      }: {
        value: string;
        onChange: (value: string) => void;
      }) => (
        <textarea
          aria-label="Instructions"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ),
    }),
}));

vi.mock('@tabler/icons-react', () => ({
  IconPlus: () => <svg />,
  IconTrashX: () => <svg />,
  IconUpload: () => <svg />,
  IconFileText: () => <svg />,
}));

const buildFileActions = (
  overrides?: Partial<SkillEditorFileActions>,
): SkillEditorFileActions => ({
  validateBatch: vi.fn(async () => ({ results: [], batchErrors: [] })),
  commitBatch: vi.fn(async () => ({})),
  onRemoveNode: vi.fn(),
  ...overrides,
});

const openUploadDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(
    screen.getAllByRole('button', { name: 'Upload from device' })[0],
  );
};

const stageFile = (file: File) => {
  // eslint-disable-next-line testing-library/no-node-access -- the upload <input type="file"> is visually hidden and carries no accessible name/role to query by
  const input = document.querySelector('input[type="file"]');
  fireEvent.change(input as Element, { target: { files: [file] } });
};

const renderEditor = (
  props?: Partial<SkillEditorProps>,
  fileActions?: SkillEditorFileActions,
) =>
  render(
    <SkillEditor
      files={[]}
      fileActions={fileActions ?? buildFileActions()}
      onSubmit={vi.fn()}
      onCancel={vi.fn()}
      {...props}
    />,
  );

describe('SkillEditor — files pane', () => {
  it('selects SKILL.md by default and shows its form', () => {
    renderEditor();

    expect(screen.getByRole('heading', { name: 'SKILL.md' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'SKILL.md' })[0]).toBeTruthy();
  });

  it('exposes no remove action for the protected SKILL.md node', () => {
    renderEditor({
      files: [
        { path: 'notes.md', name: 'notes.md', kind: SkillFileNodeKind.File },
      ],
    });

    // The supporting file has a Remove action; SKILL.md never does.
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(2);
  });

  it('commits a staged file when the batch validates and the user confirms', async () => {
    const user = userEvent.setup({ delay: null });
    const commitBatch = vi.fn(async () => ({}));
    const file = new File(['content'], 'analyzer.md');
    renderEditor(
      {},
      buildFileActions({
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
        commitBatch,
      }),
    );

    await openUploadDialog(user);
    stageFile(file);
    expect(await screen.findByText('analyzer.md')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(commitBatch).toHaveBeenCalledWith([
      expect.objectContaining({ file, path: 'analyzer.md' }),
    ]);
  });

  it('shows the validation error and disables confirm for a rejected staged file', async () => {
    const user = userEvent.setup({ delay: null });
    const commitBatch = vi.fn(async () => ({}));
    renderEditor(
      {},
      buildFileActions({
        validateBatch: vi.fn(
          async (candidates: SkillFileUploadCandidate[]) => ({
            results: candidates.map((c) => ({
              candidateId: c.id,
              status: SkillFileValidationStatus.Invalid,
              kind: SkillFileCandidateKind.SupportingFile,
              error: 'A file already exists at this path',
            })),
            batchErrors: [],
          }),
        ),
        commitBatch,
      }),
    );

    await openUploadDialog(user);
    stageFile(new File(['content'], 'notes.md'));

    expect(
      await screen.findByText('A file already exists at this path'),
    ).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(commitBatch).not.toHaveBeenCalled();
  });

  it('keeps the dialog open with the batch intact when commitBatch fails', async () => {
    const user = userEvent.setup({ delay: null });
    renderEditor(
      {},
      buildFileActions({
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
        commitBatch: vi.fn(async () => ({
          error: 'This skill package is too large to upload.',
        })),
      }),
    );

    await openUploadDialog(user);
    stageFile(new File(['content'], 'huge.md'));
    await screen.findByText('huge.md');

    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(
      await screen.findByText('This skill package is too large to upload.'),
    ).toBeTruthy();
    expect(screen.getByText('huge.md')).toBeTruthy();
  });

  it('cancel closes the dialog and commits nothing', async () => {
    const user = userEvent.setup({ delay: null });
    const commitBatch = vi.fn(async () => ({}));
    renderEditor({}, buildFileActions({ commitBatch }));

    await openUploadDialog(user);
    stageFile(new File(['content'], 'notes.md'));
    await screen.findByText('notes.md');

    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Cancel',
      }),
    );

    expect(commitBatch).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('removing a staged row removes only that row, with no confirmation', async () => {
    const user = userEvent.setup({ delay: null });
    renderEditor({}, buildFileActions());

    await openUploadDialog(user);
    stageFile(new File(['content'], 'notes.md'));
    stageFile(new File(['content'], 'other.md'));
    await screen.findByText('notes.md');

    await user.click(screen.getByRole('button', { name: 'Remove notes.md' }));

    expect(screen.queryByText('notes.md')).toBeNull();
    expect(screen.getByText('other.md')).toBeTruthy();
  });

  it('renders a manifest-kind staged row with distinct explanatory copy', async () => {
    const user = userEvent.setup({ delay: null });
    renderEditor(
      {},
      buildFileActions({
        validateBatch: vi.fn(
          async (candidates: SkillFileUploadCandidate[]) => ({
            results: candidates.map((c) => ({
              candidateId: c.id,
              status: SkillFileValidationStatus.Valid,
              kind: SkillFileCandidateKind.Manifest,
            })),
            batchErrors: [],
          }),
        ),
      }),
    );

    await openUploadDialog(user);
    stageFile(new File(['content'], 'SKILL.md'));

    expect(
      await screen.findByText(
        "Will replace this Skill's name, description, and instructions",
      ),
    ).toBeTruthy();
  });

  it('opens the upload dialog and stages a file dropped anywhere on the editor surface, without clicking Upload from device first', async () => {
    renderEditor();
    const file = new File(['content'], 'notes.md');

    fireEvent.drop(screen.getByRole('heading', { name: 'SKILL.md' }), {
      dataTransfer: { types: ['Files'], files: [file] },
    });

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(await screen.findByText('notes.md')).toBeTruthy();
  });

  it('shows a full-surface drop overlay while dragging over the editor, hidden once the dialog opens', async () => {
    renderEditor();
    const heading = screen.getByRole('heading', { name: 'SKILL.md' });
    const dragEvent = { dataTransfer: { types: ['Files'], files: [] } };

    fireEvent.dragEnter(heading, dragEvent);
    expect(screen.getByText('Upload files')).toBeTruthy();

    fireEvent.drop(heading, {
      dataTransfer: { types: ['Files'], files: [new File(['x'], 'a.md')] },
    });

    await screen.findByRole('dialog');
    expect(screen.queryByText('Upload files')).toBeNull();
  });

  it('requires confirmation before removing a supporting entry', async () => {
    const user = userEvent.setup({ delay: null });
    const onRemoveNode = vi.fn();
    renderEditor(
      {
        files: [
          { path: 'notes.md', name: 'notes.md', kind: SkillFileNodeKind.File },
        ],
      },
      buildFileActions({ onRemoveNode }),
    );

    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0]);

    expect(onRemoveNode).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

    expect(onRemoveNode).toHaveBeenCalledWith('notes.md');
  });

  it('updates the main-pane heading when a supporting file is selected', async () => {
    const user = userEvent.setup({ delay: null });
    const onSelectedPathChange = vi.fn();
    renderEditor({
      files: [
        { path: 'notes.md', name: 'notes.md', kind: SkillFileNodeKind.File },
      ],
      onSelectedPathChange,
    });

    await user.click(screen.getAllByRole('button', { name: 'notes.md' })[0]);

    expect(onSelectedPathChange).toHaveBeenCalledWith('notes.md');
    expect(
      screen.getAllByRole('heading', { name: 'notes.md' })[0],
    ).toBeTruthy();
  });

  it('renders supportingFileContent for a selected supporting file', async () => {
    const user = userEvent.setup({ delay: null });
    renderEditor({
      files: [
        { path: 'notes.md', name: 'notes.md', kind: SkillFileNodeKind.File },
      ],
      supportingFileContent: <div>Preview goes here</div>,
    });

    await user.click(screen.getAllByRole('button', { name: 'notes.md' })[0]);

    expect(screen.getByText('Preview goes here')).toBeTruthy();
    expect(
      screen.queryByText(
        'This supporting file is included in the skill package as-is. Remove it from the Files panel to replace its content.',
      ),
    ).toBeNull();
  });

  it('falls back to the default supportingFileNote when supportingFileContent is omitted', async () => {
    const user = userEvent.setup({ delay: null });
    renderEditor({
      files: [
        { path: 'notes.md', name: 'notes.md', kind: SkillFileNodeKind.File },
      ],
    });

    await user.click(screen.getAllByRole('button', { name: 'notes.md' })[0]);

    expect(
      screen.getByText(
        'This supporting file is included in the skill package as-is. Remove it from the Files panel to replace its content.',
      ),
    ).toBeTruthy();
  });

  it('does not render supportingFileContent when SKILL.md is selected', () => {
    renderEditor({
      files: [
        { path: 'notes.md', name: 'notes.md', kind: SkillFileNodeKind.File },
      ],
      supportingFileContent: <div>Preview goes here</div>,
    });

    expect(screen.queryByText('Preview goes here')).toBeNull();
  });

  it('does not render supportingFileContent when a folder is selected', async () => {
    const user = userEvent.setup({ delay: null });
    renderEditor({
      files: [
        {
          path: 'agents/analyzer.md',
          name: 'analyzer.md',
          kind: SkillFileNodeKind.File,
        },
      ],
      selectedPath: 'agents',
      supportingFileContent: <div>Preview goes here</div>,
    });

    expect(screen.queryByText('Preview goes here')).toBeNull();
    // Sanity check the folder node actually rendered.
    expect(screen.getAllByRole('button', { name: 'agents' })[0]).toBeTruthy();
    await user.click(screen.getAllByRole('button', { name: 'agents' })[0]);
    expect(screen.queryByText('Preview goes here')).toBeNull();
  });
});
