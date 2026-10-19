import { MessageRole } from '@epam/ai-dial-chat-shared';
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageBubble } from '../MessageBubble';

const SENT_AT = new Date(2026, 9, 19, 17, 25).toISOString();

describe('MessageBubble — send time', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 9, 19, 20, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('puts a user message send time before the action buttons', () => {
    render(
      <MessageBubble
        role={MessageRole.User}
        text="Hello"
        timestamp={SENT_AT}
        locale="en"
        actions={{ onCopy: vi.fn() }}
      />,
    );

    const toolbar = screen.getByRole('toolbar');
    expect(within(toolbar).getByRole('time').textContent).toBe('3 hours ago');
    expect(toolbar.textContent?.startsWith('3 hours ago')).toBe(true);
  });

  it('puts an assistant response send time after the action buttons', () => {
    render(
      <MessageBubble
        role={MessageRole.Assistant}
        text="Hi there"
        timestamp={SENT_AT}
        locale="en"
        actions={{ role: MessageRole.Assistant, onCopy: vi.fn() }}
      />,
    );

    const toolbar = screen.getByRole('toolbar');
    expect(within(toolbar).getByRole('time')).toBeTruthy();
    expect(toolbar.textContent?.endsWith('3 hours ago')).toBe(true);
  });

  it('keeps host leading content next to the send time', () => {
    render(
      <MessageBubble
        role={MessageRole.User}
        text="Hello"
        timestamp={SENT_AT}
        locale="en"
        actions={{ onCopy: vi.fn(), leadingContent: <span>host</span> }}
      />,
    );

    expect(
      screen.getByRole('toolbar').textContent?.startsWith('3 hours agohost'),
    ).toBe(true);
  });

  it('applies styles.timestampClassName to the send time', () => {
    render(
      <MessageBubble
        role={MessageRole.User}
        text="Hello"
        timestamp={SENT_AT}
        styles={{ timestampClassName: 'dial-tiny-text text-primary' }}
        actions={{ onCopy: vi.fn() }}
      />,
    );

    expect(screen.getByRole('time').classList.contains('text-primary')).toBe(
      true,
    );
  });

  it('renders no send time without a timestamp', () => {
    render(
      <MessageBubble
        role={MessageRole.User}
        text="Hello"
        actions={{ onCopy: vi.fn() }}
      />,
    );

    expect(screen.queryByRole('time')).toBeNull();
  });
});
