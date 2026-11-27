import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CATALOG_FOLDER_ROOTS } from '../../../constants/catalog-folders';
import type { CatalogItem } from '../../../models/catalog-item';
import {
  CatalogFolderRootKind,
  type CatalogFolderSelection,
} from '../../../types/catalog-folders';
import { buildCatalogFolderTree } from '../../../utils/catalog-folders';
import { FoldersButton } from '../FoldersButton';

const viewport = vi.hoisted(() => ({ phone: false }));
vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return { ...actual, useIsPhone: () => viewport.phone };
});

const tree = buildCatalogFolderTree(
  [
    {
      id: 'a',
      type: CatalogEntityType.Agent,
      name: 'a',
      version: '1',
      lastUsed: '',
      description: '',
      folder: ['Organization', 'Design Assets'],
      topics: [],
    } satisfies CatalogItem,
  ],
  DEFAULT_CATALOG_FOLDER_ROOTS,
);

const Host = ({
  onChange,
}: {
  onChange: (s: CatalogFolderSelection) => void;
}) => {
  const [selection, setSelection] = useState<CatalogFolderSelection>({
    path: [],
  });
  return (
    <>
      <button type="button">Outside</button>
      <FoldersButton
        tree={tree}
        selection={selection}
        onChange={(next) => {
          setSelection(next);
          onChange(next);
        }}
      />
    </>
  );
};

describe('FoldersButton', () => {
  beforeEach(() => {
    viewport.phone = false;
  });

  it('opens the tree in a popover from 768px', async () => {
    render(<Host onChange={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Folders' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');

    await userEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Folders' });
    expect(dialog).toBeTruthy();
    expect(screen.getByRole('tree', { name: 'Folders' })).toBeTruthy();
  });

  it('applies a pick, closes the popover and returns focus to the trigger', async () => {
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Folders' }));
    await userEvent.click(
      await screen.findByRole('treeitem', { name: 'Personal' }),
    );

    expect(onChange).toHaveBeenCalledWith({
      root: CatalogFolderRootKind.Personal,
      path: [],
    });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Folders' })).toBeNull(),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Folders' }).matches(':focus'),
      ).toBe(true),
    );
  });

  it('closes on Escape without changing the selection', async () => {
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Folders' }));
    await screen.findByRole('tree', { name: 'Folders' });

    await userEvent.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Folders' })).toBeNull(),
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('opens a bottom sheet from a round button on a phone', async () => {
    viewport.phone = true;
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: 'Folders' });
    expect(trigger.textContent).toBe('');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    await userEvent.click(trigger);
    expect(await screen.findByRole('dialog', { name: 'Folders' })).toBeTruthy();

    await userEvent.click(screen.getByRole('treeitem', { name: 'Personal' }));

    expect(onChange).toHaveBeenCalledWith({
      root: CatalogFolderRootKind.Personal,
      path: [],
    });
    await waitFor(() =>
      expect(screen.queryByRole('tree', { name: 'Folders' })).toBeNull(),
    );
  });
});
