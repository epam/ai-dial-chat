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
    /* `hidden: true` keeps matching the panel while it is `inert` and thus removed from the default accessibility tree. */
    const panel = screen.getByRole('complementary', { hidden: true });

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(panel.hasAttribute('inert')).toBe(true);
    expect(panel.classList.contains('translate-y-full')).toBe(true);
    expect(panel.classList.contains('desktop:translate-x-full')).toBe(true);

    await user.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(panel.hasAttribute('inert')).toBe(false);
    expect(panel.classList.contains('translate-y-full')).toBe(false);
    expect(panel.classList.contains('desktop:translate-x-full')).toBe(false);
    expect(panel.classList.contains('translate-y-0')).toBe(true);
    expect(panel.classList.contains('desktop:translate-x-0')).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Close' }).matches(':focus'),
    ).toBe(true);

    await user.keyboard('{Escape}');

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(panel.classList.contains('translate-y-full')).toBe(true);
    expect(trigger.matches(':focus')).toBe(true);
  });

  it('renders the event count on an opaque contrasting badge', () => {
    render(<EventLog entries={['12:00 ready']} onClear={vi.fn()} />);

    const count = screen.getByLabelText('1 events');

    expect(count.classList.contains('bg-layer-raised')).toBe(true);
    expect(count.classList.contains('text-primary')).toBe(true);
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
