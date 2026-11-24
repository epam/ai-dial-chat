import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetAfterLoadIdleForTests } from '../../../utils/load-idle';
import SigninInterruptGate from '../SigninInterruptGate';

const channel = vi.hoisted(() => ({ pendingEvents: [] as { id: string }[] }));

vi.mock('../../../context/ClientChannelContext', () => ({
  useClientChannel: () => channel,
}));
vi.mock('../../SigninInterruptDialog/SigninInterruptDialog', () => ({
  default: () => <div role="dialog" aria-label="Sign in required" />,
}));

describe('SigninInterruptGate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAfterLoadIdleForTests();
    channel.pendingEvents = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not mount the dialog while the page is loading and no sign-in is pending', () => {
    render(<SigninInterruptGate />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('mounts the dialog once the page has loaded', async () => {
    render(<SigninInterruptGate />);

    await act(async () => {
      vi.runAllTimers();
    });
    vi.useRealTimers();

    expect(
      await screen.findByRole('dialog', { name: 'Sign in required' }),
    ).toBeTruthy();
  });

  it('mounts the dialog straight away when a sign-in is pending before then', async () => {
    channel.pendingEvents = [{ id: 'event-1' }];
    vi.useRealTimers();

    render(<SigninInterruptGate />);

    expect(
      await screen.findByRole('dialog', { name: 'Sign in required' }),
    ).toBeTruthy();
  });

  it('keeps the dialog mounted after the last event resolves', async () => {
    channel.pendingEvents = [{ id: 'event-1' }];
    vi.useRealTimers();
    const { rerender } = render(<SigninInterruptGate />);
    await screen.findByRole('dialog', { name: 'Sign in required' });

    channel.pendingEvents = [];
    rerender(<SigninInterruptGate />);

    expect(
      screen.getByRole('dialog', { name: 'Sign in required' }),
    ).toBeTruthy();
  });
});
