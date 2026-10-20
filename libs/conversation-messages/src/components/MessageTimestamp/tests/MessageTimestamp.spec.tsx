import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageTimestamp } from '../MessageTimestamp';

const renderTimestamp = (timestamp: string, className?: string) =>
  render(
    <MessageTimestamp
      timestamp={timestamp}
      locale="en"
      className={className}
    />,
  );

describe('MessageTimestamp', () => {
  const sentAt = new Date(2026, 9, 19, 17, 25);

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 9, 19, 20, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a focusable time element whose dateTime is the message timestamp', () => {
    renderTimestamp(sentAt.toISOString());

    const time = screen.getByRole('time');
    expect(time.getAttribute('datetime')).toBe(sentAt.toISOString());
    expect(time.getAttribute('tabindex')).toBe('0');
  });

  it('shows how long ago the message was sent', () => {
    renderTimestamp(sentAt.toISOString());

    expect(screen.getByRole('time').textContent).toBe('3 hours ago');
  });

  it('refreshes the relative time every minute', () => {
    renderTimestamp(new Date(2026, 9, 19, 20, 29, 30).toISOString());
    expect(screen.getByRole('time').textContent).toBe('now');

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByRole('time').textContent).toBe('1 minute ago');
  });

  it('renders nothing for an unparsable or empty timestamp', () => {
    const { rerender } = renderTimestamp('not-a-date');
    expect(screen.queryByRole('time')).toBeNull();

    rerender(<MessageTimestamp timestamp="" />);
    expect(screen.queryByRole('time')).toBeNull();
  });

  it('applies the default typography and color classes, replaceable by className', () => {
    const { rerender } = renderTimestamp(sentAt.toISOString());
    expect(screen.getByRole('time').classList.contains('text-secondary')).toBe(
      true,
    );

    rerender(
      <MessageTimestamp
        timestamp={sentAt.toISOString()}
        className="dial-tiny-text text-primary"
      />,
    );
    const { classList } = screen.getByRole('time');
    expect(classList.contains('text-primary')).toBe(true);
    expect(classList.contains('text-secondary')).toBe(false);
  });

  it('is hidden by default and revealed by bubble hover, focus, or a no-hover device', () => {
    renderTimestamp(sentAt.toISOString());

    const { classList } = screen.getByRole('time');
    expect(classList.contains('opacity-0')).toBe(true);
    expect(classList.contains('group-hover/message:opacity-100')).toBe(true);
    expect(classList.contains('group-focus-within/message:opacity-100')).toBe(
      true,
    );
    expect(classList.contains('[@media(hover:none)]:opacity-100')).toBe(true);
  });
});
