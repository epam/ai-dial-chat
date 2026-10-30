import type { DropdownItem } from '@epam/ai-dial-ui-kit';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateMenuSheet } from '../CreateMenuSheet';

const onPrompt = vi.fn();
const onWrite = vi.fn();
const onClose = vi.fn();

const OPTIONS: DropdownItem[] = [
  { key: 'prompt', label: 'Prompt', onClick: onPrompt },
  {
    key: 'skill',
    label: 'Skill',
    children: [
      { key: 'skill-write', label: 'Write instructions', onClick: onWrite },
    ],
  },
];

/* Filters the options by the query, as a host does. */
const SearchableSheet = () => {
  const [value, setValue] = useState('');
  const options = OPTIONS.filter((option) =>
    String(option.label).toLowerCase().includes(value.toLowerCase()),
  );
  return (
    <CreateMenuSheet
      open
      onClose={onClose}
      title="Create"
      options={options}
      search={{ value, onChange: setValue }}
      searchPlaceholder="Find"
      searchClearLabel="Clear"
      noResultsLabel="Nothing matches"
      backLabel="Back"
      closeLabel="Close"
    />
  );
};

describe('CreateMenuSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders each option as a menu item', async () => {
    render(<SearchableSheet />);

    const sheet = await screen.findByRole('dialog', { name: 'Create' });
    expect(
      within(sheet)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Prompt', 'Skill']);
  });

  it('keeps the no-results status mounted and fills it when the search matches nothing', async () => {
    const user = userEvent.setup();
    render(<SearchableSheet />);

    const sheet = await screen.findByRole('dialog', { name: 'Create' });
    const status = within(sheet).getByRole('status');
    expect(status.textContent).toBe('');

    await user.type(within(sheet).getByLabelText('Find'), 'zzz');

    expect(within(sheet).getByRole('status')).toBe(status);
    expect(status.textContent).toBe('Nothing matches');
    expect(within(sheet).queryByRole('menu')).toBeNull();
  });

  it('runs the chosen option and closes the sheet', async () => {
    const user = userEvent.setup();
    render(<SearchableSheet />);

    await user.click(await screen.findByRole('menuitem', { name: 'Prompt' }));

    expect(onPrompt).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('drills into a nested option before running its child', async () => {
    const user = userEvent.setup();
    render(<SearchableSheet />);

    await user.click(await screen.findByRole('menuitem', { name: 'Skill' }));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(
      await screen.findByRole('menuitem', { name: 'Write instructions' }),
    );

    expect(onWrite).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
