import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScrollToTopButton } from '../ScrollToTopButton';

const renderButton = (onClick = vi.fn()) =>
  render(<ScrollToTopButton label="Scroll to top" onClick={onClick} />);

describe('ScrollToTopButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a button named by its label', () => {
    renderButton();

    expect(screen.getByRole('button', { name: 'Scroll to top' })).toBeTruthy();
  });

  it('hides its icon from assistive technology', () => {
    renderButton();

    // eslint-disable-next-line testing-library/no-node-access -- the icon has no role or text to query by
    const icon = screen.getByRole('button').querySelector('svg');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    renderButton(onClick);

    await userEvent.click(
      screen.getByRole('button', { name: 'Scroll to top' }),
    );

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('calls onClick when activated with Enter or Space', async () => {
    const onClick = vi.fn();
    renderButton(onClick);
    screen.getByRole('button', { name: 'Scroll to top' }).focus();

    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');

    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
