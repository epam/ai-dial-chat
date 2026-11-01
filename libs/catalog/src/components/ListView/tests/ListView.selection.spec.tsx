import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FC, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../models/catalog-item';
import { CatalogSelectionMode } from '../../../types/selection-mode';
import { ListView } from '../ListView';

/*
 * Renders the real ui-kit Grid (no mock): the selection column, its
 * checkboxes and the select-all are the kit's own, and `ListView` only merges
 * what the grid reports into the host's selection. The kit debounces that
 * report, so every expectation on it waits.
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
  onToggleFavorite?: (id: string, isStarred: boolean) => void;
}

const Harness: FC<HarnessProps> = ({
  items = ITEMS,
  initial = [],
  onChange,
  onItemClick,
  onToggleFavorite,
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
      onToggleFavorite={onToggleFavorite}
      selectRowAriaLabel={(item) => `Pick ${item.name}`}
      selectAllAriaLabel="Pick all"
    />
  );
};

const checkbox = (name: string) =>
  screen.getByRole('checkbox', { name }) as HTMLInputElement;
const findCheckbox = async (name: string) =>
  (await screen.findByRole('checkbox', { name })) as HTMLInputElement;
/* Cold Grid initialization can exceed the default 1 s wait on concurrent CI workers. */
const findCheckedCheckbox = (name: string) =>
  screen.findByRole('checkbox', { name, checked: true }, { timeout: 3000 });
const findCellOf = async (name: string) => {
  await screen.findByText(name);
  const cell = screen
    .getAllByRole('gridcell')
    .find((gridCell) => gridCell.textContent?.includes(name));
  expect(cell).toBeDefined();
  return cell as HTMLElement;
};
/* Focuses the cell the way ag-grid's own focus service does on a click. */
const focusCell = async (cell: HTMLElement) => {
  await act(async () => {
    cell.focus();
  });
  // Focus is a document-level fact; no Testing Library query reports it.
  // eslint-disable-next-line testing-library/no-node-access
  expect(document.activeElement).toBe(cell);
};

describe('ListView', () => {
  afterEach(() => {
    document.documentElement.dir = '';
  });

  describe('ListView multiple selection', () => {
    it('renders a checkbox per row and a select-all header from the selected set', async () => {
      render(<Harness initial={['b']} />);

      await findCheckedCheckbox('Pick Beta');
      expect((await findCheckbox('Pick Alpha')).checked).toBe(false);
      expect(checkbox('Pick all').getAttribute('aria-checked')).toBe('mixed');
    });

    it('appends a newly checked row and keeps the existing order', async () => {
      const onChange = vi.fn();
      render(<Harness initial={['a', 'b']} onChange={onChange} />);
      await findCheckedCheckbox('Pick Beta');

      await userEvent.click(checkbox('Pick Gamma'));
      await waitFor(() =>
        expect(onChange).toHaveBeenLastCalledWith(['a', 'b', 'c']),
      );

      await userEvent.click(checkbox('Pick Alpha'));
      await waitFor(() =>
        expect(onChange).toHaveBeenLastCalledWith(['b', 'c']),
      );
      expect(onChange).toHaveBeenCalledTimes(2);
    });

    it('appends an earlier row checked after a later one', async () => {
      const onChange = vi.fn();
      render(<Harness initial={['c']} onChange={onChange} />);
      await findCheckedCheckbox('Pick Gamma');

      await userEvent.click(checkbox('Pick Alpha'));

      await waitFor(() =>
        expect(onChange).toHaveBeenLastCalledWith(['c', 'a']),
      );
    });

    it('toggles a row from a click on another cell and still reports the click', async () => {
      const onChange = vi.fn();
      const onItemClick = vi.fn();
      render(<Harness onChange={onChange} onItemClick={onItemClick} />);

      await userEvent.click(await screen.findByText('Beta'));

      await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(['b']));
      expect(onItemClick).toHaveBeenCalledWith(ITEMS[1]);
    });

    it('toggles a checked row exactly once when its checkbox is clicked', async () => {
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);

      await userEvent.click(await findCheckbox('Pick Alpha'));

      await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(['a']));
      expect(onChange).toHaveBeenCalledOnce();
    });

    it('leaves the selection alone when the favorite star is clicked', async () => {
      const onChange = vi.fn();
      const onToggleFavorite = vi.fn();
      render(
        <Harness onChange={onChange} onToggleFavorite={onToggleFavorite} />,
      );

      const [star] = await screen.findAllByRole('button', {
        name: /favorite/i,
      });
      await userEvent.click(star);

      expect(onToggleFavorite).toHaveBeenCalledOnce();
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(onChange).not.toHaveBeenCalled();
    });

    it('toggles a row with Space on one of its focused cells', async () => {
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);

      const cell = await findCellOf('Alpha');
      await focusCell(cell);
      fireEvent.keyDown(cell, { key: ' ', code: 'Space' });

      await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(['a']));
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
      await findCheckedCheckbox('Pick Alpha');

      await userEvent.click(checkbox('Pick all'));

      await waitFor(() =>
        expect(onChange).toHaveBeenLastCalledWith(['z', 'a', 'b']),
      );
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
      await findCheckedCheckbox('Pick all');

      await userEvent.click(checkbox('Pick all'));

      await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(['z']));
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

  describe('ListView single selection keyboard', () => {
    it.each(['Enter', ' '])(
      'picks a row with %j on one of its focused cells, as a click does',
      async (key) => {
        const onItemClick = vi.fn();
        render(
          <ListView
            type={CatalogEntityType.Skill}
            items={ITEMS}
            onItemClick={onItemClick}
          />,
        );

        const cell = await findCellOf('Beta');
        await focusCell(cell);
        fireEvent.keyDown(cell, { key });

        // ag-grid dispatches `cellKeyDown` asynchronously.
        await waitFor(() => expect(onItemClick).toHaveBeenCalledWith(ITEMS[1]));
      },
    );

    it('ignores other keys', async () => {
      const onItemClick = vi.fn();
      render(
        <ListView
          type={CatalogEntityType.Skill}
          items={ITEMS}
          onItemClick={onItemClick}
        />,
      );

      const cell = await findCellOf('Beta');
      await focusCell(cell);
      fireEvent.keyDown(cell, { key: 'a' });
      // Enter afterwards proves the asynchronous dispatch has run for both keys.
      fireEvent.keyDown(cell, { key: 'Enter' });

      await waitFor(() => expect(onItemClick).toHaveBeenCalledOnce());
    });
  });
});
