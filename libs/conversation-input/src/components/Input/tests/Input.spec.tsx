import {
  AttachmentType,
  RequestStatus,
  type Attachment,
} from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    DialDropdown: ({
      children,
      items,
    }: {
      children: ReactNode;
      items?: MenuItems;
    }) => (
      <div>
        {children}
        {items?.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            disabled={item.disabled}
          >
            {item.label}
          </button>
        ))}
      </div>
    ),
    DialDropdownIcon: ({
      ariaLabel,
      icon,
      items,
    }: {
      ariaLabel: string;
      icon: ReactNode;
      items?: MenuItems;
    }) => (
      <div>
        <button type="button" aria-label={ariaLabel}>
          {items?.[0]?.key.startsWith('__loading-') ? icon : null}
        </button>
        {items?.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            disabled={item.disabled}
          >
            {item.key.startsWith('__loading-') ? item.icon : null}
            {item.label}
          </button>
        ))}
      </div>
    ),
    DialSkeleton: ({ variant }: { variant: string }) => (
      <span data-variant={variant} />
    ),
  };
});

describe('Input', () => {
  it('should hide send button when textarea is empty', () => {
    render(<Input />);
    expect(screen.queryByLabelText('Send message')).toBeNull();
  });

  it('should show send button when user types non-whitespace text', () => {
    const { container } = render(<Input />);
    const textarea = container.querySelector('textarea');
    if (textarea) {
      fireEvent.change(textarea, { target: { value: 'Hello' } });
      expect(container.querySelector('button')).toBeTruthy();
    }
  });

  it('should keep send button hidden for whitespace-only input', () => {
    const { container } = render(<Input />);
    const textarea = container.querySelector('textarea');
    if (textarea) {
      fireEvent.change(textarea, { target: { value: '   ' } });
      expect(screen.queryByLabelText('Send message')).toBeNull();
    }
  });

  it('should pre-populate textarea with initialMessage', () => {
    const { container } = render(<Input message="Hello" />);
    const textarea = container.querySelector('textarea');
    expect(textarea?.value).toBe('Hello');
  });

  it('should call onSend with message text and clear textarea on Enter', () => {
    const handleSend = vi.fn();
    const { container } = render(<Input onSend={handleSend} />);
    const textarea = container.querySelector('textarea');
    if (textarea) {
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
      expect(handleSend).toHaveBeenCalledWith('Test message', []);
      expect(textarea.value).toBe('');
    }
  });

  it('should not call onSend on Shift+Enter', () => {
    const handleSend = vi.fn();
    const { container } = render(<Input onSend={handleSend} />);
    const textarea = container.querySelector('textarea');
    if (textarea) {
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
      expect(handleSend).not.toHaveBeenCalled();
      expect(textarea.value).toBe('Test message');
    }
  });

  it('should call onChange on each keystroke', () => {
    const handleChange = vi.fn();
    const { container } = render(<Input onChange={handleChange} />);
    const textarea = container.querySelector('textarea');
    if (textarea) {
      fireEvent.change(textarea, { target: { value: 'Hi' } });
      expect(handleChange).toHaveBeenCalledWith('Hi');
    }
  });

  it('should call onSend when send button is clicked', () => {
    const handleSend = vi.fn();
    const { container } = render(<Input onSend={handleSend} />);
    const textarea = container.querySelector('textarea');
    if (textarea) {
      fireEvent.change(textarea, { target: { value: 'Click send' } });
    }
    const sendButton = screen.getByLabelText('Send message');
    fireEvent.click(sendButton);
    expect(handleSend).toHaveBeenCalledWith('Click send', []);
  });

  it('should set --ci-bg and --ci-text CSS variables when colors prop is provided', () => {
    const { container } = render(
      <Input colors={{ background: '#fff', text: '#000' }} />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.getPropertyValue('--ci-bg')).toBe('#fff');
    expect(wrapper.style.getPropertyValue('--ci-text')).toBe('#000');
  });

  it('should not set CSS variable for omitted color fields', () => {
    const { container } = render(<Input colors={{ background: '#fff' }} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.getPropertyValue('--ci-text')).toBe('');
  });

  it('should apply the typography fontClassName to the textarea', () => {
    const { container } = render(
      <Input typography={{ fontClassName: 'dial-body-paragraph-text' }} />,
    );
    expect(container.querySelector('textarea')?.className).toContain(
      'dial-body-paragraph-text',
    );
  });

  it('should use custom placeholder when provided', () => {
    const { container } = render(<Input placeholder="Ask anything" />);
    expect(container.querySelector('textarea')?.placeholder).toBe(
      'Ask anything',
    );
  });

  it('should use default placeholder when prop is omitted', () => {
    const { container } = render(<Input />);
    expect(container.querySelector('textarea')?.placeholder).toBe(
      'Type a message...',
    );
  });

  it('should merge className onto the wrapper element', () => {
    const { container } = render(<Input className="mt-4" />);
    expect(container.firstElementChild?.classList.contains('mt-4')).toBe(true);
  });

  it('should set aria-label on textarea when ariaLabel prop is provided', () => {
    const { container } = render(<Input ariaLabel="Message input" />);
    expect(
      container.querySelector('textarea')?.getAttribute('aria-label'),
    ).toBe('Message input');
  });

  it('should render the add menu button', () => {
    render(<Input />);
    expect(screen.getByLabelText('Add')).toBeTruthy();
  });

  it('should show an attachment card after a file is picked', () => {
    render(<Input />);
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(screen.getByText('doc')).toBeTruthy();
  });

  it('should show send button when only an attachment is present and no text', () => {
    render(<Input />);
    expect(screen.queryByLabelText('Send message')).toBeNull();
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(screen.getByLabelText('Send message')).toBeTruthy();
  });

  it('should call onSend with empty text and the attachment on Enter when no text is typed', () => {
    const handleSend = vi.fn();
    const { container } = render(<Input onSend={handleSend} />);
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    const textarea = container.querySelector('textarea')!;
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(handleSend).toHaveBeenCalledWith(
      '',
      expect.arrayContaining([expect.objectContaining({ name: 'doc.pdf' })]),
    );
  });

  it('should remove the card when the remove button is clicked', () => {
    render(<Input />);
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByLabelText('Remove attachment'));
    expect(screen.queryByText('doc')).toBeNull();
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
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(onAttachmentsChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'doc.pdf' })]),
    );
  });

  it('should show mic button when isTranscriptionSupported and message is empty', () => {
    render(<Input isTranscriptionSupported micLabel="Record voice message" />);
    expect(screen.getByLabelText('Record voice message')).toBeTruthy();
  });

  it('should hide mic button when message is not empty', () => {
    const { container } = render(
      <Input isTranscriptionSupported micLabel="Record voice message" />,
    );
    const textarea = container.querySelector('textarea')!;
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    expect(screen.queryByLabelText('Record voice message')).toBeNull();
  });

  it('should hide mic button when isTranscriptionSupported is false', () => {
    render(
      <Input
        isTranscriptionSupported={false}
        micLabel="Record voice message"
      />,
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
    const { container } = render(
      <Input
        deployments={[]}
        selectedDeploymentId={null}
        onDeploymentChange={vi.fn()}
        modelSelectorLabels={{ loading: 'Loading models…' }}
      />,
    );
    const loadingItem = screen.getByText('Loading models…');
    expect(loadingItem).toBeTruthy();
    const skeletons = Array.from(
      container.querySelectorAll<HTMLElement>('[data-variant]'),
    );
    expect(
      skeletons.filter((skeleton) => skeleton.dataset.variant === 'circular'),
    ).toHaveLength(8);
    expect(
      skeletons.filter((skeleton) => skeleton.dataset.variant === 'text'),
    ).toHaveLength(7);
    expect(
      screen
        .getAllByRole('button')
        .filter((button) => (button as HTMLButtonElement).disabled),
    ).toHaveLength(7);
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
    const { container } = render(
      <Input
        deployments={mockItems}
        selectedDeploymentId={null}
        onDeploymentChange={vi.fn()}
      />,
    );
    const textarea = container.querySelector('textarea');
    if (textarea) {
      fireEvent.change(textarea, { target: { value: 'Hello' } });
    }
    const sendButton = screen.getByLabelText(
      'Send message',
    ) as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);
  });

  it('does not fire onSend on Enter when selectedDeploymentId is null', () => {
    const handleSend = vi.fn();
    const { container } = render(
      <Input
        onSend={handleSend}
        deployments={mockItems}
        selectedDeploymentId={null}
        onDeploymentChange={vi.fn()}
      />,
    );
    const textarea = container.querySelector('textarea');
    if (textarea) {
      fireEvent.change(textarea, { target: { value: 'Hello' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    }
    expect(handleSend).not.toHaveBeenCalled();
  });

  it('does not render selector when deployments is undefined', () => {
    render(<Input />);
    expect(screen.queryByLabelText(/Select model/)).toBeNull();
  });
});

describe('Input — isInputDisabled', () => {
  it('textarea has disabled attribute when isInputDisabled is true', () => {
    const { container } = render(<Input isInputDisabled />);
    const textarea = container.querySelector('textarea');
    expect(textarea?.disabled).toBe(true);
  });

  it('textarea is enabled when isInputDisabled is false', () => {
    const { container } = render(<Input isInputDisabled={false} />);
    const textarea = container.querySelector('textarea');
    expect(textarea?.disabled).toBe(false);
  });

  it('send button is disabled when isInputDisabled is true', () => {
    render(<Input message="Hello" isInputDisabled />);
    const sendButton = screen.getByLabelText(
      'Send message',
    ) as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);
  });

  it('attach button is disabled when isInputDisabled is true', () => {
    render(<Input isInputDisabled />);
    const addButton = screen.getByLabelText('Add') as HTMLButtonElement;
    expect(addButton.disabled).toBe(true);
  });

  it('does not call onSend on Enter when isInputDisabled is true', () => {
    const handleSend = vi.fn();
    const { container } = render(<Input onSend={handleSend} isInputDisabled />);
    const textarea = container.querySelector('textarea');
    if (textarea) {
      fireEvent.change(textarea, { target: { value: 'Hello' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    }
    expect(handleSend).not.toHaveBeenCalled();
  });

  it('calls onSend on Enter when isInputDisabled is false', () => {
    const handleSend = vi.fn();
    const { container } = render(
      <Input onSend={handleSend} isInputDisabled={false} />,
    );
    const textarea = container.querySelector('textarea');
    if (textarea) {
      fireEvent.change(textarea, { target: { value: 'Hello' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    }
    expect(handleSend).toHaveBeenCalledWith('Hello', []);
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
    let resolveUpload!: (url: string) => void;
    const uploadPromise = new Promise<string>((resolve) => {
      resolveUpload = resolve;
    });
    const handleUploadAttachment = vi.fn(() => uploadPromise);

    render(<Input onUploadAttachment={handleUploadAttachment} />);
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
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

    resolveUpload('https://example.com/doc.pdf');

    await waitFor(() => {
      expect(
        (screen.getByLabelText('Send message') as HTMLButtonElement).disabled,
      ).toBe(false);
    });
  });

  it('restores message text and attachment tray when onSend rejects', async () => {
    const handleSend = vi.fn().mockRejectedValue(new Error('upload failed'));

    const { container } = render(<Input onSend={handleSend} />);
    const textarea = container.querySelector('textarea');
    expect(textarea).toBeTruthy();
    fireEvent.change(textarea as HTMLTextAreaElement, {
      target: { value: 'Please send this file' },
    });

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText('doc')).toBeTruthy();
    const sendButton = screen.getByLabelText('Send message');
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(handleSend).toHaveBeenCalled();
    });
    expect((textarea as HTMLTextAreaElement).value).toBe(
      'Please send this file',
    );
    expect(screen.queryByText('doc')).toBeTruthy();
  });

  it('tray clears after onSend resolves', async () => {
    const handleSend = vi.fn().mockResolvedValue(undefined);

    render(<Input onSend={handleSend} />);
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText('doc')).toBeTruthy();
    const sendButton = screen.getByLabelText('Send message');
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.queryByText('doc')).toBeNull();
    });
  });

  it('shows retry for failed immediate uploads and retries the same attachment', async () => {
    const handleUploadAttachment = vi
      .fn()
      .mockRejectedValueOnce(new Error('upload failed'))
      .mockResolvedValueOnce('https://example.com/doc.pdf');

    render(<Input onUploadAttachment={handleUploadAttachment} />);
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByLabelText('Retry upload')).toBeTruthy();
    });

    fireEvent.click(screen.getByLabelText('Retry upload'));

    await waitFor(() => {
      expect(handleUploadAttachment).toHaveBeenCalledTimes(2);
      expect(screen.getByLabelText('Send message')).toBeTruthy();
    });
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
    const { container } = render(<Input pasteTextThreshold={5} />);
    const text = 'This is long enough to become a pasted attachment';

    pasteText(container.querySelector('textarea')!, text);

    const card = screen.getByText(text).closest('[role="button"]')!;
    fireEvent.click(card);

    await waitFor(() => {
      expect(container.querySelector('textarea')?.value).toBe(text);
    });
    expect(screen.queryByRole('list', { name: 'Attached files' })).toBeNull();
  });

  it('clicking a pasted card appends with newline when textarea already has text', async () => {
    const { container } = render(
      <Input pasteTextThreshold={5} message="existing" />,
    );
    const text = 'This is long enough to become a pasted attachment';

    pasteText(container.querySelector('textarea')!, text);

    const card = screen.getByText(text).closest('[role="button"]')!;
    fireEvent.click(card);

    await waitFor(() => {
      expect(container.querySelector('textarea')?.value).toBe(
        `existing\n${text}`,
      );
    });
  });
});
