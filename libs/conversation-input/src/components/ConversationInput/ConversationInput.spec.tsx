import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONVERSATION_INPUT_CLASS } from '../../constants/public-class-names';
import { ConversationInput } from './ConversationInput';

describe('ConversationInput', () => {
  it('should render with welcome text', () => {
    render(<ConversationInput welcomeText="How can I help you?" />);
    expect(screen.getByText('How can I help you?')).toBeTruthy();
  });

  it('should keep welcome text visible when typing', () => {
    render(<ConversationInput welcomeText="How can I help you?" />);
    const textarea = screen.getByRole('textbox');

    fireEvent.change(textarea, { target: { value: 'Hello' } });
    expect(screen.getByText('How can I help you?')).toBeTruthy();
  });

  it('should call onSend when send button is clicked', () => {
    const handleSend = vi.fn();
    render(<ConversationInput onSend={handleSend} />);

    const textarea = screen.getByRole('textbox');

    fireEvent.change(textarea, { target: { value: 'Test message' } });
    fireEvent.click(screen.getByLabelText('Send message'));

    expect(handleSend).toHaveBeenCalledWith('Test message', []);
  });

  it('should call onSend when Enter is pressed', () => {
    const handleSend = vi.fn();
    render(<ConversationInput onSend={handleSend} />);

    const textarea = screen.getByRole('textbox');

    fireEvent.change(textarea, { target: { value: 'Test message' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(handleSend).toHaveBeenCalledWith('Test message', []);
  });

  it('should not send empty messages', () => {
    const handleSend = vi.fn();
    render(<ConversationInput onSend={handleSend} />);

    expect(
      (screen.getByLabelText('Send message') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(handleSend).not.toHaveBeenCalled();
  });

  it('should hide welcome text when welcomeText prop is empty string', () => {
    render(<ConversationInput welcomeText="" />);
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('renders description text below the welcome heading', () => {
    render(
      <ConversationInput
        welcomeText="Afternoon, Nivesh"
        descriptionText="Your secure, all-in-one AI assistant."
      />,
    );
    expect(
      screen.getByText('Your secure, all-in-one AI assistant.'),
    ).toBeTruthy();
  });

  it('hides description text when welcomeText is absent', () => {
    render(<ConversationInput descriptionText="Your secure AI assistant." />);
    expect(screen.queryByText('Your secure AI assistant.')).toBeNull();
  });

  it('should not call onSend when Shift+Enter is pressed', () => {
    const handleSend = vi.fn();
    render(<ConversationInput onSend={handleSend} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Test message' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(handleSend).not.toHaveBeenCalled();
  });

  it('should seed textarea with initialMessage', () => {
    render(<ConversationInput message="Prefilled text" />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveProperty('value', 'Prefilled text');
  });

  it('should forward placeholder to the textarea', () => {
    render(<ConversationInput placeholder="Ask me anything" />);
    expect(screen.getByPlaceholderText('Ask me anything')).toBeTruthy();
  });

  it('merges inputClassName onto the inner Input wrapper, not the outer root', () => {
    const { container } = render(
      <ConversationInput inputClassName="border-2 border-info" />,
    );
    // Pure CSS-level check: the target wrapper has no semantic role/text of
    // its own, so a class-name query is the only way to identify it (see
    // .claude/rules/spec.md "Selector priority" container exception).
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const innerWrapper = container.querySelector('.border-2');
    expect(innerWrapper).toBeTruthy();
    expect(innerWrapper?.classList.contains('border-info')).toBe(true);
  });

  it('disables the send button when isSendDisabled is true, without disabling the textarea', () => {
    render(
      <ConversationInput message="Hello" onSend={vi.fn()} isSendDisabled />,
    );
    expect(screen.getByLabelText('Send message').hasAttribute('disabled')).toBe(
      true,
    );
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveProperty('disabled', false);
  });
});

describe('ConversationInput — attachments', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:mock'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pendingDropFiles creates an attachment card', async () => {
    const onConsumed = vi.fn();
    const file = new File(['content'], 'report.pdf', {
      type: 'application/pdf',
    });
    render(
      <ConversationInput
        pendingDropFiles={[file]}
        onDropFilesConsumed={onConsumed}
      />,
    );
    expect(await screen.findByText('report')).toBeTruthy();
    expect(onConsumed).toHaveBeenCalled();
  });

  it('pasting an image creates an image attachment card', async () => {
    render(<ConversationInput />);
    const textarea = screen.getByRole('textbox');
    const blob = new Blob(['img'], { type: 'image/png' });
    const item = { kind: 'file', type: 'image/png', getAsFile: () => blob };

    fireEvent.paste(textarea, {
      clipboardData: {
        items: [item] as unknown as DataTransferItemList,
        getData: () => '',
      },
    });

    expect((await screen.findByRole('img')).getAttribute('src')).toBe(
      'blob:mock',
    );
  });

  it('pasting long text creates a pasted attachment card', () => {
    render(<ConversationInput pasteTextThreshold={5} />);
    const textarea = screen.getByRole('textbox');
    const text = 'This text is long enough';

    fireEvent.paste(textarea, {
      clipboardData: {
        items: [] as unknown as DataTransferItemList,
        getData: () => text,
      },
    });

    expect(screen.getByText(text)).toBeTruthy();
  });

  it('pasting short text does not create an attachment card', () => {
    render(<ConversationInput pasteTextThreshold={100} />);
    const textarea = screen.getByRole('textbox');

    fireEvent.paste(textarea, {
      clipboardData: {
        items: [] as unknown as DataTransferItemList,
        getData: () => 'hi',
      },
    });

    expect(screen.queryByRole('list', { name: 'Attached files' })).toBeNull();
  });
});

describe('ConversationInput — attachment tray styles', () => {
  it('forwards styles.attachmentTray to the composer tray', () => {
    render(
      <ConversationInput
        pendingAttachments={[
          {
            id: 'report',
            name: 'report.pdf',
            file: new File([], 'report.pdf', { type: 'application/pdf' }),
            type: AttachmentType.File,
            contentType: 'application/pdf',
            url: 'files/report.pdf',
            status: RequestStatus.Idle,
          },
        ]}
        styles={{ attachmentTray: { className: 'host-tray' } }}
      />,
    );

    expect(
      screen.getByRole('list', { name: 'Attached files' }).classList,
    ).toContain('host-tray');
  });
});

describe('ConversationInput — model menu styles', () => {
  it('forwards styles.modelMenu to the model menu', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <ConversationInput
        deployments={[{ id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' }]}
        selectedDeploymentId="gpt-4o"
        styles={{ modelMenu: { className: 'host-menu' } }}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Select model/ }));

    /* The panel carries no role of its own, so the row is found by role and
       walked up to it. */
    expect(
      screen
        .getByRole('menuitemradio', { name: 'GPT-4o' })
        // eslint-disable-next-line testing-library/no-node-access
        .closest(`.${CONVERSATION_INPUT_CLASS.modelMenu}`)?.classList,
    ).toContain('host-menu');
  });
});
