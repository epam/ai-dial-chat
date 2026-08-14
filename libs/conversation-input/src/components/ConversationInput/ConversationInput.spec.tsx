import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

    expect(screen.queryByLabelText('Send message')).toBeNull();
    expect(handleSend).not.toHaveBeenCalled();
  });

  it('should hide welcome text when welcomeText prop is empty string', () => {
    render(<ConversationInput welcomeText="" />);
    expect(screen.queryByRole('heading')).toBeNull();
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
