import type { Message as MessageType } from '@epam/ai-dial-chat-shared';
import { MessageRole } from '@epam/ai-dial-chat-shared';
import { act, fireEvent, render } from '@testing-library/react';
import {
  createRef,
  forwardRef,
  useImperativeHandle,
  type RefObject,
} from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConversationScroll } from '../useConversationScroll';

const scrollToMock = vi.fn();
const CONTAINER_HEIGHT = 400;

const makeMessages = (count: number): MessageType[] =>
  Array.from({ length: count }, (_, index) => ({
    role: index % 2 === 0 ? MessageRole.User : MessageRole.Assistant,
    content: `message ${index}`,
  })) as MessageType[];

const assignRef = (
  ref: RefObject<HTMLDivElement | null>,
  el: HTMLDivElement | null,
) => {
  (ref as { current: HTMLDivElement | null }).current = el;
};

const makeRect = (top: number, bottom: number): DOMRect =>
  ({
    top,
    bottom,
    left: 0,
    right: 100,
    width: 100,
    height: bottom - top,
    x: 0,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

const setRect = (el: HTMLDivElement, rect: Pick<DOMRect, 'top' | 'bottom'>) => {
  el.getBoundingClientRect = vi.fn(() => makeRect(rect.top, rect.bottom));
};

const setScrolledRect = (
  el: HTMLDivElement,
  container: HTMLDivElement,
  rect: Pick<DOMRect, 'top' | 'bottom'>,
) => {
  el.getBoundingClientRect = vi.fn(() =>
    makeRect(rect.top - container.scrollTop, rect.bottom - container.scrollTop),
  );
};

const configureContainer = (el: HTMLDivElement) => {
  const scrollTop = el.scrollTop;
  Object.defineProperty(el, 'clientHeight', {
    configurable: true,
    value: CONTAINER_HEIGHT,
  });
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    writable: true,
    value: scrollTop,
  });
  Object.defineProperty(el, 'scrollTo', {
    configurable: true,
    value: (options: ScrollToOptions) => {
      el.scrollTop = options.top ?? el.scrollTop;
      scrollToMock(options);
    },
  });
  setRect(el, { top: 0, bottom: CONTAINER_HEIGHT });
};

const configureContent = (
  el: HTMLDivElement,
  container: HTMLDivElement,
  contentHeight: number,
) => {
  setScrolledRect(el, container, { top: 0, bottom: contentHeight });
};

interface ScrollHarnessHandle {
  armAnchor: (index: number) => void;
}

interface ScrollHarnessProps {
  messages: MessageType[];
  conversationId: string;
  contentHeight?: number;
  isAssistantTyping?: boolean;
}

const ScrollHarness = forwardRef<ScrollHarnessHandle, ScrollHarnessProps>(
  (
    {
      messages,
      conversationId,
      contentHeight = 1_200,
      isAssistantTyping = false,
    },
    ref,
  ) => {
    const { containerRef, contentRef, spacerRef, setMessageRef, armAnchor } =
      useConversationScroll({
        messages,
        isAssistantTyping,
        conversationId,
      });

    useImperativeHandle(ref, () => ({
      armAnchor,
    }));

    return (
      <div
        ref={(el) => {
          if (el) configureContainer(el);
          assignRef(containerRef, el);
        }}
      >
        <div
          ref={(el) => {
            /*
             * `containerRef.current` is not guaranteed to be set yet here
             * (React commits child refs before parent refs), so this walks
             * the live DOM tree the harness itself just built rather than
             * querying rendered output — there is no Testing Library query
             * for "the parent node of the element whose ref just fired".
             */
            // eslint-disable-next-line testing-library/no-node-access
            const container = el?.parentElement as HTMLDivElement | null;
            if (el && container) configureContent(el, container, contentHeight);
            assignRef(contentRef, el);
          }}
        >
          {messages.map((_, index) => (
            <div
              key={index}
              ref={(el) => {
                /* eslint-disable testing-library/no-node-access */
                const container = el?.parentElement
                  ?.parentElement as HTMLDivElement | null;
                /* eslint-enable testing-library/no-node-access */
                if (el && container)
                  setScrolledRect(el, container, {
                    top: index * 100,
                    bottom: index * 100 + 50,
                  });
                setMessageRef(index, el);
              }}
            />
          ))}
        </div>
        <div ref={(el) => assignRef(spacerRef, el)} />
      </div>
    );
  },
);

ScrollHarness.displayName = 'ScrollHarness';

/*
 * The scroll container and spacer are plain unlabeled `<div>`s with no
 * accessible role or text (they exist purely for layout/scroll mechanics),
 * so there is no semantic query to reach them — structural traversal from
 * the render `container` is the only option for this CSS/layout-level test.
 */
const getScrollContainer = (container: HTMLElement) =>
  // eslint-disable-next-line testing-library/no-node-access
  container.firstElementChild as HTMLDivElement;

const getSpacer = (container: HTMLElement) =>
  // eslint-disable-next-line testing-library/no-node-access
  getScrollContainer(container).lastElementChild as HTMLDivElement;

const renderStreamingReply = (contentHeight = 650) => {
  const harnessRef = createRef<ScrollHarnessHandle>();
  const initialMessages = makeMessages(4);
  const replyMessages = makeMessages(6);
  const view = render(
    <ScrollHarness
      ref={harnessRef}
      conversationId="conversation-a"
      messages={initialMessages}
      contentHeight={600}
    />,
  );

  scrollToMock.mockClear();

  act(() => {
    harnessRef.current?.armAnchor(4);
  });

  view.rerender(
    <ScrollHarness
      ref={harnessRef}
      conversationId="conversation-a"
      messages={replyMessages}
      contentHeight={contentHeight}
      isAssistantTyping
    />,
  );

  return {
    ...view,
    harnessRef,
    replyMessages,
    scrollContainer: getScrollContainer(view.container),
    spacer: getSpacer(view.container),
  };
};

const renderCompletedShortReply = () => {
  const { harnessRef, replyMessages, ...result } = renderStreamingReply();

  scrollToMock.mockClear();

  result.rerender(
    <ScrollHarness
      ref={harnessRef}
      conversationId="conversation-a"
      messages={replyMessages}
      contentHeight={650}
      isAssistantTyping={false}
    />,
  );

  return {
    ...result,
    scrollContainer: getScrollContainer(result.container),
    spacer: getSpacer(result.container),
  };
};

describe('useConversationScroll', () => {
  beforeEach(() => {
    scrollToMock.mockClear();
  });

  it('scrolls a loaded conversation history to the bottom on mount', () => {
    render(
      <ScrollHarness
        conversationId="conversation-a"
        messages={makeMessages(6)}
      />,
    );

    expect(scrollToMock).toHaveBeenCalledWith({
      top: 800,
      behavior: 'smooth',
    });
  });

  it('scrolls a newly selected conversation to the bottom when the message count stays the same', () => {
    const messages = makeMessages(6);
    const { rerender } = render(
      <ScrollHarness conversationId="conversation-a" messages={messages} />,
    );
    scrollToMock.mockClear();

    rerender(
      <ScrollHarness conversationId="conversation-b" messages={messages} />,
    );

    expect(scrollToMock).toHaveBeenCalledWith({
      top: 800,
      behavior: 'smooth',
    });
  });

  it('scrolls a selected conversation to the bottom after streaming stops when the switch happened during streaming', () => {
    const messages = makeMessages(6);
    const { rerender } = render(
      <ScrollHarness conversationId="conversation-a" messages={messages} />,
    );
    scrollToMock.mockClear();

    rerender(
      <ScrollHarness
        conversationId="conversation-b"
        isAssistantTyping
        messages={messages}
      />,
    );

    expect(scrollToMock).not.toHaveBeenCalled();

    rerender(
      <ScrollHarness
        conversationId="conversation-b"
        isAssistantTyping={false}
        messages={messages}
      />,
    );

    expect(scrollToMock).toHaveBeenCalledWith({
      top: 800,
      behavior: 'smooth',
    });
  });

  it('keeps reserved spacer after streaming stops while the reply is above the viewport bottom', () => {
    const { scrollContainer, spacer } = renderCompletedShortReply();

    expect(spacer.style.height).toBe('150px');
    expect(scrollContainer.scrollTop).toBe(400);
    expect(scrollToMock).not.toHaveBeenCalled();
  });

  it('clamps manual downward scrolling before the active reserved spacer is exposed', () => {
    const { scrollContainer, spacer } = renderStreamingReply();
    expect(spacer.style.height).toBe('150px');

    scrollContainer.scrollTop = 500;
    fireEvent.scroll(scrollContainer);

    expect(scrollContainer.scrollTop).toBe(400);
  });

  it('allows scrolling to streamed content but not past its real bottom', () => {
    const { rerender, harnessRef, replyMessages, scrollContainer } =
      renderStreamingReply();

    rerender(
      <ScrollHarness
        ref={harnessRef}
        conversationId="conversation-a"
        messages={replyMessages}
        contentHeight={1_000}
        isAssistantTyping
      />,
    );

    scrollContainer.scrollTop = 650;
    fireEvent.scroll(scrollContainer);

    expect(scrollContainer.scrollTop).toBe(600);

    scrollContainer.scrollTop = 550;
    fireEvent.scroll(scrollContainer);

    expect(scrollContainer.scrollTop).toBe(550);
  });

  it('clears completed reserved spacer when the user scrolls to the real content bottom', () => {
    const { scrollContainer, spacer } = renderCompletedShortReply();
    scrollToMock.mockClear();

    scrollContainer.scrollTop = 250;
    fireEvent.scroll(scrollContainer);

    expect(spacer.style.height).toBe('0px');
    expect(scrollContainer.scrollTop).toBe(250);
    expect(scrollToMock).not.toHaveBeenCalled();
  });
});
