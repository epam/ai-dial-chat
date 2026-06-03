import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationInput } from './ConversationInput.js';

describe('ConversationInput', () => {
  it('should render with welcome text', () => {
    render(<ConversationInput welcomeText="How can I help you?" />);
    expect(screen.getByText('How can I help you?')).toBeTruthy();
  });

  it('should keep welcome text visible when typing', () => {
    const { container } = render(
      <ConversationInput welcomeText="How can I help you?" />,
    );
    const textarea = container.querySelector('textarea');

    if (textarea) {
      fireEvent.change(textarea, { target: { value: 'Hello' } });
      expect(screen.getByText('How can I help you?')).toBeTruthy();
    }
  });

  it('should call onSend when send button is clicked', () => {
    const handleSend = vi.fn();
    const { container } = render(<ConversationInput onSend={handleSend} />);

    const textarea = container.querySelector('textarea');

    if (textarea) {
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.click(screen.getByLabelText('Send message'));

      expect(handleSend).toHaveBeenCalledWith('Test message', []);
    }
  });

  it('should call onSend when Enter is pressed', () => {
    const handleSend = vi.fn();
    const { container } = render(<ConversationInput onSend={handleSend} />);

    const textarea = container.querySelector('textarea');

    if (textarea) {
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

      expect(handleSend).toHaveBeenCalledWith('Test message', []);
    }
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
    const { container } = render(<ConversationInput onSend={handleSend} />);
    const textarea = container.querySelector('textarea');
    if (textarea) {
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
      expect(handleSend).not.toHaveBeenCalled();
    }
  });

  it('should seed textarea with initialMessage', () => {
    const { container } = render(
      <ConversationInput message="Prefilled text" />,
    );
    const textarea = container.querySelector('textarea');
    expect(textarea?.value).toBe('Prefilled text');
  });

  it('should forward placeholder to the textarea', () => {
    const { container } = render(
      <ConversationInput placeholder="Ask me anything" />,
    );
    const textarea = container.querySelector('textarea');
    expect(textarea?.placeholder).toBe('Ask me anything');
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

  const makeDragEvent = (types: string[] = ['Files'], files: File[] = []) => {
    const items = files.map((f) => ({
      kind: 'file',
      type: f.type,
      getAsFile: () => f,
    }));
    return {
      dataTransfer: {
        types,
        files: files as unknown as FileList,
        items: items as unknown as DataTransferItemList,
      },
      preventDefault: vi.fn(),
    } as unknown as DragEvent;
  };

  it('shows drop overlay when dragging files over and hides it on drag leave', async () => {
    const { container } = render(<ConversationInput dropLabel="Drop here" />);
    const root = container.firstElementChild as HTMLElement;

    const file = new File(['x'], 'x.txt', { type: 'text/plain' });
    fireEvent.dragEnter(root, makeDragEvent(['Files'], [file]));
    await waitFor(() => expect(screen.getByText('Drop here')).toBeTruthy());

    fireEvent.dragLeave(root, makeDragEvent(['Files'], [file]));
    await waitFor(() => expect(screen.queryByText('Drop here')).toBeNull());
  });

  it('does not show drop overlay for non-file drags', () => {
    const { container } = render(<ConversationInput dropLabel="Drop here" />);
    const root = container.firstElementChild as HTMLElement;

    fireEvent.dragEnter(root, makeDragEvent(['text/plain']));
    expect(screen.queryByText('Drop here')).toBeNull();
  });

  it('dropping a file creates an attachment card', async () => {
    const { container } = render(<ConversationInput />);
    const root = container.firstElementChild as HTMLElement;
    const file = new File(['content'], 'report.pdf', {
      type: 'application/pdf',
    });

    fireEvent.drop(root, makeDragEvent(['Files'], [file]));

    await waitFor(() => expect(screen.getByText('report')).toBeTruthy());
  });

  it('pasting an image creates an image attachment card', () => {
    const { container } = render(<ConversationInput />);
    const textarea = container.querySelector('textarea')!;
    const blob = new Blob(['img'], { type: 'image/png' });
    const item = { kind: 'file', type: 'image/png', getAsFile: () => blob };

    fireEvent.paste(textarea, {
      clipboardData: {
        items: [item] as unknown as DataTransferItemList,
        getData: () => '',
      },
    });

    expect(container.querySelector('img[src="blob:mock"]')).toBeTruthy();
  });

  it('pasting long text creates a pasted attachment card', () => {
    const { container } = render(<ConversationInput pasteTextThreshold={5} />);
    const textarea = container.querySelector('textarea')!;
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
    const { container } = render(
      <ConversationInput pasteTextThreshold={100} />,
    );
    const textarea = container.querySelector('textarea')!;

    fireEvent.paste(textarea, {
      clipboardData: {
        items: [] as unknown as DataTransferItemList,
        getData: () => 'hi',
      },
    });

    expect(screen.queryByRole('list', { name: 'Attached files' })).toBeNull();
  });
});
