import { MessageRole } from '@epam/ai-dial-chat-shared';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BubblePosition } from '../../types/bubble-position.js';
import { MessageBubble } from './MessageBubble.js';

describe('MessageBubble', () => {
  it('renders the provided text content', () => {
    const { getByText } = render(
      <MessageBubble text="Hello world" role={MessageRole.User} />,
    );
    expect(getByText('Hello world')).toBeTruthy();
  });

  it('applies rounded-tr-[24px] with BubblePosition.Bottom (default)', () => {
    const { container } = render(
      <MessageBubble text="msg" role={MessageRole.User} />,
    );
    expect(container.firstElementChild?.firstElementChild?.className).toContain(
      'rounded-tr-[24px]',
    );
  });

  it('applies rounded-br-[24px] with BubblePosition.Top', () => {
    const { container } = render(
      <MessageBubble
        text="msg"
        role={MessageRole.User}
        position={BubblePosition.Top}
      />,
    );
    expect(container.firstElementChild?.firstElementChild?.className).toContain(
      'rounded-br-[24px]',
    );
  });

  it('merges additional className onto the container', () => {
    const { container } = render(
      <MessageBubble
        text="msg"
        role={MessageRole.User}
        className="my-custom-class"
      />,
    );
    expect(container.firstElementChild?.className).toContain('my-custom-class');
  });

  it('does not apply user rounded classes for assistant messages', () => {
    const { container } = render(
      <MessageBubble text="msg" role={MessageRole.Assistant} />,
    );
    const bubbleClassName =
      container.firstElementChild?.firstElementChild?.className;

    expect(bubbleClassName).not.toContain('rounded-tr-[24px]');
    expect(bubbleClassName).not.toContain('rounded-br-[24px]');
  });
});
