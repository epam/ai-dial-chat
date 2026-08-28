import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  type CSSProperties,
  type KeyboardEventHandler,
  type ReactNode,
  type Ref,
} from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RenameConversationPopup,
  type RenameConversationPopupLabels,
} from '../RenameConversationPopup';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  PopupSize: { Sm: 'sm' },
  ButtonVariant: { Primary: 'primary', Neutral: 'neutral' },
  Popup: ({
    open,
    header,
    children,
    onClose,
    mainButtons,
  }: {
    open: boolean;
    header?: ReactNode;
    children?: ReactNode;
    onClose?: () => void;
    mainButtons?: {
      label?: ReactNode;
      disabled?: boolean;
      onClick?: () => void;
    }[];
  }) =>
    open ? (
      <div role="dialog" aria-label="Rename conversation">
        <h2>{header}</h2>
        <button type="button" aria-label="Close" onClick={onClose} />
        {children}
        {mainButtons?.map((button, index) => (
          <button
            key={index}
            type="button"
            onClick={button.onClick}
            disabled={button.disabled}
          >
            {button.label}
          </button>
        ))}
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

const DEFAULT_LABELS: RenameConversationPopupLabels = {
  popupTitle: 'Rename conversation',
  inputPlaceholder: 'Enter conversation name',
  renameWithAiLabel: 'Rename with AI',
  renameWithAiError: 'Failed to generate name with AI',
  nameTooLongError: 'Name is too long',
  saveLabel: 'Save',
  cancelLabel: 'Cancel',
};

const DEFAULT_PROPS = {
  isOpen: true,
  currentTitle: 'My Chat',
  isSaving: false,
  error: null,
  onSave: vi.fn(),
  onCancel: vi.fn(),
  onGenerateWithAi: vi.fn().mockResolvedValue('AI Suggested Name'),
  labels: DEFAULT_LABELS,
};

const getSaveButton = () =>
  screen.getByRole('button', {
    name: DEFAULT_LABELS.saveLabel,
  }) as HTMLButtonElement;
const getCancelButton = () =>
  screen.getByRole('button', {
    name: DEFAULT_LABELS.cancelLabel,
  }) as HTMLButtonElement;
const getInput = () =>
  screen.getByRole('textbox', {
    name: 'Conversation title',
  }) as HTMLInputElement;
const getAiButton = () =>
  screen.getByRole('button', {
    name: DEFAULT_LABELS.renameWithAiLabel,
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

  it('applies body class and CSS-variable overrides', () => {
    render(
      <RenameConversationPopup
        {...DEFAULT_PROPS}
        styles={{
          bodyClassName: 'custom-popup-body',
          cssVars: {
            '--consumer-popup-color': '#abcdef',
          } as CSSProperties,
        }}
      />,
    );

    const dialog = screen.getByRole('dialog');
    // eslint-disable-next-line testing-library/no-node-access
    const body = dialog.querySelector('.custom-popup-body') as HTMLElement;
    expect(body).toBeTruthy();
    expect(body.style.getPropertyValue('--consumer-popup-color')).toBe(
      '#abcdef',
    );
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

  it('replaces the fields and actions with a loader while isSaving is true', () => {
    render(<RenameConversationPopup {...DEFAULT_PROPS} isSaving={true} />);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(
      screen.queryByRole('button', { name: DEFAULT_LABELS.saveLabel }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: DEFAULT_LABELS.cancelLabel }),
    ).toBeNull();
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

  it('saves a valid changed value when Enter is pressed', async () => {
    const onSave = vi.fn();
    render(<RenameConversationPopup {...DEFAULT_PROPS} onSave={onSave} />);
    await user.clear(getInput());
    await user.type(getInput(), 'New title{Enter}');

    expect(onSave).toHaveBeenCalledWith('New title');
  });

  it('strips trailing dots only when saving', async () => {
    const onSave = vi.fn();
    render(<RenameConversationPopup {...DEFAULT_PROPS} onSave={onSave} />);
    await user.clear(getInput());
    await user.type(getInput(), 'New title...');

    expect(getInput().value).toBe('New title...');
    await user.click(getSaveButton());
    expect(onSave).toHaveBeenCalledWith('New title');
  });

  it('preserves leading and internal dots and allowed special characters', async () => {
    const onSave = vi.fn();
    render(<RenameConversationPopup {...DEFAULT_PROPS} onSave={onSave} />);
    fireEvent.change(getInput(), {
      target: { value: ".start.middle !@#$^*()_+-[]'" },
    });

    expect(getInput().value).toBe(".start.middle !@#$^*()_+-[]'");
    await user.click(getSaveButton());
    expect(onSave).toHaveBeenCalledWith(".start.middle !@#$^*()_+-[]'");
  });

  it('calls onCancel on Cancel click', async () => {
    const onCancel = vi.fn();
    render(<RenameConversationPopup {...DEFAULT_PROPS} onCancel={onCancel} />);
    await user.click(getCancelButton());
    expect(onCancel).toHaveBeenCalledOnce();
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
    expect(screen.getByRole('alert').textContent).toContain(
      DEFAULT_LABELS.nameTooLongError,
    );
  });

  it('byte-length error takes precedence over the error prop', async () => {
    render(
      <RenameConversationPopup
        {...DEFAULT_PROPS}
        currentTitle=""
        error="API error message"
      />,
    );
    await user.type(getInput(), 'a'.repeat(256));
    expect(screen.getByRole('alert').textContent).toContain(
      DEFAULT_LABELS.nameTooLongError,
    );
    expect(screen.getByRole('alert').textContent).not.toContain(
      'API error message',
    );
  });

  it('does not render when isOpen is false', () => {
    render(<RenameConversationPopup {...DEFAULT_PROPS} isOpen={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('resets to the latest title and focuses the input every time it reopens', async () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(
        <RenameConversationPopup {...DEFAULT_PROPS} />,
      );
      act(() => vi.runOnlyPendingTimers());
      expect(getInput()).toHaveProperty(
        'ownerDocument.activeElement',
        getInput(),
      );

      fireEvent.change(getInput(), { target: { value: 'Unsaved edit' } });
      rerender(<RenameConversationPopup {...DEFAULT_PROPS} isOpen={false} />);
      rerender(
        <RenameConversationPopup
          {...DEFAULT_PROPS}
          currentTitle="Latest title"
        />,
      );
      act(() => vi.runOnlyPendingTimers());

      expect(getInput().value).toBe('Latest title');
      expect(getInput()).toHaveProperty(
        'ownerDocument.activeElement',
        getInput(),
      );
    } finally {
      vi.useRealTimers();
    }
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
        DEFAULT_LABELS.renameWithAiError,
      ),
    );
    expect(getInput().value).toBe('My Chat');
  });

  it('shows only the AI error when generation fails alongside an API error', async () => {
    render(
      <RenameConversationPopup
        {...DEFAULT_PROPS}
        error="API error"
        onGenerateWithAi={vi.fn().mockRejectedValue(new Error('boom'))}
      />,
    );

    await user.click(getAiButton());

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        DEFAULT_LABELS.renameWithAiError,
      ),
    );
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert').textContent).not.toContain('API error');
  });

  it('a second generation attempt while one is in flight is ignored', async () => {
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
    /* Button is now disabled — a second click should not call onGenerateWithAi again. */
    await user.click(getAiButton());

    expect(onGenerateWithAi).toHaveBeenCalledOnce();

    resolveGenerate('Done');
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });

  it('ignores an AI result from a previous popup session', async () => {
    let resolveGenerate: (name: string) => void = () => undefined;
    const onGenerateWithAi = vi.fn().mockReturnValue(
      new Promise<string>((resolve) => {
        resolveGenerate = resolve;
      }),
    );
    const { rerender } = render(
      <RenameConversationPopup
        {...DEFAULT_PROPS}
        onGenerateWithAi={onGenerateWithAi}
      />,
    );

    await user.click(getAiButton());
    rerender(
      <RenameConversationPopup
        {...DEFAULT_PROPS}
        isOpen={false}
        onGenerateWithAi={onGenerateWithAi}
      />,
    );
    rerender(
      <RenameConversationPopup
        {...DEFAULT_PROPS}
        currentTitle="New session title"
        onGenerateWithAi={onGenerateWithAi}
      />,
    );

    resolveGenerate('Stale AI title');

    await waitFor(() => expect(getInput().value).toBe('New session title'));
    expect(getAiButton().disabled).toBe(false);
  });

  it('prohibited characters are stripped while typing', async () => {
    render(<RenameConversationPopup {...DEFAULT_PROPS} currentTitle="" />);
    await user.type(getInput(), 'hello:world');
    expect(getInput().value).toBe('helloworld');
  });

  it('AI-generated name is sanitized before populating the input', async () => {
    const onGenerateWithAi = vi.fn().mockResolvedValue('Name:With/Slash');
    render(
      <RenameConversationPopup
        {...DEFAULT_PROPS}
        onGenerateWithAi={onGenerateWithAi}
      />,
    );

    await user.click(getAiButton());

    await waitFor(() => expect(getInput().value).toBe('NameWithSlash'));
  });
});
