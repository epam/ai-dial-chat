import { MessageRole } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
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
    expect(container.querySelector(':scope > * > * > *')?.className).toContain(
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
    expect(container.querySelector(':scope > * > * > *')?.className).toContain(
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

  it('renders default user actions when no actions prop is given', () => {
    render(<MessageBubble text="msg" role={MessageRole.User} />);
    expect(screen.getByRole('button', { name: 'Edit message' })).toBeTruthy();
  });

  it('renders user actions from actions prop', () => {
    render(
      <MessageBubble
        text="msg"
        role={MessageRole.User}
        actions={{ role: MessageRole.User }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Edit message' })).toBeTruthy();
  });

  it('renders assistant actions from actions prop', () => {
    render(
      <MessageBubble
        text="msg"
        role={MessageRole.Assistant}
        actions={{ role: MessageRole.Assistant }}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Regenerate response' }),
    ).toBeTruthy();
  });

  it('makes actions always visible when alwaysVisible is true', () => {
    const { container } = render(
      <MessageBubble text="msg" role={MessageRole.User} alwaysVisibleActions />,
    );
    const actionsWrapper = container.querySelector('[class*="gap-1"]');
    expect(actionsWrapper?.className).not.toContain('opacity-0');
  });
});
