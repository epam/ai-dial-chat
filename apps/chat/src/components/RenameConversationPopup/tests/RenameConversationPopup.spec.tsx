import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ButtonsI18nKeys } from '../../../constants/translation-keys';
import RenameConversationPopup from '../RenameConversationPopup';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  PopupSize: { Sm: 'sm' },
  DialFormPopup: ({
    open,
    header,
    children,
    onClose,
    onCancel,
    onSubmit,
    cancelLabel,
    submitLabel,
    isLoading,
    disableSubmitButton,
  }: {
    open: boolean;
    header?: React.ReactNode;
    children?: React.ReactNode;
    onClose?: () => void;
    onCancel?: () => void;
    onSubmit?: () => void;
    cancelLabel?: string;
    submitLabel?: string;
    isLoading?: boolean;
    disableSubmitButton?: boolean;
  }) =>
    open ? (
      <div role="dialog" aria-label="Rename conversation">
        <h2>{header}</h2>
        <button type="button" aria-label="Close" onClick={onClose} />
        {children}
        <button type="button" onClick={onCancel} disabled={isLoading}>
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disableSubmitButton ?? isLoading}
        >
          {submitLabel}
        </button>
      </div>
    ) : null,
  DialInput: ({
    value,
    placeholder,
    onChange,
    onKeyDown,
    inputRef,
    error,
  }: {
    value?: string;
    placeholder?: string;
    onChange?: (v?: string) => void;
    onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
    inputRef?: React.Ref<HTMLInputElement>;
    error?: string;
  }) => (
    <>
      <input
        ref={inputRef}
        aria-label="Conversation title"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {error && <p role="alert">{error}</p>}
    </>
  ),
}));

const DEFAULT_PROPS = {
  isOpen: true,
  currentTitle: 'My Chat',
  isSaving: false,
  error: null,
  onSave: vi.fn(),
  onCancel: vi.fn(),
};

const getSaveButton = () =>
  screen.getByRole('button', {
    name: ButtonsI18nKeys.Save,
  }) as HTMLButtonElement;
const getCancelButton = () =>
  screen.getByRole('button', {
    name: ButtonsI18nKeys.Cancel,
  }) as HTMLButtonElement;
const getInput = () =>
  screen.getByRole('textbox', {
    name: 'Conversation title',
  }) as HTMLInputElement;

describe('RenameConversationPopup', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pre-fills the input with currentTitle', () => {
    render(<RenameConversationPopup {...DEFAULT_PROPS} />);
    expect(getInput().value).toBe('My Chat');
  });

  it('Save button is disabled when value is unchanged', () => {
    render(<RenameConversationPopup {...DEFAULT_PROPS} />);
    expect(getSaveButton().disabled).toBe(true);
  });

  it('Save button is disabled when value is whitespace-only', async () => {
    render(<RenameConversationPopup {...DEFAULT_PROPS} />);
    await user.clear(getInput());
    await user.type(getInput(), '   ');
    expect(getSaveButton().disabled).toBe(true);
  });

  it('Save button is disabled while isSaving is true', async () => {
    render(<RenameConversationPopup {...DEFAULT_PROPS} isSaving={true} />);
    await user.clear(getInput());
    await user.type(getInput(), 'New Title');
    expect(getSaveButton().disabled).toBe(true);
  });

  it('Save button is enabled when value differs from currentTitle', async () => {
    render(<RenameConversationPopup {...DEFAULT_PROPS} />);
    await user.clear(getInput());
    await user.type(getInput(), 'New Title');
    expect(getSaveButton().disabled).toBe(false);
  });

  it('calls onSave with trimmed value on Save click', async () => {
    const onSave = vi.fn();
    render(<RenameConversationPopup {...DEFAULT_PROPS} onSave={onSave} />);
    await user.clear(getInput());
    await user.type(getInput(), '  New Title  ');
    await user.click(getSaveButton());
    expect(onSave).toHaveBeenCalledWith('New Title');
  });

  it('calls onCancel on Cancel click', async () => {
    const onCancel = vi.fn();
    render(<RenameConversationPopup {...DEFAULT_PROPS} onCancel={onCancel} />);
    await user.click(getCancelButton());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows API error message when error prop is provided', () => {
    render(
      <RenameConversationPopup
        {...DEFAULT_PROPS}
        error="Failed to rename. Please try again."
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain('Failed to rename');
  });

  it('Save button is disabled when title exceeds 255 UTF-8 bytes', async () => {
    render(<RenameConversationPopup {...DEFAULT_PROPS} currentTitle="" />);
    await user.type(getInput(), 'a'.repeat(256));
    expect(getSaveButton().disabled).toBe(true);
  });

  it('shows byte-length validation error when title exceeds 255 UTF-8 bytes', async () => {
    render(<RenameConversationPopup {...DEFAULT_PROPS} currentTitle="" />);
    await user.type(getInput(), 'a'.repeat(256));
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('does not render when isOpen is false', () => {
    render(<RenameConversationPopup {...DEFAULT_PROPS} isOpen={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
