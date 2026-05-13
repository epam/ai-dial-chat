import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BubblePosition } from '../../types/bubble-position.js';
import { MessageBubble } from './MessageBubble.js';

describe('MessageBubble', () => {
  it('renders the provided text content', () => {
    const { getByText } = render(<MessageBubble text="Hello world" />);
    expect(getByText('Hello world')).toBeTruthy();
  });

  it('applies rounded-tr-[24px] with BubblePosition.Bottom (default)', () => {
    const { container } = render(<MessageBubble text="msg" />);
    expect(container.firstElementChild?.className).toContain(
      'rounded-tr-[24px]',
    );
  });

  it('applies rounded-br-[24px] with BubblePosition.Top', () => {
    const { container } = render(
      <MessageBubble text="msg" position={BubblePosition.Top} />,
    );
    expect(container.firstElementChild?.className).toContain(
      'rounded-br-[24px]',
    );
  });

  it('merges additional className onto the container', () => {
    const { container } = render(
      <MessageBubble text="msg" className="my-custom-class" />,
    );
    expect(container.firstElementChild?.className).toContain('my-custom-class');
  });
});
