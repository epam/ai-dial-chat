import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeyboardEventHandler, ReactNode, Ref } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ButtonsI18nKeys,
  ConversationPanelI18nKeys,
} from '../../../constants/translation-keys';
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
    header?: ReactNode;
    children?: ReactNode;
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
  Input: ({
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
    onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
    inputRef?: Ref<HTMLInputElement>;
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
  Spinner: () => <span role="status">Loading</span>,
  DIAL_ICON_SIZE: { SM: 18, MD: 20 },
  GhostIconButton: ({
    icon,
    onClick,
    disabled,
    'aria-label': ariaLabel,
  }: {
    icon?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    'aria-label'?: string;
    tooltipProps?: unknown;
  }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
    </button>
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconSparkles: () => <svg aria-hidden="true" />,
}));

const DEFAULT_PROPS = {
  isOpen: true,
  currentTitle: 'My Chat',
  isSaving: false,
  error: null,
  onSave: vi.fn(),
  onCancel: vi.fn(),
  onGenerateWithAi: vi.fn().mockResolvedValue('AI Suggested Name'),
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
const getAiButton = () =>
  screen.getByRole('button', {
    name: ConversationPanelI18nKeys.RenameWithAiLabel,
  }) as HTMLButtonElement;

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

  it('renders the AI rename button', () => {
    render(<RenameConversationPopup {...DEFAULT_PROPS} />);
    expect(getAiButton()).toBeTruthy();
  });

  it('calls onGenerateWithAi and populates the input with the returned name', async () => {
    const onGenerateWithAi = vi.fn().mockResolvedValue('AI Suggested Name');
    render(
      <RenameConversationPopup
        {...DEFAULT_PROPS}
        onGenerateWithAi={onGenerateWithAi}
      />,
    );

    await user.click(getAiButton());

    expect(onGenerateWithAi).toHaveBeenCalledOnce();
    await waitFor(() => expect(getInput().value).toBe('AI Suggested Name'));
  });

  it('shows a spinner and disables the AI button while generating', async () => {
    let resolveGenerate: (name: string) => void = () => undefined;
    const onGenerateWithAi = vi.fn().mockReturnValue(
      new Promise<string>((resolve) => {
        resolveGenerate = resolve;
      }),
    );
    render(
      <RenameConversationPopup
        {...DEFAULT_PROPS}
        onGenerateWithAi={onGenerateWithAi}
      />,
    );

    await user.click(getAiButton());

    expect(await screen.findByRole('status')).toBeTruthy();
    expect(getAiButton().disabled).toBe(true);

    resolveGenerate('Done');
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });

  it('surfaces an error and leaves the input unchanged when generation fails', async () => {
    const onGenerateWithAi = vi.fn().mockRejectedValue(new Error('boom'));
    render(
      <RenameConversationPopup
        {...DEFAULT_PROPS}
        onGenerateWithAi={onGenerateWithAi}
      />,
    );

    await user.click(getAiButton());

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        ConversationPanelI18nKeys.RenameWithAiError,
      ),
    );
    expect(getInput().value).toBe('My Chat');
  });
});
