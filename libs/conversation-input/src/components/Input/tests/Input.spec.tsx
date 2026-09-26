import {
  AttachmentType,
  RequestStatus,
  type Attachment,
  type UploadedAttachmentResult,
} from '@epam/ai-dial-chat-shared';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Input } from '../Input';

type MenuItems = Array<{
  key: string;
  label?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}>;

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...actual,
    Dropdown: ({
      children,
      items,
      open,
      renderOverlay,
    }: {
      children: ReactNode;
      items?: MenuItems;
      open?: boolean;
      renderOverlay?: () => ReactNode;
    }) => (
      <div>
        {children}
        {open && renderOverlay?.()}
        {items?.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            disabled={item.disabled}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
    ),
    Skeleton: ({ variant }: { variant: string }) => (
      <span data-variant={variant} />
    ),
  };
});

/*
 * The file input is intentionally aria-hidden and sr-only, triggered only by
 * clicking the Add button — it exposes no accessible role or label to query
 * by, so a structural lookup is the only option here.
 */
const getFileInput = (): HTMLInputElement =>
  // eslint-disable-next-line testing-library/no-node-access
  document.querySelector('input[type="file"]') as HTMLInputElement;

/*
 * The Input root wrapper only carries CSS custom properties / merged class
 * names — it has no semantic role or text of its own to query by.
 */
const getWrapper = (container: HTMLElement): HTMLElement =>
  // eslint-disable-next-line testing-library/no-node-access
  container.firstElementChild as HTMLElement;

/*
 * The disabled-state marker around the model selector chip carries no
 * accessible role/label of its own — only the nested trigger button does.
 */
const getModelSelectorDisabledMarker = (
  container: HTMLElement,
): Element | null =>
  // eslint-disable-next-line testing-library/no-node-access
  container.querySelector('[aria-disabled="true"]');

/*
 * Skeleton is mocked to a bare <span data-variant> for this test file; it has
 * no role or text to query, so counting by the mock's own attribute is the
 * only way to verify how many of each variant rendered.
 */
const getSkeletonsByVariant = (
  container: HTMLElement,
  variant: string,
): HTMLElement[] =>
  Array.from(
    // eslint-disable-next-line testing-library/no-node-access
    container.querySelectorAll<HTMLElement>(`[data-variant="${variant}"]`),
  );

describe('Input', () => {
  it('should disable send button when textarea is empty', () => {
    render(<Input />);
    expect(
      (screen.getByLabelText('Send message') as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('should enable send button when user types non-whitespace text', () => {
    render(<Input />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    expect(
      (screen.getByLabelText('Send message') as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('should keep send button disabled for whitespace-only input', () => {
    render(<Input />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '   ' } });
    expect(
      (screen.getByLabelText('Send message') as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('should pre-populate textarea with initialMessage', () => {
    render(<Input message="Hello" />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Hello');
  });

  it('should clear textarea when message changes to an empty string', () => {
    const { rerender } = render(<Input message="Hello" />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

    rerender(<Input message="" />);

    expect(textarea.value).toBe('');
  });

  it('should re-apply the same message when messageRevision changes', () => {
    const { rerender } = render(<Input message="Draft" messageRevision={1} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Draft');

    fireEvent.change(textarea, { target: { value: 'User edited draft' } });
    rerender(<Input message="Draft" messageRevision={2} />);

    expect(textarea.value).toBe('Draft');
  });

  it('should call onSend with message text and clear textarea on Enter', () => {
    const handleSend = vi.fn();
    render(<Input onSend={handleSend} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Test message' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(handleSend).toHaveBeenCalledWith('Test message', []);
    expect(textarea.value).toBe('');
  });

  it('should not call onSend on Shift+Enter', () => {
    const handleSend = vi.fn();
    render(<Input onSend={handleSend} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Test message' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(handleSend).not.toHaveBeenCalled();
    expect(textarea.value).toBe('Test message');
  });

  it('should call onChange on each keystroke', () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Hi' } });
    expect(handleChange).toHaveBeenCalledWith('Hi');
  });

  it('should call onSend when send button is clicked', () => {
    const handleSend = vi.fn();
    render(<Input onSend={handleSend} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Click send' } });
    const sendButton = screen.getByLabelText('Send message');
    fireEvent.click(sendButton);
    expect(handleSend).toHaveBeenCalledWith('Click send', []);
  });

  it('should show stop button while streaming when onStop is provided', () => {
    const handleStop = vi.fn();
    render(
      <Input isStreaming onStop={handleStop} stopLabel="Stop streaming" />,
    );

    fireEvent.click(screen.getByLabelText('Stop streaming'));

    expect(handleStop).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText('Send message')).toBeNull();
  });

  it('should not show stop or send while streaming when onStop is omitted', () => {
    const handleSend = vi.fn();
    render(<Input isStreaming message="Draft" onSend={handleSend} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(screen.queryByLabelText('Stop streaming')).toBeNull();
    expect(screen.queryByLabelText('Send message')).toBeNull();
    expect(handleSend).not.toHaveBeenCalled();
  });

  it('should set --ci-bg and --ci-text CSS variables when colors prop is provided', () => {
    const { container } = render(
      <Input colors={{ background: '#fff', text: '#000' }} />,
    );
    const wrapper = getWrapper(container);
    expect(wrapper.style.getPropertyValue('--ci-bg')).toBe('#fff');
    expect(wrapper.style.getPropertyValue('--ci-text')).toBe('#000');
  });

  it('should not set CSS variable for omitted color fields', () => {
    const { container } = render(<Input colors={{ background: '#fff' }} />);
    const wrapper = getWrapper(container);
    expect(wrapper.style.getPropertyValue('--ci-text')).toBe('');
  });

  it('should apply the typography fontClassName to the textarea', () => {
    render(
      <Input typography={{ fontClassName: 'dial-body-paragraph-text' }} />,
    );
    expect(screen.getByRole('textbox').className).toContain(
      'dial-body-paragraph-text',
    );
  });

  it('should use custom placeholder when provided', () => {
    render(<Input placeholder="Ask anything" />);
    expect(
      (screen.getByRole('textbox') as HTMLTextAreaElement).placeholder,
    ).toBe('Ask anything');
  });

  it('should use default placeholder when prop is omitted', () => {
    render(<Input />);
    expect(
      (screen.getByRole('textbox') as HTMLTextAreaElement).placeholder,
    ).toBe('Type a message...');
  });

  it('should merge className onto the wrapper element', () => {
    const { container } = render(<Input className="mt-4" />);
    expect(getWrapper(container).classList.contains('mt-4')).toBe(true);
  });

  it('should set aria-label on textarea when ariaLabel prop is provided', () => {
    render(<Input ariaLabel="Message input" />);
    expect(screen.getByRole('textbox').getAttribute('aria-label')).toBe(
      'Message input',
    );
  });

  it('should render the add menu button', () => {
    render(<Input />);
    expect(screen.getByLabelText('Add')).toBeTruthy();
  });

  it('should set the accept attribute on the file input when fileAccept is provided', () => {
    render(<Input fileAccept="image/*,application/pdf" />);
    const fileInput = getFileInput();
    expect(fileInput.getAttribute('accept')).toBe('image/*,application/pdf');
  });

  it('should not set the accept attribute when fileAccept is absent', () => {
    render(<Input />);
    const fileInput = getFileInput();
    expect(fileInput.hasAttribute('accept')).toBe(false);
  });

  it('should show an attachment card after a file is picked', () => {
    render(<Input />);
    const fileInput = getFileInput();
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(screen.getByText('doc')).toBeTruthy();
  });

  it('should enable send button when only an attachment is present and no text', () => {
    render(<Input />);
    expect(
      (screen.getByLabelText('Send message') as HTMLButtonElement).disabled,
    ).toBe(true);
    const fileInput = getFileInput();
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(
      (screen.getByLabelText('Send message') as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('should call onSend with empty text and the attachment on Enter when no text is typed', () => {
    const handleSend = vi.fn();
    render(<Input onSend={handleSend} />);
    const fileInput = getFileInput();
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    const textarea = screen.getByRole('textbox');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(handleSend).toHaveBeenCalledWith(
      '',
      expect.arrayContaining([expect.objectContaining({ name: 'doc.pdf' })]),
    );
  });

  it('pendingDropFiles prop creates attachment cards and calls onDropFilesConsumed', () => {
    const onDropFilesConsumed = vi.fn();
    const file = new File(['content'], 'dropped.pdf', {
      type: 'application/pdf',
    });
    const { rerender } = render(
      <Input pendingDropFiles={[]} onDropFilesConsumed={onDropFilesConsumed} />,
    );
    rerender(
      <Input
        pendingDropFiles={[file]}
        onDropFilesConsumed={onDropFilesConsumed}
      />,
    );
    expect(screen.getByText('dropped')).toBeTruthy();
    expect(onDropFilesConsumed).toHaveBeenCalled();
  });

  it('adds already-uploaded pending attachments without uploading them again', () => {
    const onPendingAttachmentsConsumed = vi.fn();
    const onUploadAttachment = vi.fn();
    const attachment: Attachment = {
      id: 'files/my-bucket/report.pdf',
      name: 'report.pdf',
      contentType: 'application/pdf',
      type: AttachmentType.File,
      status: RequestStatus.Idle,
      url: 'files/my-bucket/report.pdf',
      file: new File([], 'report.pdf', { type: 'application/pdf' }),
    };

    render(
      <Input
        pendingAttachments={[attachment]}
        onPendingAttachmentsConsumed={onPendingAttachmentsConsumed}
        onUploadAttachment={onUploadAttachment}
      />,
    );

    expect(screen.getByText('report')).toBeTruthy();
    expect(onUploadAttachment).not.toHaveBeenCalled();
    expect(onPendingAttachmentsConsumed).toHaveBeenCalledOnce();
  });

  it('should call onAttachmentsChange when a file is added', () => {
    const onAttachmentsChange = vi.fn();
    render(<Input onAttachmentsChange={onAttachmentsChange} />);
    const fileInput = getFileInput();
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(onAttachmentsChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'doc.pdf' })]),
    );
  });

  it('does not add a selected batch when it would exceed the attachment limit', () => {
    const onAttachmentsLimitExceeded = vi.fn();
    const onAttachmentsChange = vi.fn();
    render(
      <Input
        maximumAttachmentsAmount={2}
        onAttachmentsLimitExceeded={onAttachmentsLimitExceeded}
        onAttachmentsChange={onAttachmentsChange}
      />,
    );
    const fileInput = getFileInput();

    fireEvent.change(fileInput, {
      target: {
        files: [
          new File(['content'], 'first.pdf', { type: 'application/pdf' }),
          new File(['content'], 'second.pdf', { type: 'application/pdf' }),
          new File(['content'], 'third.pdf', { type: 'application/pdf' }),
        ],
      },
    });

    expect(screen.queryByText('first')).toBeNull();
    expect(onAttachmentsChange).not.toHaveBeenCalled();
    expect(onAttachmentsLimitExceeded).toHaveBeenCalledWith(3, 2);
  });

  it('counts existing attachments when checking a selected batch against the limit', () => {
    const onAttachmentsLimitExceeded = vi.fn();
    render(
      <Input
        maximumAttachmentsAmount={2}
        onAttachmentsLimitExceeded={onAttachmentsLimitExceeded}
      />,
    );
    const fileInput = getFileInput();

    fireEvent.change(fileInput, {
      target: {
        files: [
          new File(['content'], 'first.pdf', { type: 'application/pdf' }),
        ],
      },
    });
    fireEvent.change(fileInput, {
      target: {
        files: [
          new File(['content'], 'second.pdf', { type: 'application/pdf' }),
          new File(['content'], 'third.pdf', { type: 'application/pdf' }),
        ],
      },
    });

    expect(screen.getByText('first')).toBeTruthy();
    expect(screen.queryByText('second')).toBeNull();
    expect(screen.queryByText('third')).toBeNull();
    expect(onAttachmentsLimitExceeded).toHaveBeenCalledWith(3, 2);
  });

  it('should show mic button when isAudioMessageSupported is true', () => {
    render(<Input isAudioMessageSupported micLabel="Record voice message" />);
    expect(screen.getByLabelText('Record voice message')).toBeTruthy();
  });

  it('should show mic button when isAudioMessageSupported is true and message is not empty', () => {
    render(<Input isAudioMessageSupported micLabel="Record voice message" />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    expect(screen.getByLabelText('Record voice message')).toBeTruthy();
  });

  it('should hide mic button when isAudioMessageSupported is false', () => {
    render(
      <Input isAudioMessageSupported={false} micLabel="Record voice message" />,
    );
    expect(screen.queryByLabelText('Record voice message')).toBeNull();
  });
});

const mockItems = [
  { id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' as const },
  { id: 'my-app', displayName: 'My App', type: 'application' as const },
];

describe('Input — model selector', () => {
  it('renders DialDropdownIcon when deployments is non-empty', () => {
    render(
      <Input
        deployments={mockItems}
        selectedDeploymentId="gpt-4o"
        onDeploymentChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/Select model/)).toBeTruthy();
  });

  it('trigger aria-label includes selected item displayName', () => {
    render(
      <Input
        deployments={mockItems}
        selectedDeploymentId="gpt-4o"
        onDeploymentChange={vi.fn()}
        modelSelectorLabels={{ ariaLabel: 'Model' }}
      />,
    );
    expect(screen.getByLabelText('Model: GPT-4o')).toBeTruthy();
  });

  it('clicking a menu item calls onDeploymentChange with the item id', () => {
    const onDeploymentChange = vi.fn();
    render(
      <Input
        deployments={mockItems}
        selectedDeploymentId="gpt-4o"
        onDeploymentChange={onDeploymentChange}
      />,
    );
    fireEvent.click(screen.getByText('My App'));
    expect(onDeploymentChange).toHaveBeenCalledWith('my-app');
  });

  it('shows seven skeleton rows and a circular trigger skeleton while deployments load', () => {
    render(
      <Input
        deployments={[]}
        selectedDeploymentId={null}
        onDeploymentChange={vi.fn()}
        modelSelectorLabels={{ loading: 'Loading models…' }}
      />,
    );
    const loadingItem = screen.getByText('Loading models…');
    expect(loadingItem).toBeTruthy();
    /* The menu overlay is portaled out of the render container, so both it and
       the trigger are only counted together from the document body. */
    expect(getSkeletonsByVariant(document.body, 'circular')).toHaveLength(8);
    expect(getSkeletonsByVariant(document.body, 'text')).toHaveLength(7);
    expect(
      screen
        .getAllByRole('button')
        .filter((button) => (button as HTMLButtonElement).disabled),
    ).toHaveLength(8);
  });

  it('shows error label as disabled item when deployments is empty', () => {
    render(
      <Input
        deployments={[]}
        selectedDeploymentId={null}
        onDeploymentChange={vi.fn()}
        modelSelectorLabels={{ error: 'Failed to load models' }}
      />,
    );
    const errorItem = screen.getByText('Failed to load models');
    expect(errorItem).toBeTruthy();
    expect((errorItem as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables send button when deployments is defined and selectedDeploymentId is null', () => {
    render(
      <Input
        deployments={mockItems}
        selectedDeploymentId={null}
        onDeploymentChange={vi.fn()}
      />,
    );
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    const sendButton = screen.getByLabelText(
      'Send message',
    ) as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);
  });

  it('does not fire onSend on Enter when selectedDeploymentId is null', () => {
    const handleSend = vi.fn();
    render(
      <Input
        onSend={handleSend}
        deployments={mockItems}
        selectedDeploymentId={null}
        onDeploymentChange={vi.fn()}
      />,
    );
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(handleSend).not.toHaveBeenCalled();
  });

  it('does not render selector when deployments is undefined', () => {
    render(<Input />);
    expect(screen.queryByLabelText(/Select model/)).toBeNull();
  });
});

describe('Input — isModelSelectorDisabled', () => {
  it('keeps the model chip visible and marks it aria-disabled', () => {
    const { container } = render(
      <Input
        deployments={mockItems}
        selectedDeploymentId="gpt-4o"
        onDeploymentChange={vi.fn()}
        isModelSelectorDisabled
      />,
    );
    expect(screen.getByLabelText(/Select model/)).toBeTruthy();
    expect(getModelSelectorDisabledMarker(container)).toBeTruthy();
  });

  it('does not mark the chip aria-disabled when isModelSelectorDisabled is false', () => {
    const { container } = render(
      <Input
        deployments={mockItems}
        selectedDeploymentId="gpt-4o"
        onDeploymentChange={vi.fn()}
        isModelSelectorDisabled={false}
      />,
    );
    expect(getModelSelectorDisabledMarker(container)).toBeNull();
  });

  it('keeps typing and sending enabled while the model selector is disabled', () => {
    const handleSend = vi.fn();
    render(
      <Input
        onSend={handleSend}
        deployments={mockItems}
        selectedDeploymentId="gpt-4o"
        onDeploymentChange={vi.fn()}
        isModelSelectorDisabled
      />,
    );
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(false);
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(handleSend).toHaveBeenCalledWith('Hello', []);
  });
});

describe('Input — isSendDisabled', () => {
  it('disables the send button without disabling typing', () => {
    const handleSend = vi.fn();
    render(
      <Input
        message="Hello"
        onSend={handleSend}
        deployments={mockItems}
        selectedDeploymentId="gpt-4o"
        onDeploymentChange={vi.fn()}
        isSendDisabled
      />,
    );
    expect(screen.getByLabelText('Send message').hasAttribute('disabled')).toBe(
      true,
    );
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(false);
  });

  it('does not fire onSend on Enter when send is disabled', () => {
    const handleSend = vi.fn();
    render(
      <Input
        message="Hello"
        onSend={handleSend}
        deployments={mockItems}
        selectedDeploymentId="gpt-4o"
        onDeploymentChange={vi.fn()}
        isSendDisabled
      />,
    );
    const textarea = screen.getByRole('textbox');

    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(handleSend).not.toHaveBeenCalled();
  });

  it('passes canSend false to custom footer actions and blocks their onSend helper', () => {
    const handleSend = vi.fn();
    let footerCanSend: boolean | undefined;

    render(
      <Input
        message="Hello"
        onSend={handleSend}
        isSendDisabled
        renderFooterActions={({
          canSend,
          onSend,
        }: {
          canSend: boolean;
          onSend: () => void;
        }) => {
          footerCanSend = canSend;
          return (
            <button type="button" onClick={onSend}>
              Custom send
            </button>
          );
        }}
      />,
    );

    expect(footerCanSend).toBe(false);
    fireEvent.click(screen.getByText('Custom send'));
    expect(handleSend).not.toHaveBeenCalled();
  });

  it('does not disable the send button when isSendDisabled is false', () => {
    render(
      <Input
        message="Hello"
        deployments={mockItems}
        selectedDeploymentId="gpt-4o"
        onDeploymentChange={vi.fn()}
        isSendDisabled={false}
      />,
    );
    expect(screen.getByLabelText('Send message').hasAttribute('disabled')).toBe(
      false,
    );
  });
});

describe('Input — isInputDisabled', () => {
  it('textarea has disabled attribute when isInputDisabled is true', () => {
    render(<Input isInputDisabled />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);
  });

  it('textarea is enabled when isInputDisabled is false', () => {
    render(<Input isInputDisabled={false} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(false);
  });

  /*
   * A disabled textarea can never receive typed input, so the only way a
   * message exists while isInputDisabled is true is a starter having
   * populated it (see chat-input-disabled-state spec). In that one case the
   * user still needs to submit the (unamendable) populated text, so the send
   * button stays enabled instead of being blocked like the rest of the
   * free-text path.
   */
  it('send button is enabled when isInputDisabled is true and a message is already populated', () => {
    render(<Input message="Hello" isInputDisabled />);
    const sendButton = screen.getByLabelText(
      'Send message',
    ) as HTMLButtonElement;
    expect(sendButton.disabled).toBe(false);
  });

  it('clicking send still calls onSend when isInputDisabled is true and a message is already populated', async () => {
    const handleSend = vi.fn();
    render(<Input message="Hello" isInputDisabled onSend={handleSend} />);
    const sendButton = screen.getByLabelText('Send message');
    fireEvent.click(sendButton);
    await waitFor(() => expect(handleSend).toHaveBeenCalledWith('Hello', []));
  });

  it('attach button is disabled when isInputDisabled is true', () => {
    render(<Input isInputDisabled />);
    const addButton = screen.getByLabelText('Add') as HTMLButtonElement;
    expect(addButton.disabled).toBe(true);
  });

  it('does not call onSend on Enter when isInputDisabled is true', () => {
    const handleSend = vi.fn();
    render(<Input onSend={handleSend} isInputDisabled />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(handleSend).not.toHaveBeenCalled();
  });

  it('calls onSend on Enter when isInputDisabled is false', () => {
    const handleSend = vi.fn();
    render(<Input onSend={handleSend} isInputDisabled={false} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(handleSend).toHaveBeenCalledWith('Hello', []);
  });

  it('opens the model picker when isInputDisabled is true', () => {
    render(
      <Input
        deployments={mockItems}
        selectedDeploymentId="gpt-4o"
        onDeploymentChange={vi.fn()}
        modelPickerOverlay={() => <div>model picker</div>}
        isInputDisabled
      />,
    );
    expect(screen.queryByText('model picker')).toBeNull();

    fireEvent.click(screen.getByLabelText(/Select model/));

    expect(screen.getByText('model picker')).toBeTruthy();
  });

  it('does not dim the model selector when isInputDisabled is true', () => {
    const { container } = render(
      <Input
        deployments={mockItems}
        selectedDeploymentId="gpt-4o"
        onDeploymentChange={vi.fn()}
        isInputDisabled
      />,
    );
    expect(getModelSelectorDisabledMarker(container)).toBeNull();
  });

  it('keeps the model picker closed when the selector is explicitly disabled', () => {
    render(
      <Input
        deployments={mockItems}
        selectedDeploymentId="gpt-4o"
        onDeploymentChange={vi.fn()}
        modelPickerOverlay={() => <div>model picker</div>}
        isInputDisabled
        isModelSelectorDisabled
      />,
    );

    fireEvent.click(screen.getByLabelText(/Select model/));

    expect(screen.queryByText('model picker')).toBeNull();
  });

  it('shows a Prompts item in the Add menu when a menu overlay is provided', () => {
    render(
      <Input
        menuOverlays={[
          {
            key: 'prompts',
            title: 'Prompts',
            icon: <span aria-hidden />,
            renderOverlay: () => <div>prompts overlay</div>,
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByLabelText('Add'));

    expect(screen.getByText('Prompts')).toBeTruthy();
  });

  it('does not show a Prompts item in the Add menu when no menu overlay is provided', () => {
    render(<Input />);

    fireEvent.click(screen.getByLabelText('Add'));

    expect(screen.queryByText('Prompts')).toBeNull();
  });
});

describe('Input — attachment status transitions', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:mock'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uploads attachments immediately when they are added', async () => {
    let resolveUpload!: (result: UploadedAttachmentResult) => void;
    const uploadPromise = new Promise<UploadedAttachmentResult>((resolve) => {
      resolveUpload = resolve;
    });
    const handleUploadAttachment = vi.fn(() => uploadPromise);

    render(<Input onUploadAttachment={handleUploadAttachment} />);
    const fileInput = getFileInput();
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(handleUploadAttachment).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'doc.pdf' }),
      );
    });
    expect(
      (screen.getByLabelText('Send message') as HTMLButtonElement).disabled,
    ).toBe(true);

    resolveUpload({ url: 'https://example.com/doc.pdf', name: 'doc.pdf' });

    await waitFor(() => {
      expect(
        (screen.getByLabelText('Send message') as HTMLButtonElement).disabled,
      ).toBe(false);
    });
  });

  it('restores message text and attachment tray when onSend rejects', async () => {
    const handleSend = vi.fn().mockRejectedValue(new Error('upload failed'));

    render(<Input onSend={handleSend} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: { value: 'Please send this file' },
    });

    const fileInput = getFileInput();
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText('doc')).toBeTruthy();
    const sendButton = screen.getByLabelText('Send message');
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(handleSend).toHaveBeenCalled();
    });
    expect(textarea.value).toBe('Please send this file');
    expect(screen.getByText('doc')).toBeTruthy();
  });

  it('tray clears after onSend resolves', async () => {
    const handleSend = vi.fn().mockResolvedValue(undefined);

    render(<Input onSend={handleSend} />);
    const fileInput = getFileInput();
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText('doc')).toBeTruthy();
    const sendButton = screen.getByLabelText('Send message');
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.queryByText('doc')).toBeNull();
    });
  });
});

describe('Input — usageLimitsSlot', () => {
  it('renders slot content in the action row when usageLimitsSlot is provided', () => {
    render(
      <Input usageLimitsSlot={<button type="button">Usage limits</button>} />,
    );

    expect(screen.getByRole('button', { name: 'Usage limits' })).toBeTruthy();
  });

  it('does not render any slot content when usageLimitsSlot is omitted', () => {
    render(<Input />);

    expect(screen.queryByRole('button', { name: 'Usage limits' })).toBeNull();
  });

  it('does not render slot when renderFooterActions is provided (custom footer replaces the slot area)', () => {
    render(
      <Input
        usageLimitsSlot={<button type="button">Usage limits</button>}
        renderFooterActions={() => <button type="button">Custom footer</button>}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Usage limits' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Custom footer' })).toBeTruthy();
  });
});

describe('Input — pasted attachment expand', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:mock'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const pasteText = (textarea: Element, text: string) => {
    fireEvent.paste(textarea, {
      clipboardData: {
        items: [] as unknown as DataTransferItemList,
        getData: () => text,
      },
    });
  };

  it('clicking a pasted card appends its text to the textarea and removes the card', async () => {
    render(<Input pasteTextThreshold={5} />);
    const text = 'This is long enough to become a pasted attachment';

    pasteText(screen.getByRole('textbox'), text);

    const card = screen.getByRole('button', { name: 'Download attachment' });
    fireEvent.click(card);

    await waitFor(() => {
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
        text,
      );
    });
    expect(screen.queryByRole('list', { name: 'Attached files' })).toBeNull();
  });

  it('clicking a pasted card appends with newline when textarea already has text', async () => {
    render(<Input pasteTextThreshold={5} message="existing" />);
    const text = 'This is long enough to become a pasted attachment';

    pasteText(screen.getByRole('textbox'), text);

    const card = screen.getByRole('button', { name: 'Download attachment' });
    fireEvent.click(card);

    await waitFor(() => {
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
        `existing\n${text}`,
      );
    });
  });

  /*
   * An attachments-enabled model that does not accept text/plain (e.g. an
   * image-only model) must not convert the paste — the converted attachment
   * would fail validation with "File extension not supported".
   */
  it('does not convert a long paste to an attachment when text attachments are not allowed', () => {
    render(<Input pasteTextThreshold={5} isTextAttachmentsAllowed={false} />);
    const text = 'This is long enough to otherwise become a pasted attachment';

    pasteText(screen.getByRole('textbox'), text);

    expect(
      screen.queryByRole('button', { name: 'Download attachment' }),
    ).toBeNull();
    expect(screen.queryByRole('list', { name: 'Attached files' })).toBeNull();
  });
});

describe('Input — message length cap', () => {
  const MAX = 10;
  const atCap = 'x'.repeat(MAX);
  const belowCap = 'x'.repeat(MAX - 1);

  it('blocks sending at the cap when attachments are disabled', () => {
    const onSend = vi.fn();
    const onMessageTooLong = vi.fn();
    render(
      <Input
        isAttachmentsEnabled={false}
        maxMessageLength={MAX}
        message={atCap}
        onSend={onSend}
        onMessageTooLong={onMessageTooLong}
      />,
    );

    fireEvent.click(screen.getByLabelText('Send message'));

    expect(onMessageTooLong).toHaveBeenCalledWith(MAX, MAX);
    expect(onSend).not.toHaveBeenCalled();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      atCap,
    );
  });

  /*
   * The regressed case: the cap used to be checked only when attachments were
   * disabled, so a typed message past the cap went out silently on every model
   * that accepts attachments.
   */
  it('blocks sending at the cap when attachments are enabled', () => {
    const onSend = vi.fn();
    const onMessageTooLong = vi.fn();
    render(
      <Input
        isAttachmentsEnabled
        maxMessageLength={MAX}
        message={atCap}
        onSend={onSend}
        onMessageTooLong={onMessageTooLong}
      />,
    );

    fireEvent.click(screen.getByLabelText('Send message'));

    expect(onMessageTooLong).toHaveBeenCalledWith(MAX, MAX);
    expect(onSend).not.toHaveBeenCalled();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      atCap,
    );
  });

  it.each([true, false])(
    'sends below the cap even past pasteTextThreshold (attachments enabled: %s)',
    (isAttachmentsEnabled) => {
      const onSend = vi.fn();
      const onMessageTooLong = vi.fn();
      render(
        <Input
          isAttachmentsEnabled={isAttachmentsEnabled}
          maxMessageLength={MAX}
          pasteTextThreshold={2}
          message={belowCap}
          onSend={onSend}
          onMessageTooLong={onMessageTooLong}
        />,
      );

      fireEvent.click(screen.getByLabelText('Send message'));

      expect(onMessageTooLong).not.toHaveBeenCalled();
      expect(onSend).toHaveBeenCalledWith(belowCap, []);
    },
  );

  it('does not warn at paste time when the paste becomes an attachment', () => {
    const onMessageTooLong = vi.fn();
    render(
      <Input
        isAttachmentsEnabled
        maxMessageLength={MAX}
        pasteTextThreshold={2}
        onMessageTooLong={onMessageTooLong}
      />,
    );

    fireEvent.paste(screen.getByRole('textbox'), {
      clipboardData: {
        items: [] as unknown as DataTransferItemList,
        getData: () => 'x'.repeat(MAX + 5),
      },
    });

    expect(onMessageTooLong).not.toHaveBeenCalled();
  });

  /*
   * When the paste cannot become an attachment (text attachments not allowed),
   * it lands inline, so the paste itself is the only chance to report the cap.
   */
  it('warns at paste time when text attachments are not allowed', () => {
    const onMessageTooLong = vi.fn();
    render(
      <Input
        isAttachmentsEnabled
        isTextAttachmentsAllowed={false}
        maxMessageLength={MAX}
        pasteTextThreshold={2}
        onMessageTooLong={onMessageTooLong}
      />,
    );

    fireEvent.paste(screen.getByRole('textbox'), {
      clipboardData: {
        items: [] as unknown as DataTransferItemList,
        getData: () => 'x'.repeat(MAX + 5),
      },
    });

    expect(onMessageTooLong).toHaveBeenCalledWith(MAX + 5, MAX);
  });
});

/* Issue #8754: a picked prompt used to arrive on the `message` channel, which
 * replaces the whole textarea value, so any draft was destroyed with no undo.
 * Issue #8781: the insert then had to survive as an *undoable* edit. */
describe('Input — textInsertion', () => {
  const renderWithInsertion = (revision: number, text: string) =>
    render(<Input textInsertion={{ text, revision }} />);

  /* The insert is deferred to a microtask so it lands outside the commit that
     asked for it; draining that queue is what the browser does next. */
  const flushInsertion = () => act(async () => undefined);

  it('does not insert the text it was mounted with', async () => {
    renderWithInsertion(1, 'Prompt body');
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await flushInsertion();

    expect(textarea.value).toBe('');
  });

  it('keeps the typed draft and inserts at the caret', async () => {
    const { rerender } = renderWithInsertion(0, '');
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'my draft' } });
    textarea.setSelectionRange(3, 3);
    rerender(<Input textInsertion={{ text: 'PROMPT', revision: 1 }} />);
    await flushInsertion();

    expect(textarea.value).toBe('my PROMPTdraft');
  });

  it('appends when the caret sits at the end of the draft', async () => {
    const { rerender } = renderWithInsertion(0, '');
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'draft ' } });
    textarea.setSelectionRange(6, 6);
    rerender(<Input textInsertion={{ text: 'PROMPT', revision: 1 }} />);
    await flushInsertion();

    expect(textarea.value).toBe('draft PROMPT');
  });

  it('replaces the selection rather than the whole draft', async () => {
    const { rerender } = renderWithInsertion(0, '');
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'keep drop keep' } });
    textarea.setSelectionRange(5, 9);
    rerender(<Input textInsertion={{ text: 'PROMPT', revision: 1 }} />);
    await flushInsertion();

    expect(textarea.value).toBe('keep PROMPT keep');
  });

  it('reports the merged value through onChange', async () => {
    const handleChange = vi.fn();
    const { rerender } = render(
      <Input
        textInsertion={{ text: '', revision: 0 }}
        onChange={handleChange}
      />,
    );
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'draft ' } });
    textarea.setSelectionRange(6, 6);
    handleChange.mockClear();
    rerender(
      <Input
        textInsertion={{ text: 'PROMPT', revision: 1 }}
        onChange={handleChange}
      />,
    );
    await flushInsertion();

    expect(handleChange).toHaveBeenCalledWith('draft PROMPT');
  });

  it('inserts the same text again when only the revision changes', async () => {
    const { rerender } = renderWithInsertion(0, '');
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

    rerender(<Input textInsertion={{ text: 'AB', revision: 1 }} />);
    await flushInsertion();
    rerender(<Input textInsertion={{ text: 'AB', revision: 2 }} />);
    await flushInsertion();

    expect(textarea.value).toBe('ABAB');
  });

  it('returns focus to the textarea so the user can keep typing', async () => {
    const { rerender } = renderWithInsertion(0, '');
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'ab' } });
    textarea.setSelectionRange(1, 1);
    textarea.blur();
    rerender(<Input textInsertion={{ text: 'XY', revision: 1 }} />);
    await flushInsertion();

    /* eslint-disable-next-line testing-library/no-node-access -- focus is the assertion; no semantic query exposes the active element */
    expect(document.activeElement).toBe(textarea);
    expect(textarea.value).toBe('aXYb');
  });

  /* Issue #8781: the menu the prompt was picked in returns focus to its own
     opener from a microtask queued as it unmounts, which used to leave the
     caret outside the composer — and the undo shortcut with nothing to act on. */
  it('keeps the caret in the composer when the closing menu returns focus to its opener', async () => {
    const withOpener = (revision: number, text: string) => (
      <>
        <button type="button">Prompts</button>
        <Input textInsertion={{ text, revision }} />
      </>
    );
    const { rerender } = render(withOpener(0, ''));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    const opener = screen.getByRole('button', { name: 'Prompts' });

    fireEvent.change(textarea, { target: { value: 'draft ' } });
    textarea.setSelectionRange(6, 6);
    textarea.blur();

    /* Queued before the insertion is requested, exactly as the closing menu's
       own `returnFocus` microtask is. */
    queueMicrotask(() => opener.focus());
    rerender(withOpener(1, 'PROMPT'));
    await flushInsertion();

    /* eslint-disable-next-line testing-library/no-node-access -- focus is the assertion; no semantic query exposes the active element */
    expect(document.activeElement).toBe(textarea);
    expect(textarea.selectionStart).toBe('draft PROMPT'.length);
  });

  /* The native path is what makes the insert undoable; jsdom has no
   * execCommand, so the production branch is only reachable with a stub. */
  it('uses the browser editing command so the insert lands on the native undo stack', async () => {
    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand;

    try {
      const { rerender } = renderWithInsertion(0, '');
      rerender(<Input textInsertion={{ text: 'PROMPT', revision: 1 }} />);
      await flushInsertion();

      expect(execCommand).toHaveBeenCalledWith('insertText', false, 'PROMPT');
    } finally {
      delete (document as Partial<Document>).execCommand;
    }
  });

  it('leaves Ctrl+Z to the browser when the insert went on the native undo stack', async () => {
    document.execCommand = vi.fn().mockReturnValue(true);

    try {
      const { rerender } = renderWithInsertion(0, '');
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      fireEvent.change(textarea, { target: { value: 'draft ' } });
      rerender(<Input textInsertion={{ text: 'PROMPT', revision: 1 }} />);
      await flushInsertion();

      /* `fireEvent` reports `false` for a consumed event, so `true` is the
         assertion that the browser's own undo was left to run. */
      expect(fireEvent.keyDown(textarea, { key: 'z', ctrlKey: true })).toBe(
        true,
      );
    } finally {
      delete (document as Partial<Document>).execCommand;
    }
  });

  /* Browsers that cannot insert into a textarea through the editing pipeline
     (Firefox) only take the value programmatically, which drops their undo
     history — so the hook owes the user that one undo itself (issue #8781).
     jsdom has no `execCommand` at all, which is exactly that case. */
  describe('when the browser cannot put the insert on its undo stack', () => {
    const insertIntoDraft = async (draft: string, text = 'PROMPT') => {
      const { rerender } = renderWithInsertion(0, '');
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      fireEvent.change(textarea, { target: { value: draft } });
      textarea.setSelectionRange(draft.length, draft.length);
      rerender(<Input textInsertion={{ text, revision: 1 }} />);
      await flushInsertion();

      return textarea;
    };

    it('restores the draft on Ctrl+Z and keeps what the user typed', async () => {
      const textarea = await insertIntoDraft('my draft ');
      expect(textarea.value).toBe('my draft PROMPT');

      expect(fireEvent.keyDown(textarea, { key: 'z', ctrlKey: true })).toBe(
        false,
      );

      expect(textarea.value).toBe('my draft ');
      expect(textarea.selectionStart).toBe('my draft '.length);
    });

    it('restores the draft on Cmd+Z', async () => {
      const textarea = await insertIntoDraft('my draft ');

      fireEvent.keyDown(textarea, { key: 'z', metaKey: true });

      expect(textarea.value).toBe('my draft ');
    });

    it('restores the selection the insertion replaced', async () => {
      const { rerender } = renderWithInsertion(0, '');
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      fireEvent.change(textarea, { target: { value: 'keep drop keep' } });
      textarea.setSelectionRange(5, 9);
      rerender(<Input textInsertion={{ text: 'PROMPT', revision: 1 }} />);
      await flushInsertion();

      fireEvent.keyDown(textarea, { key: 'z', ctrlKey: true });

      expect(textarea.value).toBe('keep drop keep');
      expect(textarea.selectionStart).toBe(5);
      expect(textarea.selectionEnd).toBe(9);
    });

    it('reports the restored draft through onChange', async () => {
      const handleChange = vi.fn();
      const { rerender } = render(
        <Input
          textInsertion={{ text: '', revision: 0 }}
          onChange={handleChange}
        />,
      );
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      fireEvent.change(textarea, { target: { value: 'draft ' } });
      rerender(
        <Input
          textInsertion={{ text: 'PROMPT', revision: 1 }}
          onChange={handleChange}
        />,
      );
      await flushInsertion();
      handleChange.mockClear();

      fireEvent.keyDown(textarea, { key: 'z', ctrlKey: true });

      expect(handleChange).toHaveBeenCalledWith('draft ');
    });

    it('undoes only the latest insertion', async () => {
      const { rerender } = renderWithInsertion(0, '');
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      fireEvent.change(textarea, { target: { value: 'draft ' } });
      rerender(<Input textInsertion={{ text: 'ONE ', revision: 1 }} />);
      await flushInsertion();
      rerender(<Input textInsertion={{ text: 'TWO', revision: 2 }} />);
      await flushInsertion();

      fireEvent.keyDown(textarea, { key: 'z', ctrlKey: true });

      expect(textarea.value).toBe('draft ONE ');
    });

    it('hands the undo back to the browser once the user has typed', async () => {
      const textarea = await insertIntoDraft('draft ');

      fireEvent.change(textarea, { target: { value: 'draft PROMPT!' } });

      expect(fireEvent.keyDown(textarea, { key: 'z', ctrlKey: true })).toBe(
        true,
      );
      expect(textarea.value).toBe('draft PROMPT!');
    });

    it('undoes once and leaves any further Ctrl+Z to the browser', async () => {
      const textarea = await insertIntoDraft('draft ');

      fireEvent.keyDown(textarea, { key: 'z', ctrlKey: true });

      expect(fireEvent.keyDown(textarea, { key: 'z', ctrlKey: true })).toBe(
        true,
      );
      expect(textarea.value).toBe('draft ');
    });

    it('does not treat the redo shortcut as an undo', async () => {
      const textarea = await insertIntoDraft('draft ');

      expect(
        fireEvent.keyDown(textarea, {
          key: 'z',
          ctrlKey: true,
          shiftKey: true,
        }),
      ).toBe(true);
      expect(textarea.value).toBe('draft PROMPT');
    });
  });

  it('leaves the draft alone when the inserted text is empty', async () => {
    const { rerender } = renderWithInsertion(0, '');
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'draft' } });
    rerender(<Input textInsertion={{ text: '', revision: 1 }} />);
    await flushInsertion();

    expect(textarea.value).toBe('draft');
  });
});
