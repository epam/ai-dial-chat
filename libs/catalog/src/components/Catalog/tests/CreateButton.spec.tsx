import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CreateButton } from '../CreateButton';

const SearchableCreateButton = ({
  onChange,
}: {
  onChange: (value: string) => void;
}) => {
  const [value, setValue] = useState('');
  const options = [
    { key: 'runner:mind-map', label: 'Mind map' },
    { key: 'runner:ocr', label: 'OCR' },
  ].filter((option) =>
    option.label.toLowerCase().includes(value.toLowerCase()),
  );
  return (
    <CreateButton
      label="Create"
      options={options}
      search={{
        value,
        onChange: (next) => {
          setValue(next);
          onChange(next);
        },
      }}
      searchPlaceholder="Find a runner"
      noResultsLabel="Nothing matches"
    />
  );
};

describe('CreateButton', () => {
  it('renders a search field above the options and reports each edit', async () => {
    const onChange = vi.fn();
    render(<SearchableCreateButton onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    await userEvent.type(await screen.findByLabelText('Find a runner'), 'oc');

    expect(onChange).toHaveBeenLastCalledWith('oc');
    expect(
      screen.getAllByRole('menuitem').map((item) => item.textContent),
    ).toEqual(['OCR']);
  });

  it('highlights the part of each option label that matches the query', async () => {
    render(<SearchableCreateButton onChange={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    await userEvent.type(await screen.findByLabelText('Find a runner'), 'oc');

    expect(screen.getByText('OC', { selector: 'mark' })).toBeTruthy();
  });

  it('announces the no-results label when the search leaves no options', async () => {
    render(<SearchableCreateButton onChange={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    await userEvent.type(await screen.findByLabelText('Find a runner'), 'zzz');

    expect(screen.getByRole('status').textContent).toBe('Nothing matches');
  });

  it('clears the search query when the menu closes', async () => {
    const onChange = vi.fn();
    render(<SearchableCreateButton onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    await userEvent.type(await screen.findByLabelText('Find a runner'), 'o');
    await userEvent.keyboard('{Escape}');

    expect(onChange).toHaveBeenLastCalledWith('');
  });
});
