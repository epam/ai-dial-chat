import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SortMenuButton } from '../SortMenuButton';

const OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name', label: 'Name A-Z' },
];

describe('SortMenuButton', () => {
  beforeEach(() => {
    /* The kit dropdown and tooltip observe their anchor; jsdom has no IntersectionObserver. */
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('names the trigger by the static label and shows no option text', () => {
    render(
      <SortMenuButton
        options={OPTIONS}
        value="newest"
        onChange={vi.fn()}
        label="Sort"
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Sort' });
    expect(trigger.textContent).toBe('');
    expect(screen.queryByText('Newest')).toBeNull();
  });

  it('checks the applied option when the menu opens', async () => {
    render(
      <SortMenuButton options={OPTIONS} value="oldest" onChange={vi.fn()} />,
    );

    const trigger = screen.getByRole('button', { name: 'Sort' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(
      screen
        .getByRole('menuitemradio', { name: 'Oldest' })
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      screen
        .getByRole('menuitemradio', { name: 'Newest' })
        .getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('reports the picked option and returns focus to the trigger', async () => {
    const onChange = vi.fn();
    render(
      <SortMenuButton options={OPTIONS} value="newest" onChange={onChange} />,
    );

    const trigger = screen.getByRole('button', { name: 'Sort' });
    await userEvent.click(trigger);
    await userEvent.click(
      screen.getByRole('menuitemradio', { name: 'Name A-Z' }),
    );

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('name');
    await waitFor(() => expect(trigger.matches(':focus')).toBe(true));
  });

  it('checks nothing for an unknown value', async () => {
    render(
      <SortMenuButton options={OPTIONS} value="missing" onChange={vi.fn()} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Sort' }));

    for (const option of screen.getAllByRole('menuitemradio')) {
      expect(option.getAttribute('aria-checked')).toBe('false');
    }
  });

  it('renders nothing without options', () => {
    render(<SortMenuButton options={[]} onChange={vi.fn()} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('applies the host glyph color as a custom property', () => {
    render(
      <SortMenuButton
        options={OPTIONS}
        onChange={vi.fn()}
        colors={{ icon: 'red' }}
      />,
    );

    expect(
      screen
        .getByRole('button', { name: 'Sort' })
        .style.getPropertyValue('--smb-icon'),
    ).toBe('red');
  });

  it('does not mirror the symmetric glyph under RTL', () => {
    document.documentElement.dir = 'rtl';
    try {
      render(<SortMenuButton options={OPTIONS} onChange={vi.fn()} />);

      /* CSS-level check: the glyph's own classes are what would mirror it. */
      const trigger = screen.getByRole('button', { name: 'Sort' });
      // eslint-disable-next-line testing-library/no-node-access
      const glyph = trigger.querySelector('svg');
      expect(glyph?.getAttribute('class') ?? '').not.toMatch(
        /rtl:|scale-x|rotate/,
      );
    } finally {
      document.documentElement.dir = '';
    }
  });
});
