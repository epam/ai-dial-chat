import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FullScreenAlert } from '../FullScreenAlert';

describe('FullScreenAlert', () => {
  const renderAlert = (onAction = vi.fn()) =>
    render(
      <FullScreenAlert
        icon={<svg aria-hidden="true" />}
        heading="Something went wrong"
        message="Try again in a moment."
        actionLabel="Try again"
        onAction={onAction}
      />,
    );

  it('renders a region named by the heading, not a live region', () => {
    renderAlert();

    expect(
      screen.getByRole('region', { name: 'Something went wrong' }),
    ).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders the heading as the screen h1', () => {
    renderAlert();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Something went wrong' }),
    ).toBeTruthy();
  });

  it('renders the message', () => {
    renderAlert();

    expect(screen.getByText('Try again in a moment.')).toBeTruthy();
  });

  it('focuses the action button on mount', () => {
    renderAlert();

    expect(
      screen.getByRole('button', { name: 'Try again' }).matches(':focus'),
    ).toBe(true);
  });

  it('calls onAction when the action button is clicked', async () => {
    const onAction = vi.fn();
    renderAlert(onAction);

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onAction).toHaveBeenCalledOnce();
  });
});
