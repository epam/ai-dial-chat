import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import {
  AttachmentType,
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

const TABLE_MARKDOWN = '| A | B |\n| - | - |\n| 1 | 2 |';

const TABLE_ACTION_LABELS = {
  copyCsvLabel: 'Copy as CSV',
  copyTxtLabel: 'Copy as TXT',
  copyMarkdownLabel: 'Copy as Markdown',
  copiedLabel: 'Copied!',
  downloadCsvLabel: 'Download as CSV',
};

const ASSISTANT_TABLE_LABELS = {
  tableCopyCsvLabel: TABLE_ACTION_LABELS.copyCsvLabel,
  tableCopyTxtLabel: TABLE_ACTION_LABELS.copyTxtLabel,
  tableCopyMarkdownLabel: TABLE_ACTION_LABELS.copyMarkdownLabel,
  tableCopiedLabel: TABLE_ACTION_LABELS.copiedLabel,
  tableDownloadCsvLabel: TABLE_ACTION_LABELS.downloadCsvLabel,
};

const findMessageParagraph = (message: string) =>
  screen.getByText((_, element) => {
    return element?.tagName === 'P' && element.textContent === message;
  });

/*
 * The collapsible wrapper around the message paragraph carries no ARIA role
 * of its own (it is only referenced via aria-controls from the toggle
 * button), so reaching it to check its inline style requires walking up from
 * the paragraph — a CSS-level check with no semantic query available.
 */
const getMessageTextWrapper = (message: string) =>
  // eslint-disable-next-line testing-library/no-node-access -- see comment above
  findMessageParagraph(message).parentElement as HTMLElement;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('MessageBubble', () => {
  it('renders the provided text content', () => {
    render(<MessageBubble text="Hello world" role={MessageRole.User} />);
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it('applies rounded-se-md with BubblePosition.Bottom (default)', () => {
    const { container } = render(
      <MessageBubble text="msg" role={MessageRole.User} />,
    );
    /*
     * The bubble div carries the position-dependent rounded corner but has
     * no ARIA role of its own — a CSS-level check with no semantic query
     * available (see spec.md's container.querySelector exception).
     */
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- see comment above
    expect(container.querySelector(':scope > * > * > *')?.className).toContain(
      'rounded-se-md',
    );
  });

  it('applies rounded-ee-md with BubblePosition.Top', () => {
    const { container } = render(
      <MessageBubble
        text="msg"
        role={MessageRole.User}
        position={BubblePosition.Top}
      />,
    );
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- same structural CSS check as above, no ARIA anchor exists
    expect(container.querySelector(':scope > * > * > *')?.className).toContain(
      'rounded-ee-md',
    );
  });

  it('merges additional className onto the container', () => {
    render(
      <MessageBubble
        text="msg"
        role={MessageRole.User}
        styles={{ className: 'my-custom-class' }}
      />,
    );
    expect(
      screen.getByRole('group', { name: 'User message' }).className,
    ).toContain('my-custom-class');
  });

  it('does not apply user rounded classes for assistant messages', () => {
    render(<MessageBubble text="msg" role={MessageRole.Assistant} />);
    const { className } = screen.getByRole('group', {
      name: 'Assistant message',
    });
    expect(className).not.toContain('rounded-tr-[24px]');
    expect(className).not.toContain('rounded-br-[24px]');
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
    render(
      <MessageBubble
        text="msg"
        role={MessageRole.User}
        hasAlwaysVisibleActions
      />,
    );
    const actionsWrapper = screen.getByRole('toolbar', {
      name: 'Message actions',
    });
    expect(actionsWrapper.className).not.toContain('opacity-0');
  });
});

describe('UserMessageBubble — attachments', () => {
  it('preserves line breaks in the message text', () => {
    const message = 'First line\n\nSecond line\n- Item';

    render(<UserMessageBubble text={message} />);

    const paragraph = findMessageParagraph(message);
    expect(paragraph.textContent).toBe(message);
    expect(paragraph.className).toContain('whitespace-pre-wrap');
    expect(paragraph.className).toContain('text-start');
    expect(paragraph.className).toContain('[overflow-wrap:anywhere]');
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
    render(<UserMessageBubble text="Hello" attachments={[ATTACHMENT]} />);

    const root = screen.getByRole('group', { name: 'User message' });
    const trayIndex = root.textContent?.indexOf('report') ?? -1;
    const textIndex = root.textContent?.indexOf('Hello') ?? -1;

    expect(trayIndex).toBeGreaterThanOrEqual(0);
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

describe('UserMessageBubble — inline-start slot', () => {
  const skillSlot = <span>/Summarizer</span>;

  it('renders the slot inline inside the text paragraph, before the text', () => {
    render(<UserMessageBubble text="Hello world" beforeContent={skillSlot} />);

    const slot = screen.getByText('/Summarizer');
    /*
     * The slot's DOM position — inside the text paragraph, ahead of the text —
     * is the feature under test, and its wrapper span carries no ARIA hook, so
     * no semantic query reaches it (see spec.md's node-access exception).
     */
    // eslint-disable-next-line testing-library/no-node-access -- see comment above
    const paragraph = slot.closest('p') as HTMLParagraphElement;
    // eslint-disable-next-line testing-library/no-node-access -- see comment above
    const wrapper = slot.parentElement as HTMLElement;

    expect(paragraph).toBeTruthy();
    expect(wrapper.className).toContain('me-1');
    // eslint-disable-next-line testing-library/no-node-access -- see comment above
    expect(paragraph.firstChild).toBe(wrapper);
  });

  it('renders the bubble for the slot alone when there is no text', () => {
    const { container } = render(
      <UserMessageBubble beforeContent={skillSlot} />,
    );

    expect(screen.getByText('/Summarizer')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'User message' })).toBeTruthy();
    /* Slot-only: the slot stays in flow in a plain div, with no text paragraph. */
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- see comment above
    expect(container.querySelector('p')).toBeNull();
  });

  it('renders no slot wrapper inside the paragraph when beforeContent is absent', () => {
    render(<UserMessageBubble text="Hello world" />);

    const paragraph = findMessageParagraph('Hello world');
    /*
     * The absence of a slot wrapper — a plain span with no ARIA hook — inside
     * the paragraph cannot be queried semantically, so the check is DOM-level.
     */
    // eslint-disable-next-line testing-library/no-node-access -- see comment above
    expect(paragraph.firstElementChild).toBeNull();
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
    /*
     * The min-w-0/max-w-full wrapper around MDMessageViewer only carries
     * aria-live/aria-atomic (not a role), so there is no semantic query that
     * reaches it directly — a CSS-level check with no semantic alternative.
     */
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- see comment above
    expect(container.querySelector('.min-w-0.max-w-full')).not.toBeNull();
  });

  it('allows long unbroken code block lines to scroll horizontally inside the bubble', () => {
    const longToken = `integrity sha512-${'f2'.repeat(120)}`;

    const { container } = render(
      <AssistantMessageBubble text={`\`\`\`\n${longToken}\n\`\`\``} />,
    );

    /*
     * CodeBlock's scroll container and <pre><code> carry no ARIA role —
     * a CSS-level check with no semantic query available.
     */
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- see comment above
    const scrollContainer = container.querySelector('[dir="ltr"]');
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- see comment above
    const code = container.querySelector('pre code');
    expect(scrollContainer?.className).toContain('overflow-auto');
    expect(code?.className).toContain('whitespace-pre');
  });

  it('reveals appended streaming text gradually', () => {
    vi.useFakeTimers();

    const { rerender } = render(
      <AssistantMessageBubble text="Hi" isStreaming />,
    );

    rerender(<AssistantMessageBubble text="Hi there" isStreaming />);

    expect(screen.queryByText('Hi there')).toBeNull();

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

  it('forwards table action labels to completed assistant tables', () => {
    render(
      <AssistantMessageBubble
        text={TABLE_MARKDOWN}
        labels={ASSISTANT_TABLE_LABELS}
      />,
    );

    expect(screen.getByRole('button', { name: 'Copy as CSV' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy as TXT' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Copy as Markdown' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Download as CSV' }),
    ).toBeTruthy();
  });

  it('hides table actions while an assistant message is streaming', () => {
    render(
      <AssistantMessageBubble
        text={TABLE_MARKDOWN}
        isStreaming
        labels={ASSISTANT_TABLE_LABELS}
      />,
    );

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders assistant tables without actions when labels are absent', () => {
    render(<AssistantMessageBubble text={TABLE_MARKDOWN} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('forwards tableOnOpenInCanvas to the table, calling it with the serialized Markdown', async () => {
    /* The action button's Tooltip mounts via floating-ui, which requires
     * IntersectionObserver — absent by default in jsdom. */
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {
          // No-op in JSDOM.
        }
        unobserve() {
          // No-op in JSDOM.
        }
        disconnect() {
          // No-op in JSDOM.
        }
      },
    );
    const tableOnOpenInCanvas = vi.fn();

    render(
      <AssistantMessageBubble
        text={TABLE_MARKDOWN}
        labels={{
          ...ASSISTANT_TABLE_LABELS,
          tableOpenInCanvasLabel: 'Open in canvas',
        }}
        tableOnOpenInCanvas={tableOnOpenInCanvas}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open in canvas' }));

    expect(tableOnOpenInCanvas).toHaveBeenCalledWith(
      '| A | B |\n| :-- | :-- |\n| 1 | 2 |',
    );
    vi.unstubAllGlobals();
  });

  it('does not render Open in Canvas when tableOnOpenInCanvas is absent', () => {
    render(
      <AssistantMessageBubble
        text={TABLE_MARKDOWN}
        labels={{
          ...ASSISTANT_TABLE_LABELS,
          tableOpenInCanvasLabel: 'Open in canvas',
        }}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Open in canvas' })).toBeNull();
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
    render(
      <AssistantMessageBubble
        text="Here is your file"
        attachments={[ATTACHMENT]}
      />,
    );

    const root = screen.getByRole('group', { name: 'Assistant message' });
    const textIndex = root.textContent?.indexOf('Here is your file') ?? -1;
    const trayIndex = root.textContent?.indexOf('report') ?? -1;

    expect(textIndex).toBeGreaterThanOrEqual(0);
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
});

describe('AssistantMessageBubble — markdown URLs', () => {
  it('rewrites markdown image src through markdownUrlTransform', () => {
    render(
      <AssistantMessageBubble
        text="![chart](files/bucket/chart.png)"
        markdownUrlTransform={(url) =>
          url.startsWith('files/') ? `/dl/${url.slice('files/'.length)}` : url
        }
      />,
    );

    expect(screen.getByRole('img', { name: 'chart' }).getAttribute('src')).toBe(
      '/dl/bucket/chart.png',
    );
  });
});

describe('AssistantMessageBubble — deployment icon', () => {
  it('renders an img when deploymentIconUrl is provided', () => {
    render(
      <AssistantMessageBubble
        text="Hello"
        deploymentIconUrl="https://example.com/icon.png"
        deploymentDisplayName="GPT-4"
      />,
    );
    const img = screen.getByAltText('');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('https://example.com/icon.png');
  });

  it('renders no icon header when neither deploymentIconUrl nor deploymentDisplayName is provided', () => {
    render(<AssistantMessageBubble text="Hello" />);
    expect(screen.queryByAltText('')).toBeNull();
    expect(screen.queryByText(/GPT/)).toBeNull();
  });
});

describe('AssistantMessageBubble — inline-start slot', () => {
  const skillSlot = <span>/Summarizer</span>;

  /*
   * The text container carries only aria-live/aria-atomic (no role), so no
   * semantic query reaches it — a CSS-level check with no semantic alternative.
   */
  const getTextContainer = (container: HTMLElement) =>
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- see comment above
    container.querySelector('[aria-live="polite"]') as HTMLElement | null;

  it('overlays the slot at the inline start of the first markdown block without entering it', () => {
    /* The overlaid slot is measured by a ResizeObserver, absent in jsdom. */
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {
          // No-op in JSDOM.
        }
        unobserve() {
          // No-op in JSDOM.
        }
        disconnect() {
          // No-op in JSDOM.
        }
      },
    );

    const { container } = render(
      <AssistantMessageBubble text="Hello world" beforeContent={skillSlot} />,
    );

    const textContainer = getTextContainer(container) as HTMLElement;
    expect(textContainer).toBeTruthy();

    // eslint-disable-next-line testing-library/no-node-access -- see getTextContainer comment
    const slotWrapper = textContainer.firstElementChild as HTMLElement;
    expect(slotWrapper.className).toContain('absolute');
    expect(slotWrapper.className).toContain('start-0');
    expect(slotWrapper.className).toContain('top-0');

    // eslint-disable-next-line testing-library/no-node-access -- see getTextContainer comment
    const markdownWrapper = textContainer.querySelector(
      '.cm-bubble-markdown',
    ) as HTMLElement | null;
    expect(markdownWrapper).toBeTruthy();
    /*
     * The indent selector is scoped through the wrapper class precisely so the
     * host-supplied slot never sits inside the markdown container it indents.
     */
    expect(markdownWrapper?.contains(slotWrapper)).toBe(false);
    expect(textContainer.className).toContain(
      '[&>.cm-bubble-markdown>div>*:first-child]',
    );
    expect(textContainer.className).toContain(
      'indent-[var(--cm-bubble-first-line-indent,0px)]',
    );
  });

  it('renders the slot in flow above the streaming placeholder while no text has arrived', () => {
    render(
      <AssistantMessageBubble
        isStreaming
        beforeContent={skillSlot}
        labels={{ thinkingLabel: 'Thinking…' }}
      />,
    );

    const slot = screen.getByText('/Summarizer');
    /* The in-flow wrapper carries no ARIA hook — a CSS-level check. */
    // eslint-disable-next-line testing-library/no-node-access -- see comment above
    const wrapper = slot.parentElement as HTMLElement;
    expect(wrapper.className).not.toContain('absolute');

    const root = screen.getByRole('group', { name: 'Assistant message' });
    const slotIndex = root.textContent?.indexOf('/Summarizer') ?? -1;
    const placeholderIndex = root.textContent?.indexOf('Thinking…') ?? -1;
    expect(slotIndex).toBeGreaterThanOrEqual(0);
    expect(slotIndex).toBeLessThan(placeholderIndex);
  });

  it('renders the slot on its own line for a message with no text at all', () => {
    const { container } = render(
      <AssistantMessageBubble beforeContent={skillSlot} />,
    );

    expect(screen.getByText('/Summarizer')).toBeTruthy();
    expect(getTextContainer(container)).toBeNull();
  });

  it('renders no slot and no indent class when beforeContent is absent', () => {
    const { container } = render(<AssistantMessageBubble text="Hello world" />);

    const textContainer = getTextContainer(container) as HTMLElement;
    expect(textContainer).toBeTruthy();
    expect(screen.queryByText('/Summarizer')).toBeNull();
    expect(textContainer.className).not.toContain(
      'indent-[var(--cm-bubble-first-line-indent,0px)]',
    );
    // eslint-disable-next-line testing-library/no-node-access -- see getTextContainer comment
    expect(textContainer.firstElementChild?.className).toContain(
      'cm-bubble-markdown',
    );
  });
});

describe('StatusMessageBubble', () => {
  it('renders bodyText', () => {
    render(
      <StatusMessageBubble
        labels={{ bodyText: 'The model has been switched from A to B.' }}
      />,
    );
    expect(
      screen.getByText('The model has been switched from A to B.'),
    ).toBeTruthy();
  });

  it('renders default titleText when titleText prop is omitted', () => {
    render(<StatusMessageBubble labels={{ bodyText: 'Changed.' }} />);
    expect(screen.getByText('Model switched.')).toBeTruthy();
  });

  it('renders custom titleText when provided', () => {
    render(
      <StatusMessageBubble
        labels={{ titleText: 'Agent updated.', bodyText: 'Changed.' }}
      />,
    );
    expect(screen.getByText('Agent updated.')).toBeTruthy();
  });

  it('renders an svg icon (IconInfoCircleFilled)', () => {
    const { container } = render(
      <StatusMessageBubble labels={{ bodyText: 'Changed.' }} />,
    );
    /*
     * InfoMessageNotification (ui-kit) renders its icon as a bare
     * decorative svg with no accessible role or name to query by — a
     * DOM-presence check with no semantic query available.
     */
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- see comment above
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
