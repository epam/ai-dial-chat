/* eslint-disable @typescript-eslint/no-non-null-assertion */
/*
 * Guard tests for this package's public `dial-*` class contract — see the
 * "Public class names" section of openspec/lib-styling-guide.md.
 *
 * A styling hook sits on an unlabeled wrapper with no accessible role or text
 * of its own, so asserting one is inherently a DOM-level check and Testing
 * Library has no semantic equivalent of "is this class on that element's
 * ancestor". Every test still locates a real element by role, label or text
 * first and only then walks to the container under test, so a class landing on
 * the wrong node fails rather than passes. Hence the rule exemption below.
 */
/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CONVERSATION_MESSAGES_CLASS } from '../../../constants/public-class-names';
import { AssistantMessageBubble } from '../AssistantMessageBubble';
import { UserMessageBubble } from '../UserMessageBubble';

/*
 * The public classes are host styling hooks, so these tests never find an
 * element *by* the class — that would still pass with the class on the wrong
 * node. They locate by role or text first, then walk up to the container.
 */
const closestWithClass = (from: Element, className: string): Element | null =>
  from.closest(`.${className}`);

const findMessageParagraph = (message: string) =>
  screen.getByText((_, element) => {
    return element?.tagName === 'P' && element.textContent === message;
  });

describe('UserMessageBubble — public class names', () => {
  it('marks the bubble that wraps the message text', () => {
    render(<UserMessageBubble text="Hello" />);

    expect(
      closestWithClass(
        findMessageParagraph('Hello'),
        CONVERSATION_MESSAGES_CLASS.userBubble,
      ),
    ).toBeTruthy();
  });

  it('emits no bubble class when there is no text or before-content', () => {
    const { container } = render(<UserMessageBubble text="" />);

    expect(
      container.querySelectorAll(`.${CONVERSATION_MESSAGES_CLASS.userBubble}`),
    ).toHaveLength(0);
  });

  it('keeps a caller-supplied bubbleClassName alongside the public class', () => {
    render(
      <UserMessageBubble
        text="Hello"
        styles={{ bubbleClassName: 'host-bubble' }}
      />,
    );

    const bubble = closestWithClass(
      findMessageParagraph('Hello'),
      CONVERSATION_MESSAGES_CLASS.userBubble,
    );

    expect(bubble!.classList).toContain('host-bubble');
  });
});

describe('AssistantMessageBubble — public class names', () => {
  it('marks the live content region for a settled message', () => {
    render(<AssistantMessageBubble text="Answer" />);

    const region = closestWithClass(
      findMessageParagraph('Answer'),
      CONVERSATION_MESSAGES_CLASS.assistantContent,
    );

    expect(region).toBeTruthy();
    expect(region!.getAttribute('aria-live')).toBe('polite');
  });

  it('marks the live content region while streaming', () => {
    render(<AssistantMessageBubble text="Partial" isStreaming />);

    expect(
      closestWithClass(
        findMessageParagraph('Partial'),
        CONVERSATION_MESSAGES_CLASS.assistantContent,
      ),
    ).toBeTruthy();
  });
});
