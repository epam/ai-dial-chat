import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FC, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../models/catalog-item';
import { CatalogSelectionMode } from '../../../types/selection-mode';
import { ListView } from '../ListView';

/*
 * Renders the real ui-kit Grid (no mock): the selection column's header and
 * cells read a React context, which only works because AG Grid React renders
 * them as portals inside its own tree. This spec guards that assumption.
 */

const makeItem = (id: string, name: string): CatalogItem => ({
  id,
  type: CatalogEntityType.Skill,
  name,
  version: '',
  lastUsed: '',
  description: '',
  topics: [],
  folder: [],
});

const ITEMS = [
  makeItem('a', 'Alpha'),
  makeItem('b', 'Beta'),
  makeItem('c', 'Gamma'),
];

interface HarnessProps {
  items?: CatalogItem[];
  initial?: string[];
  onChange?: (ids: string[]) => void;
  onItemClick?: (item: CatalogItem) => void;
}

const Harness: FC<HarnessProps> = ({
  items = ITEMS,
  initial = [],
  onChange,
  onItemClick,
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set(initial));
  return (
    <ListView
      type={CatalogEntityType.Skill}
      items={items}
      selectionMode={CatalogSelectionMode.Multiple}
      selectedItemIds={selected}
      onSelectionChange={(ids) => {
        onChange?.([...ids]);
        setSelected(ids);
      }}
      onItemClick={onItemClick}
      selectRowAriaLabel={(item) => `Pick ${item.name}`}
      selectAllAriaLabel="Pick all"
    />
  );
};

const checkbox = (name: string) =>
  screen.getByRole('checkbox', { name }) as HTMLInputElement;
const findCheckbox = async (name: string) =>
  (await screen.findByRole('checkbox', { name })) as HTMLInputElement;

afterEach(() => {
  document.documentElement.dir = '';
});

describe('ListView multiple selection', () => {
  it('renders a checkbox per row and a select-all header from the selected set', async () => {
    render(<Harness initial={['b']} />);

    expect((await findCheckbox('Pick Beta')).checked).toBe(true);
    expect(checkbox('Pick Alpha').checked).toBe(false);
    expect(checkbox('Pick all').getAttribute('aria-checked')).toBe('mixed');
  });

  it('appends a newly checked row and keeps the existing order', async () => {
    const onChange = vi.fn();
    render(<Harness initial={['a', 'b']} onChange={onChange} />);

    await userEvent.click(await findCheckbox('Pick Gamma'));
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b', 'c']);
    await waitFor(() => expect(checkbox('Pick Gamma').checked).toBe(true));

    await userEvent.click(checkbox('Pick Alpha'));
    expect(onChange).toHaveBeenLastCalledWith(['b', 'c']);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('toggles a row from a click on another cell and still reports the click', async () => {
    const onChange = vi.fn();
    const onItemClick = vi.fn();
    render(<Harness onChange={onChange} onItemClick={onItemClick} />);

    await userEvent.click(await screen.findByText('Beta'));

    expect(onChange).toHaveBeenLastCalledWith(['b']);
    expect(onItemClick).toHaveBeenCalledWith(ITEMS[1]);
  });

  it('toggles a row with Space on one of its cells', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await screen.findByText('Alpha');
    const cell = screen
      .getAllByRole('gridcell')
      .find((gridCell) => gridCell.textContent?.includes('Alpha'));
    expect(cell).toBeDefined();
    fireEvent.keyDown(cell as HTMLElement, { key: ' ' });

    expect(onChange).toHaveBeenLastCalledWith(['a']);
  });

  it('leaves Space on a checkbox to the checkbox itself', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.keyDown(await findCheckbox('Pick Alpha'), { key: ' ' });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('selects every listed row and keeps a hidden selection', async () => {
    const onChange = vi.fn();
    render(
      <Harness
        items={ITEMS.slice(0, 2)}
        initial={['z', 'a']}
        onChange={onChange}
      />,
    );

    await userEvent.click(await findCheckbox('Pick all'));

    expect(onChange).toHaveBeenLastCalledWith(['z', 'a', 'b']);
    await waitFor(() => expect(checkbox('Pick all').checked).toBe(true));
  });

  it('clears only the listed rows when all of them are selected', async () => {
    const onChange = vi.fn();
    render(
      <Harness
        items={ITEMS.slice(0, 2)}
        initial={['z', 'a', 'b']}
        onChange={onChange}
      />,
    );

    await userEvent.click(await findCheckbox('Pick all'));

    expect(onChange).toHaveBeenLastCalledWith(['z']);
  });

  it('puts the selection column before Name in a right-to-left document', async () => {
    document.documentElement.dir = 'rtl';
    render(<Harness />);

    const selectAll = await findCheckbox('Pick all');
    const nameHeader = screen.getByText('Name');

    expect(
      selectAll.compareDocumentPosition(nameHeader) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe('ListView single selection', () => {
  it('renders no checkboxes', async () => {
    render(
      <ListView
        type={CatalogEntityType.Skill}
        items={ITEMS}
        selectedItemId="a"
      />,
    );

    await screen.findByText('Alpha');
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
