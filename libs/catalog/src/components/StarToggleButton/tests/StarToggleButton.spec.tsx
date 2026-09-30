import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StarToggleButton } from '../StarToggleButton';

describe('StarToggleButton', () => {
  it('reports aria-pressed="false" when the item is not starred', () => {
    render(<StarToggleButton isStarred={false} onClick={vi.fn()} />);
    expect(
      screen
        .getByRole('button', { name: 'Toggle favorite' })
        .getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('reports aria-pressed="true" when the item is starred', () => {
    render(<StarToggleButton isStarred onClick={vi.fn()} />);
    expect(
      screen
        .getByRole('button', { name: 'Toggle favorite', pressed: true })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('updates aria-pressed when the starred state changes', () => {
    const { rerender } = render(
      <StarToggleButton isStarred={false} onClick={vi.fn()} />,
    );
    rerender(<StarToggleButton isStarred onClick={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: 'Toggle favorite', pressed: true }),
    ).toBeTruthy();

    rerender(<StarToggleButton isStarred={false} onClick={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: 'Toggle favorite', pressed: false }),
    ).toBeTruthy();
  });

  it('uses the provided accessible label', () => {
    render(
      <StarToggleButton
        isStarred
        ariaLabel="Remove from favorites"
        onClick={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', {
        name: 'Remove from favorites',
        pressed: true,
      }),
    ).toBeTruthy();
  });

  it('calls onClick when pressed', async () => {
    const onClick = vi.fn();
    render(<StarToggleButton isStarred={false} onClick={onClick} />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Toggle favorite' }),
    );

    expect(onClick).toHaveBeenCalledOnce();
  });
});
