import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import {
  AttachmentType,
  CodeBlockTheme,
  MessageRole,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BubblePosition } from '../../../types/bubble-position';
import { AssistantMessageBubble } from '../AssistantMessageBubble';
import { MessageBubble } from '../MessageBubble';
import { StatusMessageBubble } from '../StatusMessageBubble';
import { UserMessageBubble } from '../UserMessageBubble';

const ATTACHMENT: DisplayAttachment = {
  id: 'report.pdf',
  name: 'report.pdf',
  contentType: 'application/pdf',
  type: AttachmentType.File,
  status: RequestStatus.Idle,
};

const getMessageTextWrapper = (message: string) => {
  const paragraph = screen.getByText((_, element) => {
    return element?.tagName === 'P' && element.textContent === message;
  });

  return paragraph.parentElement as HTMLElement;
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('MessageBubble', () => {
  it('renders the provided text content', () => {
    const { getByText } = render(
      <MessageBubble text="Hello world" role={MessageRole.User} />,
    );
    expect(getByText('Hello world')).toBeTruthy();
  });

  it('applies rounded-se-[6px] with BubblePosition.Bottom (default)', () => {
    const { container } = render(
      <MessageBubble text="msg" role={MessageRole.User} />,
    );
    expect(container.querySelector(':scope > * > * > *')?.className).toContain(
      'rounded-se-[6px]',
    );
  });

  it('applies rounded-ee-[6px] with BubblePosition.Top', () => {
    const { container } = render(
      <MessageBubble
        text="msg"
        role={MessageRole.User}
        position={BubblePosition.Top}
      />,
    );
    expect(container.querySelector(':scope > * > * > *')?.className).toContain(
      'rounded-ee-[6px]',
    );
  });

  it('merges additional className onto the container', () => {
    const { container } = render(
      <MessageBubble
        text="msg"
        role={MessageRole.User}
        styles={{ className: 'my-custom-class' }}
      />,
    );
    expect(container.querySelector(':scope > *')?.className).toContain(
      'my-custom-class',
    );
  });

  it('does not apply user rounded classes for assistant messages', () => {
    const { container } = render(
      <MessageBubble text="msg" role={MessageRole.Assistant} />,
    );
    const innerClassName = container.querySelector(':scope > * > *')?.className;
    expect(innerClassName).not.toContain('rounded-tr-[24px]');
    expect(innerClassName).not.toContain('rounded-br-[24px]');
  });

  it('renders no action buttons when no actions prop is given (read-only)', () => {
    render(<MessageBubble text="msg" role={MessageRole.User} />);
    expect(screen.queryByRole('button', { name: 'Edit message' })).toBeNull();
  });

  it('renders user actions from actions prop', () => {
    render(
      <MessageBubble
        text="msg"
        role={MessageRole.User}
        actions={{ role: MessageRole.User, onEdit: vi.fn() }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Edit message' })).toBeTruthy();
  });

  it('renders assistant actions from actions prop', () => {
    render(
      <MessageBubble
        text="msg"
        role={MessageRole.Assistant}
        actions={{ role: MessageRole.Assistant, onRegenerate: vi.fn() }}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Regenerate response' }),
    ).toBeTruthy();
  });

  it('makes actions always visible when hasAlwaysVisibleActions is true', () => {
    const { container } = render(
      <MessageBubble
        text="msg"
        role={MessageRole.User}
        hasAlwaysVisibleActions
      />,
    );
    const actionsWrapper = container.querySelector('[class*="gap-1"]');
    expect(actionsWrapper?.className).not.toContain('opacity-0');
  });

  it('forwards onAttachmentClick and attachmentClickLabel to user bubble', () => {
    const onAttachmentClick = vi.fn();
    render(
      <MessageBubble
        text="Hello"
        role={MessageRole.User}
        attachments={[ATTACHMENT]}
        onAttachmentClick={onAttachmentClick}
        labels={{ attachmentClickLabel: 'Download file' }}
      />,
    );
    fireEvent.click(screen.getByLabelText('Download file'));
    expect(onAttachmentClick).toHaveBeenCalledWith(ATTACHMENT);
  });

  it('forwards onAttachmentClick and attachmentClickLabel to assistant bubble', () => {
    const onAttachmentClick = vi.fn();
    render(
      <MessageBubble
        text="Hello"
        role={MessageRole.Assistant}
        attachments={[ATTACHMENT]}
        onAttachmentClick={onAttachmentClick}
        labels={{ attachmentClickLabel: 'Download file' }}
      />,
    );
    fireEvent.click(screen.getByLabelText('Download file'));
    expect(onAttachmentClick).toHaveBeenCalledWith(ATTACHMENT);
  });
});

describe('UserMessageBubble — attachments', () => {
  it('preserves line breaks in the message text', () => {
    const message = 'First line\n\nSecond line\n- Item';

    const { container } = render(<UserMessageBubble text={message} />);

    const paragraph = container.querySelector('p');
    expect(paragraph?.textContent).toBe(message);
    expect(paragraph?.className).toContain('whitespace-pre-wrap');
    expect(paragraph?.className).toContain('text-start');
    expect(paragraph?.className).toContain('[overflow-wrap:anywhere]');
  });

  it('renders an attachment tray when attachments are provided', () => {
    render(<UserMessageBubble text="Hello" attachments={[ATTACHMENT]} />);
    // AttachmentGroup renders a list role
    expect(screen.getByRole('list')).toBeTruthy();
  });

  it('renders no attachment tray when attachments prop is absent', () => {
    render(<UserMessageBubble text="Hello" />);
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('renders no attachment tray when attachments array is empty', () => {
    render(<UserMessageBubble text="Hello" attachments={[]} />);
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('renders the tray before the message text in the DOM', () => {
    const { container } = render(
      <UserMessageBubble text="Hello" attachments={[ATTACHMENT]} />,
    );
    const inner = container.querySelector(
      '.flex.w-fit.flex-col',
    ) as HTMLElement;
    const children = Array.from(inner?.children ?? []);
    const trayIndex = children.findIndex(
      (el) => el.getAttribute('role') === 'group',
    );
    const textIndex = children.findIndex(
      (el) =>
        el.tagName === 'DIV' &&
        el.getAttribute('role') !== 'group' &&
        el.className.includes('rounded'),
    );
    // tray should come before the bubble
    expect(trayIndex).toBeLessThan(textIndex);
  });

  it('remove button does not trigger a callback (read-only tray)', () => {
    render(<UserMessageBubble text="Hello" attachments={[ATTACHMENT]} />);
    expect(screen.queryByRole('button', { name: /remove/i })).toBeNull();
  });

  it('tray cards are inert when onAttachmentClick is absent', () => {
    render(<UserMessageBubble text="Hello" attachments={[ATTACHMENT]} />);
    expect(
      screen.queryByRole('button', { name: 'Open attachment' }),
    ).toBeNull();
  });

  it('clicking a card invokes onAttachmentClick with the attachment', () => {
    const onAttachmentClick = vi.fn();
    render(
      <UserMessageBubble
        text="Hello"
        attachments={[ATTACHMENT]}
        onAttachmentClick={onAttachmentClick}
        labels={{ attachmentClickLabel: 'Download file' }}
      />,
    );
    fireEvent.click(screen.getByLabelText('Download file'));
    expect(onAttachmentClick).toHaveBeenCalledWith(ATTACHMENT);
  });

  it('forwards attachmentClickLabel to the tray', () => {
    render(
      <UserMessageBubble
        text="Hello"
        attachments={[ATTACHMENT]}
        onAttachmentClick={vi.fn()}
        labels={{ attachmentClickLabel: 'Download file' }}
      />,
    );
    expect(screen.getByLabelText('Download file')).toBeTruthy();
  });

  it('forwards attachmentTheme so file tiles use the markdown surface, not white, in light mode', () => {
    const { container } = render(
      <UserMessageBubble
        text="Hello"
        attachments={[ATTACHMENT]}
        attachmentTheme={CodeBlockTheme.Light}
      />,
    );
    expect(container.querySelector('[class*="tileLight"]')).toBeTruthy();
  });
});

describe('UserMessageBubble — collapsed text', () => {
  const longMessage = 'Line 1\nLine 2\nLine 3';

  it('collapses long user messages by default', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
      function getScrollHeight(this: HTMLElement) {
        return this.tagName === 'P' ? 72 : 0;
      },
    );

    render(<UserMessageBubble text={longMessage} collapsedLineCount={2} />);

    const button = await screen.findByRole('button', { name: 'Show more' });
    const textWrapper = getMessageTextWrapper(longMessage);

    expect(button).toBeTruthy();
    expect(textWrapper.style.maxHeight).toBe('');
  });

  it('expands and collapses a long user message', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
      function getScrollHeight(this: HTMLElement) {
        return this.tagName === 'P' ? 72 : 0;
      },
    );

    render(<UserMessageBubble text={longMessage} collapsedLineCount={2} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Show more' }));

    const textWrapper = getMessageTextWrapper(longMessage);

    expect(screen.getByRole('button', { name: 'Show less' })).toBeTruthy();
    expect(textWrapper.style.maxHeight).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Show less' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Show more' })).toBeTruthy();
    });
    expect(textWrapper.style.maxHeight).toBe('');
  });

  it('does not show the toggle button for short user messages', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
      function getScrollHeight(this: HTMLElement) {
        return this.tagName === 'P' ? 24 : 0;
      },
    );

    render(<UserMessageBubble text="Short" collapsedLineCount={2} />);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    });
  });

  it('uses custom labels and aria labels for the toggle button', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
      function getScrollHeight(this: HTMLElement) {
        return this.tagName === 'P' ? 72 : 0;
      },
    );

    render(
      <UserMessageBubble
        text={longMessage}
        collapsedLineCount={2}
        labels={{
          showMoreLabel: 'More',
          showLessLabel: 'Less',
          showMoreAriaLabel: 'Expand user message',
          showLessAriaLabel: 'Collapse user message',
        }}
      />,
    );

    const expandButton = await screen.findByRole('button', {
      name: 'Expand user message',
    });

    expect(expandButton.textContent).toContain('More');

    fireEvent.click(expandButton);

    const collapseButton = screen.getByRole('button', {
      name: 'Collapse user message',
    });
    expect(collapseButton.textContent).toContain('Less');
  });
});

describe('AssistantMessageBubble — attachments', () => {
  it('allows long unbroken markdown text to wrap inside the bubble', () => {
    const longToken = `integrity sha512-${'f2'.repeat(120)}`;

    const { container } = render(<AssistantMessageBubble text={longToken} />);

    const paragraph = screen.getByText(longToken);
    expect(paragraph.className).toContain('[overflow-wrap:anywhere]');
    expect(paragraph.className).toContain('break-words');
    expect(paragraph.className).toContain('dial-body-paragraph-text');
    expect(paragraph.className).toContain('mb-3');
    expect(paragraph.className).toContain('[text-wrap:pretty]');
    expect(container.querySelector('.min-w-0.max-w-full')).not.toBeNull();
  });

  it('allows long unbroken code block lines to scroll horizontally inside the bubble', () => {
    const longToken = `integrity sha512-${'f2'.repeat(120)}`;

    const { container } = render(
      <AssistantMessageBubble text={`\`\`\`\n${longToken}\n\`\`\``} />,
    );

    const scrollContainer = container.querySelector('[dir="ltr"]');
    const code = container.querySelector('pre code');
    expect(scrollContainer?.className).toContain('overflow-auto');
    expect(code?.className).toContain('whitespace-pre');
  });

  it('reveals appended streaming text gradually', () => {
    vi.useFakeTimers();

    const { queryByText, rerender } = render(
      <AssistantMessageBubble text="Hi" isStreaming />,
    );

    rerender(<AssistantMessageBubble text="Hi there" isStreaming />);

    expect(queryByText('Hi there')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('Hi there')).toBeTruthy();
  });

  it('renders remaining text immediately after streaming stops', () => {
    vi.useFakeTimers();

    const { rerender } = render(
      <AssistantMessageBubble text="Hi" isStreaming />,
    );

    rerender(<AssistantMessageBubble text="Hi there" isStreaming />);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender(<AssistantMessageBubble text="Hi there friend" />);

    expect(screen.getByText('Hi there friend')).toBeTruthy();
  });

  it('does not reveal structural markdown blocks character by character', () => {
    vi.useFakeTimers();
    const tableText = 'Intro\n\n| A | B |\n| - | - |\n| 1 | 2 |';

    const { rerender } = render(
      <AssistantMessageBubble text="Intro" isStreaming />,
    );

    rerender(<AssistantMessageBubble text={tableText} isStreaming />);

    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('renders an attachment tray when attachments are provided', () => {
    render(
      <AssistantMessageBubble
        text="Here is your file"
        attachments={[ATTACHMENT]}
      />,
    );
    expect(screen.getByRole('list')).toBeTruthy();
  });

  it('renders no attachment tray when attachments prop is absent', () => {
    render(<AssistantMessageBubble text="Hello" />);
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('renders no attachment tray when attachments array is empty', () => {
    render(<AssistantMessageBubble text="Hello" attachments={[]} />);
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('renders the tray after the message text in the DOM', () => {
    const { container } = render(
      <AssistantMessageBubble
        text="Here is your file"
        attachments={[ATTACHMENT]}
      />,
    );
    const inner = container.querySelector(
      '.flex.w-full.flex-col.gap-4',
    ) as HTMLElement;
    const children = Array.from(inner?.children ?? []);
    const textIndex = children.findIndex((el) =>
      el.className.includes('min-w-0'),
    );
    const trayIndex = children.findIndex(
      (el) => el.getAttribute('role') === 'group',
    );
    // text comes before the tray
    expect(textIndex).toBeLessThan(trayIndex);
  });

  it('remove button does not trigger a callback (read-only tray)', () => {
    render(
      <AssistantMessageBubble
        text="Here is your file"
        attachments={[ATTACHMENT]}
      />,
    );
    expect(screen.queryByRole('button', { name: /remove/i })).toBeNull();
  });

  it('forwards attachmentTheme so file tiles use the markdown surface, not white, in light mode', () => {
    const { container } = render(
      <AssistantMessageBubble
        text="Here is your file"
        attachments={[ATTACHMENT]}
        attachmentTheme={CodeBlockTheme.Light}
      />,
    );
    expect(container.querySelector('[class*="tileLight"]')).toBeTruthy();
  });
});

describe('AssistantMessageBubble — deployment icon', () => {
  it('renders an img when deploymentIconUrl is provided', () => {
    const { container } = render(
      <AssistantMessageBubble
        text="Hello"
        deploymentIconUrl="https://example.com/icon.png"
        deploymentDisplayName="GPT-4"
      />,
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://example.com/icon.png');
  });

  it('renders no icon header when neither deploymentIconUrl nor deploymentDisplayName is provided', () => {
    const { container } = render(<AssistantMessageBubble text="Hello" />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByText(/GPT/)).toBeNull();
  });
});

describe('StatusMessageBubble', () => {
  it('renders bodyText', () => {
    render(
      <StatusMessageBubble bodyText="The model has been switched from A to B." />,
    );
    expect(
      screen.getByText('The model has been switched from A to B.'),
    ).toBeTruthy();
  });

  it('renders default titleText when titleText prop is omitted', () => {
    render(<StatusMessageBubble bodyText="Changed." />);
    expect(screen.getByText('Model switched.')).toBeTruthy();
  });

  it('renders custom titleText when provided', () => {
    render(
      <StatusMessageBubble titleText="Agent updated." bodyText="Changed." />,
    );
    expect(screen.getByText('Agent updated.')).toBeTruthy();
  });

  it('renders an svg icon (IconInfoCircleFilled)', () => {
    const { container } = render(<StatusMessageBubble bodyText="Changed." />);
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
