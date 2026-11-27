import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Filter, FilterProps } from '../Filter';

const TOPICS = new Set(['Vision', 'Business', 'Coding']);

const renderFilter = (props: Partial<FilterProps> = {}) =>
  render(
    <div>
      <button type="button">Outside</button>
      <Filter
        checked={new Set()}
        onChange={vi.fn()}
        values={TOPICS}
        {...props}
      />
    </div>,
  );

/* Holds the selection like a host, so applied toggles render back. */
const ControlledFilter = ({
  onChange,
}: {
  onChange: (s: Set<string>) => void;
}) => {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  return (
    <Filter
      checked={checked}
      values={TOPICS}
      onChange={(next) => {
        setChecked(next);
        onChange(next);
      }}
    />
  );
};

const openFilter = async () => {
  await userEvent.click(
    screen.getByRole('button', { name: 'Filter by topic' }),
  );
  return screen.findByRole('dialog', { name: 'Topics' });
};

describe('Filter', () => {
  it('renders an icon-only trigger named "Filter by topic"', () => {
    renderFilter();
    const trigger = screen.getByRole('button', { name: 'Filter by topic' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.textContent).toBe('');
  });

  /* The dot is decorative (aria-hidden), so only its CSS-module class can find it. */
  it('shows the active dot only while a topic is applied', () => {
    const { container, rerender } = renderFilter();
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('[class*="activeDot"]')).toBeNull();
    rerender(
      <Filter
        checked={new Set(['Vision'])}
        onChange={vi.fn()}
        values={TOPICS}
      />,
    );
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('[class*="activeDot"]')).toBeTruthy();
  });

  it('lists the topics in sorted order and has no "My" row', async () => {
    renderFilter();
    await openFilter();
    const rows = screen.getAllByRole('menuitemcheckbox');
    expect(rows.map((r) => r.textContent)).toEqual([
      'Business',
      'Coding',
      'Vision',
    ]);
    expect(screen.queryByRole('menuitemcheckbox', { name: 'My' })).toBeNull();
  });

  it('applies a toggle at once and keeps the dropdown open', async () => {
    const onChange = vi.fn();
    render(<ControlledFilter onChange={onChange} />);
    await openFilter();
    await userEvent.click(
      screen.getByRole('menuitemcheckbox', { name: 'Business' }),
    );
    expect(onChange).toHaveBeenCalledWith(new Set(['Business']));
    expect(screen.getByRole('dialog', { name: 'Topics' })).toBeTruthy();
    expect(
      screen
        .getByRole('menuitemcheckbox', { name: 'Business' })
        .getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('has no Apply or Clear footer buttons', async () => {
    renderFilter();
    await openFilter();
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('disables "Clear all" while no topic is applied', async () => {
    renderFilter();
    await openFilter();
    expect(
      (screen.getByRole('button', { name: 'Clear all' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('clears every topic from the header and stays open', async () => {
    const onChange = vi.fn();
    renderFilter({ checked: new Set(['Vision', 'Coding']), onChange });
    await openFilter();
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(onChange).toHaveBeenCalledWith(new Set());
    expect(screen.getByRole('dialog', { name: 'Topics' })).toBeTruthy();
  });

  it('closes on a press outside without changing the selection', async () => {
    const onChange = vi.fn();
    renderFilter({ onChange });
    await openFilter();
    await userEvent.click(screen.getByRole('button', { name: 'Outside' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Topics' })).toBeNull(),
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    renderFilter();
    await openFilter();
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Topics' })).toBeNull(),
    );
    expect(
      screen.getByRole('button', { name: 'Filter by topic' }).matches(':focus'),
    ).toBe(true);
  });

  it('moves between rows with the arrow keys', async () => {
    renderFilter();
    await openFilter();
    const rows = screen.getAllByRole('menuitemcheckbox');
    await waitFor(() => expect(rows[0].matches(':focus')).toBe(true));
    await userEvent.keyboard('{ArrowDown}');
    expect(rows[1].matches(':focus')).toBe(true);
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(rows[2].matches(':focus')).toBe(true);
  });

  it('opens with ArrowDown on the trigger', async () => {
    renderFilter();
    screen.getByRole('button', { name: 'Filter by topic' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(await screen.findByRole('dialog', { name: 'Topics' })).toBeTruthy();
  });
});
