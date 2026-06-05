import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RenameConversationPopup from '../RenameConversationPopup';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  ButtonAppearance: { Ghost: 'ghost', Solid: 'solid' },
  ButtonVariant: { Neutral: 'neutral', Primary: 'primary' },
  PopupSize: { Sm: 'sm' },
  DialPopup: ({
    open,
    header,
    children,
    footer,
    onClose,
  }: {
    open: boolean;
    header?: React.ReactNode;
    children?: React.ReactNode;
    footer?: React.ReactNode;
    onClose?: () => void;
  }) =>
    open ? (
      <div role="dialog">
        <div data-testid="popup-header">{header}</div>
        <button data-testid="popup-close" onClick={onClose} />
        {children}
        {footer}
      </div>
    ) : null,
  DialInput: ({
    value,
    placeholder,
    onChange,
    inputRef,
  }: {
    value?: string;
    placeholder?: string;
    onChange?: (v?: string) => void;
    inputRef?: React.Ref<HTMLInputElement>;
  }) => (
    <input
      ref={inputRef}
      data-testid="rename-input"
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
  DialButton: ({
    label,
    onClick,
    disabled,
    variant,
  }: {
    label?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button
      data-testid={`btn-${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  ),
  DialNeutralButton: ({
    label,
    onClick,
    disabled,
  }: {
    label?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button data-testid="btn-neutral" onClick={onClick} disabled={disabled}>
      {label}
    </button>
  ),
}));

const DEFAULT_PROPS = {
  open: true,
  currentTitle: 'My Chat',
  isSaving: false,
  error: null,
  onSave: vi.fn(),
  onCancel: vi.fn(),
};

const getSaveButton = () =>
  screen.getByTestId('btn-primary') as HTMLButtonElement;
const getCancelButton = () =>
  screen.getByTestId('btn-neutral') as HTMLButtonElement;
const getInput = () => screen.getByTestId('rename-input') as HTMLInputElement;

describe('RenameConversationPopup', () => {
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
    await userEvent.clear(getInput());
    await userEvent.type(getInput(), '   ');
    expect(getSaveButton().disabled).toBe(true);
  });

  it('Save button is disabled while isSaving is true', async () => {
    render(<RenameConversationPopup {...DEFAULT_PROPS} isSaving={true} />);
    await userEvent.clear(getInput());
    await userEvent.type(getInput(), 'New Title');
    expect(getSaveButton().disabled).toBe(true);
  });

  it('Save button is enabled when value differs from currentTitle', async () => {
    render(<RenameConversationPopup {...DEFAULT_PROPS} />);
    await userEvent.clear(getInput());
    await userEvent.type(getInput(), 'New Title');
    expect(getSaveButton().disabled).toBe(false);
  });

  it('calls onSave with trimmed value on Save click', async () => {
    const onSave = vi.fn();
    render(<RenameConversationPopup {...DEFAULT_PROPS} onSave={onSave} />);
    await userEvent.clear(getInput());
    await userEvent.type(getInput(), '  New Title  ');
    await userEvent.click(getSaveButton());
    expect(onSave).toHaveBeenCalledWith('New Title');
  });

  it('calls onCancel on Cancel click', async () => {
    const onCancel = vi.fn();
    render(<RenameConversationPopup {...DEFAULT_PROPS} onCancel={onCancel} />);
    await userEvent.click(getCancelButton());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows error message with role="alert" when error is provided', () => {
    render(
      <RenameConversationPopup
        {...DEFAULT_PROPS}
        error="Failed to rename. Please try again."
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Failed to rename');
  });

  it('does not render when open is false', () => {
    render(<RenameConversationPopup {...DEFAULT_PROPS} open={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
