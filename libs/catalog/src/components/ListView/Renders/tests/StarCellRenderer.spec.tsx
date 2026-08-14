import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ICellRendererParams } from 'ag-grid-community';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../../models/catalog-item';
import type { GridContext } from '../../../../models/grid-context';
import { StarCellRenderer } from '../StarCellRenderer';

const makeItem = (overrides: Partial<CatalogItem> = {}): CatalogItem => ({
  id: '1',
  type: CatalogEntityType.Model,
  name: 'Claude',
  version: '1.0',
  description: 'desc',
  topics: [],
  folder: [],
  lastUsed: '',
  isStarred: false,
  ...overrides,
});

const makeParams = (
  data: CatalogItem | undefined,
  context: Partial<GridContext> = {},
): ICellRendererParams<CatalogItem, unknown, GridContext> =>
  ({ data, context }) as ICellRendererParams<CatalogItem, unknown, GridContext>;

describe('StarCellRenderer', () => {
  it('renders nothing when there is no row data', () => {
    const { container } = render(
      <StarCellRenderer {...makeParams(undefined)} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the toggle for a prompt row like any other entity type', () => {
    render(
      <StarCellRenderer
        {...makeParams(makeItem({ type: CatalogEntityType.Prompt }))}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Toggle favorite' }),
    ).toBeTruthy();
  });

  it('renders an accessible, labelled toggle reflecting the starred state', () => {
    render(<StarCellRenderer {...makeParams(makeItem({ isStarred: true }))} />);
    expect(
      screen.getByRole('button', { name: 'Toggle favorite' }),
    ).toBeTruthy();
  });

  it('toggles the starred state on click and calls onToggleFavorite', async () => {
    const onToggleFavorite = vi.fn();
    render(
      <StarCellRenderer
        {...makeParams(makeItem({ id: 'abc', isStarred: false }), {
          onToggleFavorite,
        })}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Toggle favorite' }),
    );

    expect(onToggleFavorite).toHaveBeenCalledWith('abc', true);
  });

  it('does not bubble the click to a row click handler', async () => {
    const onToggleFavorite = vi.fn();
    const onRowClick = vi.fn();
    render(
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div onClick={onRowClick}>
        <StarCellRenderer
          {...makeParams(makeItem({ id: 'abc' }), { onToggleFavorite })}
        />
      </div>,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Toggle favorite' }),
    );

    expect(onToggleFavorite).toHaveBeenCalledOnce();
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('applies the hover-reveal low-opacity class only when not starred', async () => {
    const { container } = render(
      <StarCellRenderer {...makeParams(makeItem({ isStarred: false }))} />,
    );
    const button = container.querySelector('button');
    expect(button?.className).toContain('starToggleOff');

    await userEvent.click(button as HTMLButtonElement);

    expect(button?.className).not.toContain('starToggleOff');
  });

  it('resyncs the star to data.isStarred when it reverts after a failed toggle', async () => {
    const item = makeItem({ id: 'abc', isStarred: false });
    const { rerender } = render(<StarCellRenderer {...makeParams(item)} />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Toggle favorite' }),
    );
    expect(
      screen.getByRole('button', { name: 'Toggle favorite' }).className,
    ).not.toContain('starToggleOff');

    /*
     * Parent's favoriteIds optimistically flips to starred, then the update
     * request fails and it reverts.
     */
    rerender(
      <StarCellRenderer {...makeParams({ ...item, isStarred: true })} />,
    );
    rerender(
      <StarCellRenderer {...makeParams({ ...item, isStarred: false })} />,
    );

    expect(
      screen.getByRole('button', { name: 'Toggle favorite' }).className,
    ).toContain('starToggleOff');
  });

  it('right-aligns the star within the column', () => {
    const { container } = render(
      <StarCellRenderer {...makeParams(makeItem())} />,
    );
    expect(container.firstElementChild?.className).toContain('justify-end');
  });
});
