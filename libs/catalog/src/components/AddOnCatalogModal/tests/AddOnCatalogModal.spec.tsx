import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../models/catalog-item';
import type { ListViewProps } from '../../../models/list-props';
import { CatalogLoadStatus } from '../../../types/load-status';
import {
  AddOnCatalogModal,
  type AddOnCatalogModalProps,
} from '../AddOnCatalogModal';

// The list as plain checkboxes: ListView's own multiple selection has its own spec.
vi.mock('../../ListView/ListView', () => ({
  ListView: ({
    items,
    selectedItemIds = new Set(),
    onSelectionChange,
    selectRowAriaLabel,
  }: ListViewProps) => (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <input
            type="checkbox"
            aria-label={selectRowAriaLabel?.(item)}
            checked={selectedItemIds.has(item.id)}
            onChange={() => {
              const next = new Set(selectedItemIds);
              if (next.has(item.id)) next.delete(item.id);
              else next.add(item.id);
              onSelectionChange?.(next);
            }}
          />
        </li>
      ))}
    </ul>
  ),
}));

const makeItem = (id: string, name: string): CatalogItem => ({
  id,
  type: CatalogEntityType.Toolset,
  name,
  version: '',
  lastUsed: '',
  description: '',
  topics: [],
  folder: [],
});

const renderPicker = (props: Partial<AddOnCatalogModalProps> = {}) => {
  const handlers = { onConfirm: vi.fn(), onClose: vi.fn() };
  render(
    <AddOnCatalogModal
      type={CatalogEntityType.Toolset}
      items={[makeItem('t1', 'Figma'), makeItem('t2', 'Jira')]}
      attachedIds={['agent', 't1']}
      labels={{ title: 'Add toolset', catalog: 'Toolsets catalog' }}
      status={CatalogLoadStatus.Ready}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
};

const checkbox = (name: string) =>
  screen.getByRole<HTMLInputElement>('checkbox', { name: `Select ${name}` });

describe('AddOnCatalogModal', () => {
  it('opens with the attached items checked', () => {
    renderPicker();
    expect(checkbox('Figma').checked).toBe(true);
    expect(checkbox('Jira').checked).toBe(false);
  });

  it('commits the checked set on Add, keeping ids it does not list', async () => {
    const { onConfirm } = renderPicker();
    await userEvent.click(checkbox('Figma'));
    await userEvent.click(checkbox('Jira'));
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onConfirm).toHaveBeenCalledWith(['agent', 't2']);
  });

  it('commits nothing on Cancel', async () => {
    const { onConfirm, onClose } = renderPicker();
    await userEvent.click(checkbox('Jira'));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('names the row checkboxes from labels.selectRow', () => {
    renderPicker({
      labels: {
        title: 'Add toolset',
        catalog: 'Toolsets catalog',
        selectRow: (name) => `Pick ${name}`,
      },
    });
    expect(screen.getByRole('checkbox', { name: 'Pick Jira' })).toBeTruthy();
  });

  it('builds the footer start from the checked set', async () => {
    renderPicker({
      renderFooterStart: (ids) => <p>{`${ids.size} checked`}</p>,
    });
    expect(screen.getByText('2 checked')).toBeTruthy();
    await userEvent.click(checkbox('Jira'));
    expect(screen.getByText('3 checked')).toBeTruthy();
  });
});
