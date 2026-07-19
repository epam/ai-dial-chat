import { render, screen } from '@testing-library/react';
import type { ICellRendererParams } from 'ag-grid-community';
import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../../../../models/catalog-item';
import { CatalogEntityType } from '../../../../types/entity-type';
import { TagsCellRenderer } from '../TagsCellRenderer';

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
): ICellRendererParams<CatalogItem> =>
  ({ data }) as ICellRendererParams<CatalogItem>;

describe('TagsCellRenderer', () => {
  it('renders nothing when there is no row data', () => {
    const { container } = render(
      <TagsCellRenderer {...makeParams(undefined)} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the item has no topics', () => {
    const { container } = render(
      <TagsCellRenderer {...makeParams(makeItem({ topics: [] }))} />,
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('—')).toBeNull();
  });

  it('renders topic tags when the item has topics', () => {
    render(
      <TagsCellRenderer
        {...makeParams(makeItem({ topics: ['Vision', 'Azure'] }))}
      />,
    );
    expect(screen.getByText('Vision')).toBeTruthy();
    expect(screen.getByText('Azure')).toBeTruthy();
    expect(screen.queryByText('—')).toBeNull();
  });
});
