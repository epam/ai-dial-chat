import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationStartTimestamp } from '../ConversationStartTimestamp';

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(
    date,
  );

describe('ConversationStartTimestamp', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 19, 14, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a time element whose dateTime is the original timestamp', () => {
    const start = new Date(2026, 9, 19, 11, 51);
    render(
      <ConversationStartTimestamp
        timestamp={start.toISOString()}
        locale="en"
      />,
    );

    expect(screen.getByRole('time').getAttribute('datetime')).toBe(
      start.toISOString(),
    );
  });

  it('uses the default English Today and Yesterday templates', () => {
    const today = new Date(2026, 9, 19, 11, 51);
    const { rerender } = render(
      <ConversationStartTimestamp
        timestamp={today.toISOString()}
        locale="en"
      />,
    );
    expect(screen.getByRole('time').textContent).toBe(
      `Today ${formatTime(today)}`,
    );

    const yesterday = new Date(2026, 9, 18, 15, 24);
    rerender(
      <ConversationStartTimestamp
        timestamp={yesterday.toISOString()}
        locale="en"
      />,
    );
    expect(screen.getByRole('time').textContent).toBe(
      `Yesterday ${formatTime(yesterday)}`,
    );
  });

  it('uses the host-supplied label templates', () => {
    const today = new Date(2026, 9, 19, 11, 51);
    render(
      <ConversationStartTimestamp
        timestamp={today.toISOString()}
        locale="en"
        labels={{ today: (time) => `Aujourd'hui ${time}` }}
      />,
    );

    expect(screen.getByRole('time').textContent).toBe(
      `Aujourd'hui ${formatTime(today)}`,
    );
  });

  it('renders the absolute date and time for an older start', () => {
    render(
      <ConversationStartTimestamp
        timestamp={new Date(2026, 8, 20, 10, 15).toISOString()}
        locale="en"
      />,
    );

    expect(screen.getByRole('time').textContent?.replace(/\s/g, ' ')).toBe(
      'Sep 20, 2026, 10:15 AM',
    );
  });

  it('renders nothing for an unparsable or empty timestamp', () => {
    const { rerender } = render(
      <ConversationStartTimestamp timestamp="not-a-date" />,
    );
    expect(screen.queryByRole('time')).toBeNull();

    rerender(<ConversationStartTimestamp timestamp="" />);
    expect(screen.queryByRole('time')).toBeNull();
  });
});
