import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type FC, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { useListRemoveFocus } from '../use-list-remove-focus';

const List: FC = () => {
  const [items, setItems] = useState(['a', 'b']);
  const ref = useListRemoveFocus<HTMLDivElement>(items.length);
  return (
    <div ref={ref}>
      <button type="button">Add</button>
      <ul>
        {items.map((item) => (
          <li key={item}>
            <button
              type="button"
              onClick={() => setItems((all) => all.filter((x) => x !== item))}
            >
              {`Remove ${item}`}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

describe('useListRemoveFocus', () => {
  it('focuses the list’s first button once an item is removed', async () => {
    render(<List />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove b' }));
    expect(
      screen.getByRole('button', { name: 'Remove a' }).matches(':focus'),
    ).toBe(true);
  });

  it('falls back to the container’s first button once the list is empty', async () => {
    render(<List />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove b' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove a' }));
    expect(screen.getByRole('button', { name: 'Add' }).matches(':focus')).toBe(
      true,
    );
  });
});
