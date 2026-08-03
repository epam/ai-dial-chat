import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EventLog from '../EventLog';

describe('EventLog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens the inspector, closes it with Escape, and restores trigger focus', async () => {
    const user = userEvent.setup();
    render(<EventLog entries={['12:00 ready']} onClear={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: /Event log 1 events/i });
    const panelId = trigger.getAttribute('aria-controls');
    const panel = document.getElementById(panelId ?? '');

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(panel?.hasAttribute('inert')).toBe(true);

    await user.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(panel?.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Close' }),
    );

    await user.keyboard('{Escape}');

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('copies and clears populated entries', async () => {
    const user = userEvent.setup();
    const handleClear = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <EventLog
        entries={['12:00 ready', '12:01 sendMessage']}
        onClear={handleClear}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /Event log 2 events/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Copy all' }));

    expect(writeText).toHaveBeenCalledWith('12:00 ready\n12:01 sendMessage');
    expect(screen.getByRole('status').textContent).toBe('Event log copied');

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(handleClear).toHaveBeenCalledOnce();
    expect(screen.getByRole('status').textContent).toBe('Event log cleared');
  });
});
