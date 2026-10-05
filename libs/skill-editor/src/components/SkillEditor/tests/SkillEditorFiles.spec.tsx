import type { DialFile } from '@epam/ai-dial-react-file-manager';
import type { DropdownItem } from '@epam/ai-dial-ui-kit';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  ComponentProps,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from 'react';
import { useState } from 'react';
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

/*
 * Menu items render as buttons; a submenu (`children`) renders as a list
 * named after its parent entry, so tests can scope with `within`.
 */
const renderMenuItems = (
  items: DropdownItem[],
  onSelect?: () => void,
): ReactNode =>
  items.map(({ key, label, danger, children: subItems, onClick }) =>
    subItems ? (
      <ul key={key} aria-label={String(label)}>
        {renderMenuItems(subItems, onSelect)}
      </ul>
    ) : (
      <button
        key={key}
        role="menuitem"
        className={danger ? 'text-error' : undefined}
        onClick={() => {
          onClick?.({ key, domEvent: fakeMouseEvent });
          onSelect?.();
        }}
      >
        {label}
      </button>
    ),
  );

type TreeProps = ComponentProps<
  typeof import('@epam/ai-dial-react-file-manager').DialFoldersTree
>;

/*
 * Mirrors the kit's inline rename field (`useEditableItem`): Enter blurs;
 * blur saves a valid value, otherwise falls back to the prefilled name when
 * that name is valid, otherwise cancels. Escape cancels.
 */
const RenameField = ({ file, props }: { file: DialFile; props: TreeProps }) => {
  const [value, setValue] = useState(file.name);
  const [error, setError] = useState<string | null>(null);
  const validate = (next: string) =>
    props.onRenameValidate?.(next, file) ?? null;
  const handleBlur = () => {
    if (!validate(value)) {
      props.onRenameSave?.(value);
      return;
    }
    if (!validate(file.name)) props.onRenameSave?.(file.name);
    else props.onRenameCancel?.();
  };
  return (
    <>
      <input
        aria-label="Folder name"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setError(validate(event.target.value));
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') handleBlur();
          if (event.key === 'Escape') props.onRenameCancel?.();
        }}
      />
      {error && <span>{error}</span>}
    </>
  );
};

const renderFileNode = (file: DialFile, props: TreeProps): ReactNode => (
  <li key={file.path}>
    {file.path === props.renamedPath ? (
      <RenameField file={file} props={props} />
    ) : (
      <button onClick={() => props.onItemClick?.(file)}>{file.name}</button>
    )}
    {renderMenuItems(props.getContextMenuItems?.(file) ?? [])}
    {file.items?.map((child) => renderFileNode(child, props))}
  </li>
);

vi.mock('@epam/ai-dial-react-file-manager', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-react-file-manager')>();
  return {
    ...actual,
    DialFoldersTree: (props: TreeProps) => (
      <ul role="tree">
        {props.items.map((file) => renderFileNode(file, props))}
      </ul>
    ),
  };
});

vi.mock('@epam/ai-dial-ui-kit', () => ({
  ButtonDropdown: ({
    label,
    items,
  }: {
    label: ReactNode;
    items: DropdownItem[];
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <div>
        <button
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
        >
          {label}
        </button>
        {isOpen && (
          <div role="menu">
            {renderMenuItems(items, () => setIsOpen(false))}
          </div>
        )}
      </div>
    );
  },
  Label: ({
    id,
    htmlFor,
    label,
    required,
  }: {
    id?: string;
    htmlFor?: string;
    label?: ReactNode;
    required?: boolean;
  }) => (
    <label id={id} htmlFor={htmlFor}>
      {label}
      {required && ' *'}
    </label>
  ),
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { LG: 24, MD: 20, SM: 16 },
  EditorThemes: { dark: 'dark', light: 'light' },
  TextareaResize: { Vertical: 'vertical' },
  TagInput: () => null,
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
  FileDropzone: ({
    label,
    ariaLabel,
    multiple,
    onChange,
  }: {
    label: ReactNode;
    ariaLabel?: string;
    multiple?: boolean;
    onChange: (files: File[]) => void;
  }) => (
    <div>
      <span>{label}</span>
      <input
        type="file"
        multiple={multiple}
        aria-label={ariaLabel}
        onChange={(event) => onChange(Array.from(event.target.files ?? []))}
      />
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
  ButtonVariant: { Primary: 'primary', Neutral: 'neutral', Danger: 'danger' },
  ButtonAppearance: { Solid: 'solid', Ghost: 'ghost', Link: 'link' },
  ElementSize: { Small: 'small', Standard: 'standard', Large: 'large' },
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
      <div
        role="dialog"
        aria-label={typeof header === 'string' ? header : undefined}
      >
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
}));

vi.mock('@epam/ai-dial-ui-kit/editors', () => ({
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
  IconArrowNarrowLeft: () => <svg />,
  IconDatabase: () => <svg />,
  IconFileText: () => <svg />,
  IconFileZip: () => <svg />,
  IconFolderPlus: () => <svg />,
  IconPlus: () => <svg />,
  IconTrashX: () => <svg />,
  IconUpload: () => <svg />,
}));

const buildFileActions = (
  overrides?: Partial<SkillEditorFileActions>,
): SkillEditorFileActions => ({
  validateBatch: vi.fn(async () => ({ results: [], batchErrors: [] })),
  commitBatch: vi.fn(async () => ({})),
  onRemoveNode: vi.fn(),
  ...overrides,
});

type User = ReturnType<typeof userEvent.setup>;

const openAddMenu = async (user: User) => {
  await user.click(screen.getAllByRole('button', { name: 'Add' })[0]);
  return screen.getAllByRole('menu')[0];
};

const openUploadDialog = async (user: User) => {
  const menu = await openAddMenu(user);
  await user.click(
    within(menu).getByRole('menuitem', { name: 'Upload files from device' }),
  );
};

const confirmDialog = async (user: User) => {
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Add' }),
  );
};

const acceptAll = vi.fn(async (candidates: SkillFileUploadCandidate[]) => ({
  results: candidates.map((c) => ({
    candidateId: c.id,
    status: SkillFileValidationStatus.Valid,
    kind: SkillFileCandidateKind.SupportingFile,
  })),
  batchErrors: [],
}));

const stageFile = (file: File) => {
  fireEvent.change(screen.getByLabelText('Upload files'), {
    target: { files: [file] },
  });
};

const renderEditor = (
  props?: Partial<SkillEditorProps>,
  fileActions?: SkillEditorFileActions,
) =>
  render(
    <SkillEditor
      title="Test Skill"
      onBack={vi.fn()}
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

  it('exposes no menu for the protected SKILL.md node', () => {
    renderEditor({
      files: [
        { path: 'notes.md', name: 'notes.md', kind: SkillFileNodeKind.File },
      ],
    });

    // One Delete per rendered pane (mobile + desktop) for notes.md; none for SKILL.md.
    expect(screen.getAllByRole('menuitem', { name: 'Delete' })).toHaveLength(2);
    expect(screen.getAllByRole('list', { name: 'Add sibling' })).toHaveLength(
      2,
    );
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

    await confirmDialog(user);

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
      (
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Add',
        }) as HTMLButtonElement
      ).disabled,
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

    await confirmDialog(user);

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

  it('opens the upload dialog and stages a file dropped anywhere on the editor surface, without opening the Add menu first', async () => {
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

  it('removes a supporting entry immediately, with no confirmation', async () => {
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

    await user.click(screen.getAllByRole('menuitem', { name: 'Delete' })[0]);

    expect(onRemoveNode).toHaveBeenCalledWith('notes.md');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('resets the selection to SKILL.md when the removed node was selected', async () => {
    const user = userEvent.setup({ delay: null });
    const onSelectedPathChange = vi.fn();
    renderEditor({
      files: [
        { path: 'notes.md', name: 'notes.md', kind: SkillFileNodeKind.File },
      ],
      onSelectedPathChange,
    });

    await user.click(screen.getAllByRole('button', { name: 'notes.md' })[0]);
    await user.click(screen.getAllByRole('menuitem', { name: 'Delete' })[0]);

    expect(onSelectedPathChange).toHaveBeenLastCalledWith('SKILL.md');
    expect(
      screen.getAllByRole('heading', { name: 'SKILL.md' })[0],
    ).toBeTruthy();
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

  it('shows the SKILL.md Name and Description only while SKILL.md is selected', async () => {
    const user = userEvent.setup({ delay: null });
    renderEditor({
      initialValues: { name: 'good-morning', description: 'Says hi' },
      files: [
        { path: 'notes.md', name: 'notes.md', kind: SkillFileNodeKind.File },
      ],
    });

    expect(screen.getByRole('heading', { name: 'SKILL.md' })).toBeTruthy();
    expect(screen.getByDisplayValue('good-morning')).toBeTruthy();
    expect(screen.getByDisplayValue('Says hi')).toBeTruthy();

    await user.click(screen.getAllByRole('button', { name: 'notes.md' })[0]);

    expect(
      screen.getAllByRole('heading', { name: 'notes.md' })[0],
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'SKILL.md' })).toBeNull();
    expect(screen.queryByDisplayValue('good-morning')).toBeNull();
    expect(screen.queryByDisplayValue('Says hi')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Metadata' })).toBeNull();
  });

  it('orders the Editing file accordion, then the SKILL.md heading, then Name in the stacked mobile column', () => {
    renderEditor();

    const filesAccordion = screen.getByRole('heading', {
      name: 'Editing file',
    });
    const manifestHeading = screen.getByRole('heading', { name: 'SKILL.md' });
    const nameField = screen.getByRole('textbox', { name: /Name/ });

    expect(
      filesAccordion.compareDocumentPosition(manifestHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      manifestHeading.compareDocumentPosition(nameField) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Metadata' })).toBeNull();
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

const docsFolder = {
  path: 'docs',
  name: 'docs',
  kind: SkillFileNodeKind.Folder,
};
const docsFile = {
  path: 'docs/a.md',
  name: 'a.md',
  kind: SkillFileNodeKind.File,
};

const fullFileActions = (overrides?: Partial<SkillEditorFileActions>) =>
  buildFileActions({
    validateBatch: acceptAll,
    onCreateFolder: vi.fn(),
    extractArchive: vi.fn(async () => []),
    pickFromFileSystem: vi.fn(async () => undefined),
    ...overrides,
  });

const stagedPaths = (commitBatch: SkillEditorFileActions['commitBatch']) =>
  vi
    .mocked(commitBatch)
    .mock.calls.at(-1)?.[0]
    .map((candidate) => candidate.path);

describe('SkillEditor — Add dropdown', () => {
  it('lists only the device upload when the host supplies no optional capability', async () => {
    const user = userEvent.setup({ delay: null });
    renderEditor();

    const menu = await openAddMenu(user);

    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Upload files from device']);
  });

  it('lists all four actions and reports the open state when the host supplies every capability', async () => {
    const user = userEvent.setup({ delay: null });
    renderEditor({}, fullFileActions());
    const trigger = screen.getAllByRole('button', { name: 'Add' })[0];
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    const menu = await openAddMenu(user);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Create folder',
      'Upload files from device',
      'Upload archive from device',
      'Open DIAL file system',
    ]);
  });

  it('stages header uploads inside the selected folder', async () => {
    const user = userEvent.setup({ delay: null });
    const actions = fullFileActions();
    renderEditor({ files: [docsFolder], selectedPath: 'docs' }, actions);

    await openUploadDialog(user);
    stageFile(new File(['x'], 'a.md'));
    await screen.findByText('docs/a.md');
    await confirmDialog(user);

    expect(stagedPaths(actions.commitBatch)).toEqual(['docs/a.md']);
  });

  it('stages header uploads at the root when a file is selected', async () => {
    const user = userEvent.setup({ delay: null });
    renderEditor(
      { files: [docsFile], selectedPath: 'docs/a.md' },
      fullFileActions(),
    );

    await openUploadDialog(user);
    stageFile(new File(['x'], 'b.md'));

    expect(await screen.findByText('b.md')).toBeTruthy();
  });

  it('renders the Add trigger inside a right-to-left root', () => {
    renderEditor({ dir: 'rtl' });

    const addTrigger = screen.getAllByRole('button', { name: 'Add' })[0];
    // eslint-disable-next-line testing-library/no-node-access -- the root surface has no role or text to query; the assertion is about the trigger's ancestry
    expect(addTrigger.closest('[dir="rtl"]')).toBeTruthy();
  });
});

describe('SkillEditor — node menu', () => {
  it('offers Add child, Add sibling and Delete on a folder', () => {
    renderEditor({ files: [docsFolder] }, fullFileActions());

    expect(screen.getAllByRole('list', { name: 'Add child' })).toHaveLength(2);
    expect(screen.getAllByRole('list', { name: 'Add sibling' })).toHaveLength(
      2,
    );
    expect(screen.getAllByRole('menuitem', { name: 'Delete' })).toHaveLength(2);
  });

  it('offers no Add child on a file', () => {
    renderEditor(
      {
        files: [
          { path: 'notes.md', name: 'notes.md', kind: SkillFileNodeKind.File },
        ],
      },
      fullFileActions(),
    );

    expect(screen.queryByRole('list', { name: 'Add child' })).toBeNull();
    expect(screen.getAllByRole('list', { name: 'Add sibling' })).toHaveLength(
      2,
    );
  });

  it('stages an Add sibling upload next to a nested file', async () => {
    const user = userEvent.setup({ delay: null });
    renderEditor({ files: [docsFile] }, fullFileActions());

    // Scope to a.md's own row; the implied docs folder has an Add sibling of its own.
    const [fileRow] = screen
      .getAllByRole('listitem')
      .filter(
        (row) =>
          within(row).queryByRole('button', { name: 'a.md' }) &&
          within(row).queryAllByRole('listitem').length === 0,
      );
    const sibling = within(fileRow).getByRole('list', { name: 'Add sibling' });
    await user.click(
      within(sibling).getByRole('menuitem', {
        name: 'Upload files from device',
      }),
    );
    stageFile(new File(['x'], 'c.md'));

    expect(await screen.findByText('docs/c.md')).toBeTruthy();
  });

  it('deletes a folder subtree immediately', async () => {
    const user = userEvent.setup({ delay: null });
    const onRemoveNode = vi.fn();
    renderEditor(
      { files: [docsFolder, docsFile] },
      fullFileActions({ onRemoveNode }),
    );

    await user.click(screen.getAllByRole('menuitem', { name: 'Delete' })[0]);

    expect(onRemoveNode).toHaveBeenCalledWith('docs');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders Delete as a danger item and leaves the Add entries neutral', () => {
    renderEditor(
      {
        files: [
          { path: 'notes.md', name: 'notes.md', kind: SkillFileNodeKind.File },
        ],
      },
      fullFileActions(),
    );

    for (const item of screen.getAllByRole('menuitem', { name: 'Delete' })) {
      expect(item.className).toBe('text-error');
    }
    for (const item of screen.getAllByRole('menuitem', {
      name: 'Create folder',
    })) {
      expect(item.className).toBe('');
    }
  });

  it('labels the Delete entry with a host deleteLabel', () => {
    renderEditor(
      {
        files: [
          { path: 'notes.md', name: 'notes.md', kind: SkillFileNodeKind.File },
        ],
        labels: { deleteLabel: 'Entfernen' },
      },
      fullFileActions(),
    );

    expect(screen.getAllByRole('menuitem', { name: 'Entfernen' })).toHaveLength(
      2,
    );
  });
});

describe('SkillEditor — Create folder', () => {
  const startCreateFromHeader = async (user: User) => {
    const menu = await openAddMenu(user);
    await user.click(
      within(menu).getByRole('menuitem', { name: 'Create folder' }),
    );
    return screen.getAllByLabelText('Folder name')[0] as HTMLInputElement;
  };

  it('creates a root folder with the typed name and selects it', async () => {
    const user = userEvent.setup({ delay: null });
    const onCreateFolder = vi.fn();
    const onSelectedPathChange = vi.fn();
    renderEditor({ onSelectedPathChange }, fullFileActions({ onCreateFolder }));

    const input = await startCreateFromHeader(user);
    expect(input.value).toBe('New folder');
    await user.clear(input);
    await user.type(input, 'scripts{Enter}');

    expect(onCreateFolder).toHaveBeenCalledWith('scripts');
    expect(onSelectedPathChange).toHaveBeenLastCalledWith('scripts');
    expect(screen.queryByLabelText('Folder name')).toBeNull();
  });

  it('creates a nested folder from Add child and expands its parent', async () => {
    const user = userEvent.setup({ delay: null });
    const onCreateFolder = vi.fn();
    const onExpandedPathsChange = vi.fn();
    renderEditor(
      { files: [docsFolder], onExpandedPathsChange },
      fullFileActions({ onCreateFolder }),
    );

    const child = screen.getAllByRole('list', { name: 'Add child' })[0];
    await user.click(
      within(child).getByRole('menuitem', { name: 'Create folder' }),
    );

    expect(onExpandedPathsChange).toHaveBeenCalledWith(['docs']);
    const input = screen.getAllByLabelText('Folder name')[0];
    await user.clear(input);
    await user.type(input, 'img{Enter}');

    expect(onCreateFolder).toHaveBeenCalledWith('docs/img');
  });

  it('rejects a duplicate sibling name without creating a fallback folder', async () => {
    const user = userEvent.setup({ delay: null });
    const onCreateFolder = vi.fn();
    renderEditor({ files: [docsFolder] }, fullFileActions({ onCreateFolder }));

    const input = await startCreateFromHeader(user);
    await user.clear(input);
    await user.type(input, 'docs');

    expect(
      screen.getAllByText('An item with this name already exists here')[0],
    ).toBeTruthy();

    await user.type(input, '{Enter}');

    expect(onCreateFolder).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Folder name')).toBeNull();
  });

  it('rejects the root SKILL.md name and separators', async () => {
    const user = userEvent.setup({ delay: null });
    renderEditor({}, fullFileActions());

    const input = await startCreateFromHeader(user);
    await user.clear(input);
    await user.type(input, 'SKILL.md');
    expect(
      screen.getAllByText('An item with this name already exists here')[0],
    ).toBeTruthy();

    await user.clear(input);
    await user.type(input, 'a/b');
    expect(
      screen.getAllByText(
        "Folder name can't contain / or \\, or be . or ..",
      )[0],
    ).toBeTruthy();
  });

  it('shows the host folder-path rule after the structural checks', async () => {
    const user = userEvent.setup({ delay: null });
    const validateFolderPath = vi.fn((path: string) =>
      path === 'node_modules' ? 'Reserved name' : undefined,
    );
    renderEditor({}, fullFileActions({ validateFolderPath }));

    const input = await startCreateFromHeader(user);
    await user.clear(input);
    await user.type(input, 'node_modules');

    expect(screen.getAllByText('Reserved name')[0]).toBeTruthy();
  });

  it('renders the draft only in the Files pane it was started from', async () => {
    const user = userEvent.setup({ delay: null });
    renderEditor({}, fullFileActions());

    await startCreateFromHeader(user);

    // The pane renders once per breakpoint; a second live rename field would save on the same outside click.
    expect(screen.getAllByLabelText('Folder name')).toHaveLength(1);
  });

  it('removes the draft on Escape without calling the host', async () => {
    const user = userEvent.setup({ delay: null });
    const onCreateFolder = vi.fn();
    renderEditor({}, fullFileActions({ onCreateFolder }));

    const input = await startCreateFromHeader(user);
    await user.type(input, '{Escape}');

    expect(screen.queryByLabelText('Folder name')).toBeNull();
    expect(onCreateFolder).not.toHaveBeenCalled();
  });

  it('offers no Create folder when the host omits onCreateFolder', async () => {
    const user = userEvent.setup({ delay: null });
    renderEditor({ files: [docsFolder] });

    const menu = await openAddMenu(user);

    expect(
      within(menu).queryByRole('menuitem', { name: 'Create folder' }),
    ).toBeNull();
    expect(
      screen.queryByRole('menuitem', { name: 'Create folder' }),
    ).toBeNull();
  });
});

describe('SkillEditor — Upload archive', () => {
  const openArchiveDialogFor = async (user: User) => {
    const child = screen.getAllByRole('list', { name: 'Add child' })[0];
    await user.click(
      within(child).getByRole('menuitem', {
        name: 'Upload archive from device',
      }),
    );
  };

  it('stages archive entries under the target folder with their structure', async () => {
    const user = userEvent.setup({ delay: null });
    const extractArchive = vi.fn(async () => [
      { path: 'refs/a.md', file: new File(['a'], 'a.md') },
      { path: 'b.py', file: new File(['b'], 'b.py') },
    ]);
    const actions = fullFileActions({ extractArchive });
    renderEditor({ files: [docsFolder] }, actions);

    await openArchiveDialogFor(user);
    expect(
      screen.getByRole('dialog', { name: 'Upload archive from device' }),
    ).toBeTruthy();
    const archive = new File(['zip'], 'bundle.zip');
    stageFile(archive);

    expect(await screen.findByText('docs/refs/a.md')).toBeTruthy();
    expect(extractArchive).toHaveBeenCalledWith(archive);
    await confirmDialog(user);
    expect(stagedPaths(actions.commitBatch)).toEqual([
      'docs/refs/a.md',
      'docs/b.py',
    ]);
  });

  it('shows the host per-entry errors for archive entries', async () => {
    const user = userEvent.setup({ delay: null });
    renderEditor(
      { files: [docsFolder] },
      fullFileActions({
        extractArchive: vi.fn(async () => [
          { path: '../evil.sh', file: new File(['x'], 'evil.sh') },
        ]),
        validateBatch: vi.fn(
          async (candidates: SkillFileUploadCandidate[]) => ({
            results: candidates.map((c) => ({
              candidateId: c.id,
              status: SkillFileValidationStatus.Invalid,
              kind: SkillFileCandidateKind.SupportingFile,
              error: 'Invalid path',
            })),
            batchErrors: [],
          }),
        ),
      }),
    );

    await openArchiveDialogFor(user);
    stageFile(new File(['zip'], 'bundle.zip'));

    expect(await screen.findByText('Invalid path')).toBeTruthy();
  });

  it('announces an unreadable archive and stages nothing', async () => {
    const user = userEvent.setup({ delay: null });
    renderEditor(
      { files: [docsFolder] },
      fullFileActions({
        extractArchive: vi.fn(async () => {
          throw new Error('bad zip');
        }),
      }),
    );

    await openArchiveDialogFor(user);
    stageFile(new File(['zip'], 'bundle.zip'));

    const alert = await screen.findByRole('alert');
    expect(
      await within(alert).findByText("Couldn't read this archive"),
    ).toBeTruthy();
    expect(
      within(screen.getByRole('dialog')).queryByRole('listitem'),
    ).toBeNull();
  });

  it('reports an archive with no files', async () => {
    const user = userEvent.setup({ delay: null });
    renderEditor({ files: [docsFolder] }, fullFileActions());

    await openArchiveDialogFor(user);
    stageFile(new File(['zip'], 'empty.zip'));

    expect(await screen.findByText('This archive has no files')).toBeTruthy();
  });
});

describe('SkillEditor — Open DIAL file system', () => {
  it('stages the files the host picker resolves', async () => {
    const user = userEvent.setup({ delay: null });
    const pickFromFileSystem = vi.fn(async () => [
      { path: 'notes.md', file: new File(['x'], 'notes.md') },
    ]);
    renderEditor({}, fullFileActions({ pickFromFileSystem }));

    const menu = await openAddMenu(user);
    await user.click(
      within(menu).getByRole('menuitem', { name: 'Open DIAL file system' }),
    );

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(await screen.findByText('notes.md')).toBeTruthy();
  });

  it('changes nothing when the picker is cancelled', async () => {
    const user = userEvent.setup({ delay: null });
    const pickFromFileSystem = vi.fn(async () => undefined);
    renderEditor({}, fullFileActions({ pickFromFileSystem }));

    const menu = await openAddMenu(user);
    await user.click(
      within(menu).getByRole('menuitem', { name: 'Open DIAL file system' }),
    );

    expect(pickFromFileSystem).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
