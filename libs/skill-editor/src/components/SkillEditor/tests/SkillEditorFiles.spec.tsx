import type { DialFile } from '@epam/ai-dial-react-file-manager';
import type { DropdownItem } from '@epam/ai-dial-ui-kit';
import { render, screen, within } from '@testing-library/react';
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
  Dropdown: ({
    items,
    children,
  }: {
    items?: DropdownItem[];
    children: ReactNode;
  }) => (
    <div>
      {children}
      {items?.map((item) => (
        <button
          key={item.key}
          onClick={() =>
            item.onClick?.({
              key: item.key,
              domEvent: fakeMouseEvent,
            })
          }
        >
          {item.label}
        </button>
      ))}
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
}));

const buildFileActions = (
  overrides?: Partial<SkillEditorFileActions>,
): SkillEditorFileActions => ({
  validatePath: () => undefined,
  onAddNode: vi.fn(),
  onUploadFile: vi.fn(async () => undefined),
  onRemoveNode: vi.fn(),
  ...overrides,
});

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

  it('adds a new file when the path is accepted by validatePath', async () => {
    const user = userEvent.setup({ delay: null });
    const onAddNode = vi.fn();
    renderEditor({}, buildFileActions({ onAddNode }));

    await user.click(screen.getAllByRole('button', { name: 'New file' })[0]);
    const input = screen.getAllByRole('textbox', { name: 'Path' })[0];
    await user.type(input, 'agents/analyzer.md');
    await user.click(screen.getAllByRole('button', { name: 'Add' })[1]);

    expect(onAddNode).toHaveBeenCalledWith(
      'agents/analyzer.md',
      SkillFileNodeKind.File,
    );
  });

  it('shows the validation error and adds nothing for a rejected path', async () => {
    const user = userEvent.setup({ delay: null });
    const onAddNode = vi.fn();
    renderEditor(
      {},
      buildFileActions({
        validatePath: () => 'A file already exists at this path',
        onAddNode,
      }),
    );

    await user.click(screen.getAllByRole('button', { name: 'New file' })[0]);
    const input = screen.getAllByRole('textbox', { name: 'Path' })[0];
    await user.type(input, 'notes.md');
    await user.click(screen.getAllByRole('button', { name: 'Add' })[1]);

    expect(
      screen.getAllByText('A file already exists at this path')[0],
    ).toBeTruthy();
    expect(onAddNode).not.toHaveBeenCalled();
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
});
