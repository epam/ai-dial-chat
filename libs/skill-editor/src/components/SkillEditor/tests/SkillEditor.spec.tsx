import type { DialFile } from '@epam/ai-dial-react-file-manager';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type {
  SkillEditorFileActions,
  SkillEditorProps,
} from '../../../models/skill-editor-props';
import { SkillEditor } from '../SkillEditor';

const renderFileNode = (
  file: DialFile,
  onItemClick?: (f: DialFile) => void,
) => (
  <li key={file.path}>
    <button onClick={() => onItemClick?.(file)}>{file.name}</button>
    {file.items?.map((child) => renderFileNode(child, onItemClick))}
  </li>
);

vi.mock('@epam/ai-dial-react-file-manager', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-react-file-manager')>();
  return {
    ...actual,
    DialFoldersTree: (props: ComponentProps<typeof actual.DialFoldersTree>) => (
      <ul role="tree">
        {props.items.map((file) => renderFileNode(file, props.onItemClick))}
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
    disabled,
  }: {
    labelProps?: { label: ReactNode; required?: boolean };
    value?: string;
    onChange?: (value: string) => void;
    error?: string;
    disabled?: boolean;
  }) => (
    <label>
      {labelProps?.label}
      {labelProps?.required && ' *'}
      <input
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
      />
      {error && <span>{error}</span>}
    </label>
  ),
  Textarea: ({
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
      {labelProps?.required && ' *'}
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
      />
      {error && <span>{error}</span>}
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

const fileActions: SkillEditorFileActions = {
  validatePath: () => undefined,
  onUploadFile: vi.fn(async () => undefined),
  onRemoveNode: vi.fn(),
};

const renderEditor = (props?: Partial<SkillEditorProps>) =>
  render(
    <SkillEditor
      files={[]}
      fileActions={fileActions}
      onSubmit={vi.fn()}
      onCancel={vi.fn()}
      {...props}
    />,
  );

describe('SkillEditor', () => {
  it('seeds the fields from initialValues', async () => {
    renderEditor({
      initialValues: {
        name: 'good-morning-breakfast',
        description: 'A morning greeting skill',
        instructions: '# Instructions',
      },
    });

    expect(screen.getByDisplayValue('good-morning-breakfast')).toBeTruthy();
    expect(screen.getByDisplayValue('A morning greeting skill')).toBeTruthy();
    // The Instructions editor is lazy-loaded, so it resolves asynchronously.
    expect(await screen.findByDisplayValue('# Instructions')).toBeTruthy();
  });

  it('updates local state when a field is edited and calls no external API', async () => {
    const user = userEvent.setup({ delay: null });
    const onSubmit = vi.fn();
    renderEditor({ onSubmit });

    await user.type(screen.getByRole('textbox', { name: /Name/ }), 'my-skill');

    expect(screen.getByDisplayValue('my-skill')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('renders host-supplied errors inline', () => {
    renderEditor({ errors: { name: 'A skill with this name already exists' } });

    expect(
      screen.getByText('A skill with this name already exists'),
    ).toBeTruthy();
  });

  it('disables Cancel and Create while submitting', () => {
    // Both the desktop header and the mobile sticky footer render their own
    // copy of the actions, toggled purely by CSS — both must be disabled.
    renderEditor({ isSubmitting: true });

    for (const button of screen.getAllByRole('button', { name: 'Cancel' })) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
    for (const button of screen.getAllByRole('button', { name: 'Create' })) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('renders submitError in an alert region without clearing field values', () => {
    renderEditor({
      initialValues: { name: 'my-skill' },
      submitError: 'A skill with this name already exists',
    });

    expect(screen.getByRole('alert').textContent).toContain(
      'A skill with this name already exists',
    );
    expect(screen.getByDisplayValue('my-skill')).toBeTruthy();
  });

  it('submits the current field values', async () => {
    const user = userEvent.setup({ delay: null });
    const onSubmit = vi.fn();
    renderEditor({ onSubmit, initialValues: { name: 'my-skill' } });

    await user.click(screen.getAllByRole('button', { name: 'Create' })[0]);

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'my-skill',
      description: '',
      instructions: '',
    });
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    const onCancel = vi.fn();
    renderEditor({ onCancel });

    await user.click(screen.getAllByRole('button', { name: 'Cancel' })[0]);

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows a loading state and no form when isLoading is true', () => {
    renderEditor({ isLoading: true });

    expect(screen.queryByRole('textbox', { name: /Name/ })).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('shows a retry action when hasLoadError is true', async () => {
    const user = userEvent.setup({ delay: null });
    const onRetry = vi.fn();
    renderEditor({ hasLoadError: true, onRetry });

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('applies an explicit dir override to the root element without reading i18n', () => {
    const { container } = renderEditor({ dir: 'rtl' });

    expect(container.querySelector('[dir="rtl"]')).toBeTruthy();
  });

  it('exposes the Name field via an accessible role so keyboard users can reach it', () => {
    renderEditor();

    // A field reachable only via getByRole (not getByTestId/querySelector)
    // confirms it carries a real accessible name for keyboard/AT users.
    expect(screen.getByRole('textbox', { name: /Name/ })).toBeTruthy();
  });

  it('disables the Name field when isNameReadOnly is set', () => {
    renderEditor({
      isNameReadOnly: true,
      initialValues: { name: 'good-morning-breakfast' },
    });

    expect(
      (screen.getByDisplayValue('good-morning-breakfast') as HTMLInputElement)
        .disabled,
    ).toBe(true);
  });

  it('calls onDirtyChange(true) on the first edit and onDirtyChange(false) when reverted', async () => {
    const onDirtyChange = vi.fn();
    const user = userEvent.setup({ delay: null });
    renderEditor({
      onDirtyChange,
      initialValues: { name: 'good-morning-breakfast' },
    });

    const nameField = screen.getByDisplayValue('good-morning-breakfast');
    await user.type(nameField, '-v2');
    expect(onDirtyChange).toHaveBeenCalledWith(true);

    onDirtyChange.mockClear();
    await user.clear(nameField);
    await user.type(nameField, 'good-morning-breakfast');
    expect(onDirtyChange).toHaveBeenCalledWith(false);
  });

  it('renders a conflict message with a working Reload latest control', async () => {
    const onReloadLatest = vi.fn();
    const user = userEvent.setup({ delay: null });
    renderEditor({
      conflict: { message: 'Someone else changed this skill' },
      onReloadLatest,
    });

    expect(screen.getByText('Someone else changed this skill')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Reload latest' }));
    expect(onReloadLatest).toHaveBeenCalledOnce();
  });

  it('renders headerContent in the desktop header row alongside the actions', () => {
    renderEditor({
      headerContent: <span>Back + Create skill</span>,
    });

    expect(screen.getByText('Back + Create skill')).toBeTruthy();
  });
});
