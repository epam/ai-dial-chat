import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../models/catalog-item';
import type { ListViewProps } from '../../../models/list-props';
import { CatalogLoadStatus } from '../../../types/load-status';
import { ListView } from '../../ListView/ListView';
import {
  CatalogPickerModal,
  type CatalogPickerModalProps,
} from '../CatalogPickerModal';

// The default list as a plain one: ListView's own behaviour has its own spec.
vi.mock('../../ListView/ListView', () => ({
  ListView: vi.fn(({ items, query, ariaLabel, onItemClick }: ListViewProps) => (
    <ul aria-label={`${ariaLabel} for "${query}"`}>
      {items.map((item) => (
        <li key={item.id}>
          <button type="button" onClick={() => onItemClick?.(item)}>
            {item.name}
          </button>
        </li>
      ))}
    </ul>
  )),
}));

const makeItem = (id: string, name: string): CatalogItem => ({
  id,
  type: CatalogEntityType.Model,
  name,
  version: '',
  lastUsed: '',
  description: '',
  topics: [],
  folder: [],
});

const ITEMS = [makeItem('a', 'Alpha'), makeItem('b', 'Beta')];

const renderPicker = (
  props: Partial<
    Omit<CatalogPickerModalProps, 'listProps' | 'renderList'>
  > = {},
) => {
  const handlers = {
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    renderList: vi.fn((rows: CatalogItem[], query: string) => (
      <ul aria-label={`Rows for "${query}"`}>
        {rows.map((row) => (
          <li key={row.id}>{row.name}</li>
        ))}
      </ul>
    )),
  };
  render(
    <CatalogPickerModal
      items={ITEMS}
      labels={{ title: 'Change model', catalog: 'Models catalog' }}
      status={CatalogLoadStatus.Ready}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
};

/*
 * The kit's Popup moves focus to the dialog on a deferred tick after mount;
 * typing before that lands the click on the input and the keys on the dialog.
 */
const typeSearch = async (text: string) => {
  await waitFor(() =>
    expect(screen.getByRole('dialog').matches(':focus')).toBe(true),
  );
  await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), text);
};

describe('CatalogPickerModal', () => {
  it('renders the items through renderList, with the search query', async () => {
    renderPicker();

    await typeSearch('be');

    const list = screen.getByRole('list', { name: 'Rows for "be"' });
    expect(list.textContent).toBe('Beta');
  });

  it('confirms with Add and cancels with Cancel', async () => {
    const { onConfirm, onClose } = renderPicker();

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps Add disabled while the items load, with a spinner in place of the list', () => {
    const { renderList } = renderPicker({ status: CatalogLoadStatus.Loading });

    expect(
      (screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByLabelText('Loading')).toBeTruthy();
    expect(renderList).not.toHaveBeenCalled();
  });

  it('keeps Add disabled when isConfirmDisabled is set', () => {
    renderPicker({ isConfirmDisabled: true });

    expect(
      (screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('shows a failure with its reason, and Retry only when onRetry is given', async () => {
    const onRetry = vi.fn();
    renderPicker({
      status: CatalogLoadStatus.Error,
      error: 'Network down',
      onRetry,
    });

    expect(screen.getByText('Failed to load')).toBeTruthy();
    expect(screen.getByText('Network down')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('offers no Retry without onRetry', () => {
    renderPicker({ status: CatalogLoadStatus.Error });

    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('tells an empty catalog from a search that matched nothing', async () => {
    renderPicker({
      items: [],
      labels: { title: 'T', catalog: 'C', empty: 'No models' },
    });
    expect(screen.getByText('No models')).toBeTruthy();
  });

  it('says no results when the search leaves nothing', async () => {
    renderPicker();

    await typeSearch('zz');

    expect(screen.getByText('No results found')).toBeTruthy();
  });

  it('lists the searched items in a ListView of its own when given listProps', async () => {
    const onItemClick = vi.fn();
    render(
      <CatalogPickerModal
        items={ITEMS}
        labels={{ title: 'Change model', catalog: 'Models catalog' }}
        status={CatalogLoadStatus.Ready}
        listProps={{
          type: CatalogEntityType.Model,
          selectedItemId: 'b',
          onItemClick,
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await typeSearch('be');

    const list = screen.getByRole('list', { name: 'Models catalog for "be"' });
    expect(list.textContent).toBe('Beta');
    expect(vi.mocked(ListView).mock.lastCall?.[0]).toMatchObject({
      type: CatalogEntityType.Model,
      selectedItemId: 'b',
      stickyHeaderTop: 0,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Beta' }));
    expect(onItemClick).toHaveBeenCalledWith(ITEMS[1]);
  });

  it("lets listProps name the list instead of the catalog's heading", () => {
    render(
      <CatalogPickerModal
        items={ITEMS}
        labels={{ title: 'Change model', catalog: 'Models catalog' }}
        status={CatalogLoadStatus.Ready}
        listProps={{ type: CatalogEntityType.Model, ariaLabel: 'Models' }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('list', { name: 'Models for ""' })).toBeTruthy();
  });

  it('puts footerStart beside its own Cancel and Add', async () => {
    const { onConfirm } = renderPicker({
      footerStart: <span>Effort: high</span>,
    });

    expect(screen.getByText('Effort: high')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
