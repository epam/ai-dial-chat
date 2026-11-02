import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ScheduledTasksLoginBanner } from '../ScheduledTasksLoginBanner';

describe('ScheduledTasksLoginBanner', () => {
  it('renders the English defaults and starts a login', async () => {
    const onLogIn = vi.fn();
    render(<ScheduledTasksLoginBanner isVisible onLogIn={onLogIn} />);

    expect(screen.getByText('Log in required.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(onLogIn).toHaveBeenCalledOnce();
  });

  it('disables the button while logging in', () => {
    render(
      <ScheduledTasksLoginBanner isVisible isLoggingIn onLogIn={vi.fn()} />,
    );

    expect(
      (screen.getByRole('button', { name: 'Logging in…' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('offers a retry and announces the retry message', () => {
    render(
      <ScheduledTasksLoginBanner
        isVisible
        retryMessage="The popup was blocked."
        onLogIn={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(
      'The popup was blocked.',
    );
  });

  it('keeps the live region mounted while hidden', () => {
    render(
      <ScheduledTasksLoginBanner
        isVisible={false}
        liveAnnouncement="Logged in."
      />,
    );

    expect(screen.queryByText('Log in required.')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Logged in.');
  });

  it('hides the button when no login is possible', () => {
    render(<ScheduledTasksLoginBanner isVisible />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
