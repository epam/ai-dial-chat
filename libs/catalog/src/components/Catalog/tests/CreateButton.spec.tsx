import { DropdownItem, DropdownItemType } from '@epam/ai-dial-ui-kit';
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

const SECTIONED_OPTIONS: DropdownItem[] = [
  { key: 'prompt', label: 'Prompt' },
  { key: 'create-sections-divider', type: DropdownItemType.Divider },
  {
    key: 'runners-header',
    type: DropdownItemType.PlainText,
    label: 'Runners',
  },
  { key: 'runner:ocr', label: 'OCR' },
];

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

  it('renders a section divider and a header that is not an option in the searchable menu', async () => {
    render(
      <CreateButton
        label="Create"
        options={SECTIONED_OPTIONS}
        search={{ value: 'r', onChange: vi.fn() }}
        searchPlaceholder="Find a runner"
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByRole('separator')).toBeTruthy();
    expect(screen.getByText('Runners')).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Runners' })).toBeNull();
    expect(
      screen.getAllByRole('menuitem').map((item) => item.textContent),
    ).toEqual(['Prompt', 'OCR']);
    // Only "Prompt" and "OCR" are highlighted — the header is not.
    expect(screen.getAllByText(/^r$/i, { selector: 'mark' })).toHaveLength(2);
  });

  it('renders a section divider and header in the menu without search', async () => {
    render(<CreateButton label="Create" options={SECTIONED_OPTIONS} />);

    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByRole('separator')).toBeTruthy();
    expect(screen.getByText('Runners')).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Runners' })).toBeNull();
    expect(
      screen.getAllByRole('menuitem').map((item) => item.textContent),
    ).toEqual(['Prompt', 'OCR']);
  });
});
