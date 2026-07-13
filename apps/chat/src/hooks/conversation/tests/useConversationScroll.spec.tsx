import type { Message as MessageType } from '@epam/ai-dial-chat-shared';
import { MessageRole } from '@epam/ai-dial-chat-shared';
import { render } from '@testing-library/react';
import type { RefObject } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConversationScroll } from '../useConversationScroll';

const scrollToMock = vi.fn();

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

const setRect = (el: HTMLDivElement, rect: Pick<DOMRect, 'top' | 'bottom'>) => {
  el.getBoundingClientRect = vi.fn(
    () =>
      ({
        top: rect.top,
        bottom: rect.bottom,
        left: 0,
        right: 100,
        width: 100,
        height: rect.bottom - rect.top,
        x: 0,
        y: rect.top,
        toJSON: () => ({}),
      }) as DOMRect,
  );
};

const configureContainer = (el: HTMLDivElement) => {
  Object.defineProperty(el, 'clientHeight', {
    configurable: true,
    value: 400,
  });
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    writable: true,
    value: 0,
  });
  Object.defineProperty(el, 'scrollTo', {
    configurable: true,
    value: scrollToMock,
  });
  setRect(el, { top: 0, bottom: 400 });
};

const configureContent = (el: HTMLDivElement) => {
  setRect(el, { top: 0, bottom: 1_200 });
};

const ScrollHarness = ({
  messages,
  conversationId,
  isAssistantTyping = false,
}: {
  messages: MessageType[];
  conversationId: string;
  isAssistantTyping?: boolean;
}) => {
  const { containerRef, contentRef, spacerRef, setMessageRef } =
    useConversationScroll({
      messages,
      isAssistantTyping,
      conversationId,
    });

  return (
    <div
      ref={(el) => {
        if (el) configureContainer(el);
        assignRef(containerRef, el);
      }}
    >
      <div
        ref={(el) => {
          if (el) configureContent(el);
          assignRef(contentRef, el);
        }}
      >
        {messages.map((_, index) => (
          <div
            key={index}
            ref={(el) => {
              if (el)
                setRect(el, { top: index * 100, bottom: index * 100 + 50 });
              setMessageRef(index, el);
            }}
          />
        ))}
      </div>
      <div ref={(el) => assignRef(spacerRef, el)} />
    </div>
  );
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
});
