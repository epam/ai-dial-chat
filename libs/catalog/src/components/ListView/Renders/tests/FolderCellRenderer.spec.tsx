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

  it('shows the deepest folder, not the squeezed full path', () => {
    render(
      <FolderCellRenderer
        {...makeParams(
          makeItem({ folder: ['Organization', 'public', 'prompts'] }),
        )}
      />,
    );
    expect(screen.getByText('prompts')).toBeTruthy();
    expect(screen.queryByText('Organization')).toBeNull();
    expect(screen.queryByText('—')).toBeNull();
  });

  it('keeps the whole path reachable for assistive tech', () => {
    render(
      <FolderCellRenderer
        {...makeParams(
          makeItem({ folder: ['Organization', 'public', 'prompts'] }),
        )}
      />,
    );
    expect(screen.getByText('Organization / public / prompts')).toBeTruthy();
  });

  it('does not repeat a single-segment path', () => {
    render(
      <FolderCellRenderer {...makeParams(makeItem({ folder: ['Shared'] }))} />,
    );
    expect(screen.getAllByText('Shared')).toHaveLength(1);
  });
});
