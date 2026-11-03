import { DropdownItem, DropdownItemType } from '@epam/ai-dial-ui-kit';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreateButton } from '../CreateButton';

const breakpoint = vi.hoisted(() => ({ isPhone: false }));
vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-shared')>()),
  useIsPhone: () => breakpoint.isPhone,
}));

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
  afterEach(() => {
    breakpoint.isPhone = false;
  });

  it('keeps an open searchable menu and query across phone and tablet presentations', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<SearchableCreateButton onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Find a runner' }),
      'oc',
    );
    breakpoint.isPhone = true;
    rerender(<SearchableCreateButton onChange={onChange} />);
    expect(screen.getByRole('dialog', { name: 'Create' })).toBeTruthy();
    expect(
      screen.getByRole<HTMLInputElement>('textbox', { name: 'Find a runner' })
        .value,
    ).toBe('oc');
    breakpoint.isPhone = false;
    rerender(<SearchableCreateButton onChange={onChange} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('menu', { name: 'Create' })).toBeTruthy();
    expect(
      screen.getByRole<HTMLInputElement>('textbox', { name: 'Find a runner' })
        .value,
    ).toBe('oc');
    expect(
      screen
        .getByRole('button', { name: 'Create' })
        .getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('exposes the popup state for a floating tablet trigger', async () => {
    const user = userEvent.setup();
    render(
      <CreateButton label="Create" isFloating options={SECTIONED_OPTIONS} />,
    );
    const trigger = screen.getByRole('button', { name: 'Create' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    await user.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('menu', { name: 'Create' })).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
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
