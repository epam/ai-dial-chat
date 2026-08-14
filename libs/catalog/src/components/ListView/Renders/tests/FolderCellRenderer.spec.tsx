import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import type { ICellRendererParams } from 'ag-grid-community';
import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../../../../models/catalog-item';
import type { GridContext } from '../../../../models/grid-context';
import { FolderCellRenderer } from '../FolderCellRenderer';

const makeItem = (overrides: Partial<CatalogItem> = {}): CatalogItem => ({
  id: '1',
  type: CatalogEntityType.Model,
  name: 'Claude',
  version: '1.0',
  description: 'desc',
  topics: [],
  folder: [],
  lastUsed: '',
  ...overrides,
});

const makeParams = (
  data: CatalogItem | undefined,
): ICellRendererParams<CatalogItem, unknown, GridContext> =>
  ({
    data,
    context: { typography: {} },
  }) as ICellRendererParams<CatalogItem, unknown, GridContext>;

describe('FolderCellRenderer', () => {
  it('renders nothing when there is no row data', () => {
    const { container } = render(
      <FolderCellRenderer {...makeParams(undefined)} />,
    );
    // Component renders null; no semantic query can assert total absence of output.
    // eslint-disable-next-line testing-library/no-node-access
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the item has no folder', () => {
    const { container } = render(
      <FolderCellRenderer {...makeParams(makeItem({ folder: [] }))} />,
    );
    // Component renders null; no semantic query can assert total absence of output.
    // eslint-disable-next-line testing-library/no-node-access
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('—')).toBeNull();
  });

  it('renders the folder path when the item belongs to a folder', () => {
    render(
      <FolderCellRenderer
        {...makeParams(makeItem({ folder: ['Team', 'Shared'] }))}
      />,
    );
    expect(screen.getByText('Shared')).toBeTruthy();
    expect(screen.queryByText('—')).toBeNull();
  });
});
