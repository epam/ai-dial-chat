# @epam/ai-dial-chat-hooks

Framework-level React hooks extracted from AI DIAL Chat, published so teams building custom chat interfaces on top of the AI DIAL backend can reuse proven chat-UI behavior without depending on the full AI DIAL Chat application.

## Overview

`@epam/ai-dial-chat-hooks` is a headless hooks library: every hook here solves a piece of chat-interface UI mechanics (scrolling, streaming, anchoring — more hooks will be added over time) using only React and standard browser APIs. It never depends on AI DIAL Chat's Redux-equivalent contexts, REST client, UI-kit components, i18n, or routing — `react` is the library's only dependency. This means a consumer can drop a hook from this package into a completely different chat UI, wire its returned refs and callbacks onto their own markup, and get the same tuned, edge-case-tested behavior AI DIAL Chat ships with, without adopting anything else from this repository.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-chat-hooks": "*"
  }
}
```

## Peer Dependencies

- `react` ^19.2.6

## Hooks

### useConversationScroll

Owns chat message-list autoscroll: anchors a newly sent or regenerated turn near the top of the viewport, holds scroll position steady while a response streams in (using a temporary, imperatively-sized spacer element — not user-visible content), shows a "scroll to bottom" affordance once the user scrolls away from the latest content, and returns to the bottom on request.

The hook is generic over the message type: it only ever reads `messages.length` to detect growth or a conversation switch, so it works with any array of message-like objects.

```tsx
import { useConversationScroll } from '@epam/ai-dial-chat-hooks';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const ChatMessageList = ({
  messages,
  isAssistantTyping,
  conversationId,
}: {
  messages: Message[];
  isAssistantTyping: boolean;
  conversationId: string;
}) => {
  const {
    containerRef,
    contentRef,
    spacerRef,
    setMessageRef,
    isScrollButtonVisible,
    scrollToBottom,
    armAnchor,
  } = useConversationScroll({ messages, isAssistantTyping, conversationId });

  // Call `armAnchor(messages.length - 1)` right before sending/regenerating
  // so the resulting message anchors near the top of the viewport.

  return (
    <div ref={containerRef} className="overflow-y-auto">
      <div ref={contentRef}>
        {messages.map((message, index) => (
          <div key={index} ref={(el) => setMessageRef(index, el)}>
            {message.content}
          </div>
        ))}
      </div>
      {/* Technical scroll room, not user-visible content — must render with an
          initial height of 0; the hook sets its height imperatively. */}
      <div ref={spacerRef} style={{ height: 0 }} className="shrink-0" />
      {isScrollButtonVisible && (
        <button onClick={scrollToBottom}>Scroll to bottom</button>
      )}
    </div>
  );
};
```

#### API

**Parameters** (`UseConversationScrollParams<T>`):

| Name                | Type      | Description                                                       |
| ------------------- | --------- | ----------------------------------------------------------------- |
| `messages`          | `T[]`     | Messages currently rendered in the list (only `.length` is read). |
| `isAssistantTyping` | `boolean` | Whether an assistant response is currently streaming in.          |
| `conversationId`    | `string`  | Identifier of the conversation being displayed.                   |

**Returns** (`UseConversationScrollResult`):

| Name                    | Type                                                  | Description                                                                                      |
| ----------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `containerRef`          | `RefObject<HTMLDivElement \| null>`                   | Attach to the scrollable message-list element.                                                   |
| `contentRef`            | `RefObject<HTMLDivElement \| null>`                   | Attach to the element wrapping all rendered messages.                                            |
| `spacerRef`             | `RefObject<HTMLDivElement \| null>`                   | Attach to a spacer sibling rendered right after `contentRef`; render with `height: 0` initially. |
| `setMessageRef`         | `(index: number, el: HTMLDivElement \| null) => void` | Callback ref to register/unregister a rendered message's DOM node by index.                      |
| `isScrollButtonVisible` | `boolean`                                             | Whether the scroll-to-bottom button should be shown.                                             |
| `scrollToBottom`        | `() => void`                                          | Smoothly scrolls to the current bottom of the message content.                                   |
| `armAnchor`             | `(index: number) => void`                             | Arms the message at `index` to scroll near the viewport top on the next render.                  |

`armAnchor` is opt-in — a consumer that never calls it gets plain bottom-follow behavior with no spacer reservation.

## Building

```sh
npm exec nx build ai-dial-chat-hooks
```

## Testing

```sh
npm exec nx test ai-dial-chat-hooks
```
