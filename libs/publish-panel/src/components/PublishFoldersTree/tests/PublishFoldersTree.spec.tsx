import { DialFile, DialFileNodeType } from '@epam/ai-dial-react-file-manager';
import { DropdownItem } from '@epam/ai-dial-ui-kit';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PublishFolderNode } from '../../../models/publish';
import { PublishFoldersTree } from '../PublishFoldersTree';

const capturedProps: {
  current: ComponentProps<
    typeof import('@epam/ai-dial-react-file-manager').DialFoldersTree
  > | null;
} = { current: null };

const renderFileRow = (
  file: DialFile,
  onItemClick?: (file: DialFile) => void,
) => (
  <div key={file.path}>
    <button onClick={() => onItemClick?.(file)}>{file.name}</button>
    {file.items?.map((child) => renderFileRow(child, onItemClick))}
  </div>
);

vi.mock('@epam/ai-dial-react-file-manager', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-react-file-manager')>();
  return {
    ...actual,
    DialFoldersTree: (props: ComponentProps<typeof actual.DialFoldersTree>) => {
      capturedProps.current = props;
      return (
        <div role="tree">
          {props.items.map((file) => renderFileRow(file, props.onItemClick))}
          {props.emptyStateDescription && <p>{props.emptyStateDescription}</p>}
        </div>
      );
    },
  };
});

const items: PublishFolderNode[] = [
  {
    path: ['Shared'],
    name: 'Shared',
    children: [{ path: ['Shared', 'Data Science'], name: 'Data Science' }],
  },
  { path: ['My workspace'], name: 'My workspace' },
];

const renderTree = (
  props?: Partial<ComponentProps<typeof PublishFoldersTree>>,
) =>
  render(
    <PublishFoldersTree
      items={items}
      searchQuery=""
      onSelectedPathChange={vi.fn()}
      onCreateFolder={vi.fn()}
      {...props}
    />,
  );

describe('PublishFoldersTree', () => {
  it('converts PublishFolderNode[] to DialFile[] with showFiles disabled, wrapped under the root node', () => {
    renderTree();
    expect(capturedProps.current?.showFiles).toBe(false);
    expect(capturedProps.current?.items.map((f) => f.path)).toEqual(['']);
    expect(capturedProps.current?.items[0]?.items?.map((f) => f.path)).toEqual([
      'My workspace',
      'Shared',
    ]);
  });

  it('orders folders by name at every level, regardless of the order given', () => {
    renderTree({
      items: [
        { path: ['zeta'], name: 'zeta' },
        {
          path: ['Alpha'],
          name: 'Alpha',
          children: [
            { path: ['Alpha', 'Report 10'], name: 'Report 10' },
            { path: ['Alpha', 'Report 2'], name: 'Report 2' },
          ],
        },
        { path: ['beta'], name: 'beta' },
      ],
    });
    const rootChildren = capturedProps.current?.items[0]?.items;
    expect(rootChildren?.map((file) => file.name)).toEqual([
      'Alpha',
      'beta',
      'zeta',
    ]);
    expect(rootChildren?.[0]?.items?.map((file) => file.name)).toEqual([
      'Report 2',
      'Report 10',
    ]);
  });

  it('passes the selected path joined as a string', () => {
    renderTree({ selectedPath: ['Shared', 'Data Science'] });
    expect(capturedProps.current?.selectedPath).toBe('Shared/Data Science');
  });

  it('selects a folder when clicked', async () => {
    const onSelectedPathChange = vi.fn();
    renderTree({ onSelectedPathChange });
    await userEvent.click(screen.getByText('Shared'));
    expect(onSelectedPathChange).toHaveBeenCalledWith(['Shared']);
  });

  it('deselects (undefined) when clicking the already-selected folder', async () => {
    const onSelectedPathChange = vi.fn();
    renderTree({ selectedPath: ['Shared'], onSelectedPathChange });
    await userEvent.click(screen.getByText('Shared'));
    expect(onSelectedPathChange).toHaveBeenCalledWith(undefined);
  });

  it('filters the tree to matching folders when searchQuery is set', () => {
    renderTree({ searchQuery: 'data science' });
    expect(capturedProps.current?.items.map((f) => f.path)).toEqual(['']);
    expect(capturedProps.current?.items[0]?.items?.map((f) => f.path)).toEqual([
      'Shared',
    ]);
    expect(
      capturedProps.current?.items[0]?.items?.[0]?.items?.map((f) => f.path),
    ).toEqual(['Shared/Data Science']);
  });

  it('passes a no-results empty state title when search matches nothing, and omits the root node', () => {
    renderTree({ searchQuery: 'zzz_nonexistent_zzz' });
    expect(capturedProps.current?.emptyStateTitle).toBe(
      'No folders match "zzz_nonexistent_zzz".',
    );
    expect(capturedProps.current?.items).toEqual([]);
  });

  describe('creating a folder from a search that matched nothing', () => {
    const startCreatingFromSearch = async (searchQuery: string) => {
      renderTree({ searchQuery });
      await userEvent.click(
        screen.getByRole('button', { name: 'Create new folder' }),
      );
    };

    it('renders the tree with the inline create row instead of the empty state', async () => {
      await startCreatingFromSearch('Model releases');
      expect(capturedProps.current?.createdFolderPath).toBe('');
      expect(capturedProps.current?.items.map((file) => file.path)).toEqual([
        '',
      ]);
      expect(capturedProps.current?.emptyStateTitle).toBeUndefined();
    });

    it('pre-fills the new folder name with the unmatched query', async () => {
      await startCreatingFromSearch('  Model releases  ');
      expect(capturedProps.current?.newFolderDefaultName).toBe(
        'Model releases',
      );
    });

    it('falls back to the default name when the query is not a valid folder name', async () => {
      await startCreatingFromSearch('nested/name');
      expect(capturedProps.current?.newFolderDefaultName).toBe('New folder');
    });

    it('keeps the default name when the query did match a folder', async () => {
      await startCreatingFromSearch('Shared');
      expect(capturedProps.current?.newFolderDefaultName).toBe('New folder');
    });

    it('creates the folder under the selected parent and selects it', async () => {
      const onCreateFolder = vi.fn();
      const onSelectedPathChange = vi.fn();
      renderTree({
        searchQuery: 'Model releases',
        selectedPath: ['Shared'],
        onCreateFolder,
        onSelectedPathChange,
      });
      await userEvent.click(
        screen.getByRole('button', { name: 'Create new folder' }),
      );
      act(() => capturedProps.current?.onCreateFolderSave?.('Model releases'));
      expect(onCreateFolder).toHaveBeenCalledWith(['Shared'], 'Model releases');
      expect(onSelectedPathChange).toHaveBeenCalledWith([
        'Shared',
        'Model releases',
      ]);
    });

    it('restores the filtered empty state when creation is cancelled', async () => {
      await startCreatingFromSearch('Model releases');
      act(() => capturedProps.current?.onCreateFolderCancel?.());
      expect(capturedProps.current?.items).toEqual([]);
      expect(capturedProps.current?.emptyStateTitle).toBe(
        'No folders match "Model releases".',
      );
    });
  });

  describe('per-row context menu (add sibling / add child)', () => {
    const clickMenuItem = (menuItems: DropdownItem[], key: string) =>
      act(() =>
        menuItems
          .find((item) => item.key === key)
          ?.onClick?.({ key, domEvent: {} as never }),
      );

    it('omits "Add sibling" for the root node, since it has no parent', () => {
      renderTree();
      const rootFile: DialFile = {
        path: '',
        name: 'Organization',
        folderId: '',
        nodeType: DialFileNodeType.FOLDER,
      };
      const menuItems = capturedProps.current?.getContextMenuItems?.(rootFile);
      expect(menuItems?.map((item) => item.key)).toEqual(['add-child']);
    });

    it('includes both actions for a non-root folder', () => {
      renderTree();
      const sharedFile: DialFile = {
        path: 'Shared',
        name: 'Shared',
        folderId: 'Shared',
        nodeType: DialFileNodeType.FOLDER,
      };
      const menuItems =
        capturedProps.current?.getContextMenuItems?.(sharedFile);
      expect(menuItems?.map((item) => item.key)).toEqual([
        'add-child',
        'add-sibling',
      ]);
    });

    it('"Add child" creates the new folder inside the clicked folder', () => {
      renderTree();
      const sharedFile: DialFile = {
        path: 'Shared',
        name: 'Shared',
        folderId: 'Shared',
        nodeType: DialFileNodeType.FOLDER,
      };
      const menuItems =
        capturedProps.current?.getContextMenuItems?.(sharedFile);
      clickMenuItem(menuItems ?? [], 'add-child');
      expect(capturedProps.current?.createdFolderPath).toBe('Shared');
    });

    it('"Add sibling" creates the new folder alongside the clicked folder', () => {
      renderTree();
      const nestedFile: DialFile = {
        path: 'Shared/Data Science',
        name: 'Data Science',
        folderId: 'Shared/Data Science',
        nodeType: DialFileNodeType.FOLDER,
      };
      const menuItems =
        capturedProps.current?.getContextMenuItems?.(nestedFile);
      clickMenuItem(menuItems ?? [], 'add-sibling');
      expect(capturedProps.current?.createdFolderPath).toBe('Shared');
    });
  });

  it('lets DialFoldersTree render its inline row directly under the selected folder', async () => {
    renderTree({ selectedPath: ['Shared'] });
    await userEvent.click(
      screen.getByRole('button', { name: 'Create new folder' }),
    );
    expect(capturedProps.current?.createdFolderPath).toBe('Shared');
    expect(
      capturedProps.current?.items[0]?.items
        ?.find((file) => file.name === 'Shared')
        ?.items?.map((file) => file.name),
    ).toEqual(['Data Science']);
  });

  it('resolves a unique default name when a sibling already uses the default "New folder" name', async () => {
    const itemsWithDefaultNameTaken: PublishFolderNode[] = [
      ...items,
      { path: ['New folder'], name: 'New folder' },
    ];
    renderTree({ items: itemsWithDefaultNameTaken });
    await userEvent.click(
      screen.getByRole('button', { name: 'Create new folder' }),
    );
    expect(capturedProps.current?.createdFolderPath).toBe('');
    expect(capturedProps.current?.newFolderDefaultName).toBe('New folder 2');
    expect(
      capturedProps.current?.items[0]?.items?.map((file) => file.name),
    ).toEqual(['My workspace', 'New folder', 'Shared']);
  });

  it('confirms a new folder and selects it', async () => {
    const onCreateFolder = vi.fn();
    const onSelectedPathChange = vi.fn();
    renderTree({
      selectedPath: ['Shared'],
      onCreateFolder,
      onSelectedPathChange,
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Create new folder' }),
    );
    act(() => capturedProps.current?.onCreateFolderSave?.('Model releases'));
    expect(onCreateFolder).toHaveBeenCalledWith(['Shared'], 'Model releases');
    expect(onSelectedPathChange).toHaveBeenCalledWith([
      'Shared',
      'Model releases',
    ]);
  });

  it('rejects a new folder name that collides with a sibling', async () => {
    const onCreateFolder = vi.fn();
    renderTree({ onCreateFolder });
    await userEvent.click(
      screen.getByRole('button', { name: 'Create new folder' }),
    );
    act(() => capturedProps.current?.onCreateFolderSave?.('Shared'));
    expect(onCreateFolder).not.toHaveBeenCalled();
  });

  it('rejects a new folder name containing a path traversal segment', async () => {
    const onCreateFolder = vi.fn();
    const onSelectedPathChange = vi.fn();
    renderTree({ onCreateFolder, onSelectedPathChange });
    await userEvent.click(
      screen.getByRole('button', { name: 'Create new folder' }),
    );
    act(() => capturedProps.current?.onCreateFolderSave?.('../EscapeFolder'));
    expect(onCreateFolder).not.toHaveBeenCalled();
    expect(onSelectedPathChange).not.toHaveBeenCalled();
  });

  it('rejects a create-folder confirm whose last live-validated name was invalid, even when the host passes a different value to onCreateFolderSave', async () => {
    const onCreateFolder = vi.fn();
    const onSelectedPathChange = vi.fn();
    renderTree({ onCreateFolder, onSelectedPathChange });
    await userEvent.click(
      screen.getByRole('button', { name: 'Create new folder' }),
    );
    act(() => {
      // Simulates the host component showing the inline error live while the
      // user types, then confirming with a different (host-sanitized) value
      // — see #7968: the host does not reliably gate its own confirm on the
      // validation result it displayed.
      capturedProps.current?.onRenameValidate?.('/New folder', {} as never);
      capturedProps.current?.onCreateFolderSave?.('New folder');
    });
    expect(onCreateFolder).not.toHaveBeenCalled();
    expect(onSelectedPathChange).not.toHaveBeenCalled();
  });

  it('flags a path-traversal name as invalid via onRenameValidate, which also gates the create-folder row', async () => {
    renderTree();
    await userEvent.click(
      screen.getByRole('button', { name: 'Create new folder' }),
    );
    expect(
      capturedProps.current?.onRenameValidate?.('../EscapeFolder', {} as never),
    ).toBe('Folder name contains invalid characters.');
    expect(
      capturedProps.current?.onRenameValidate?.('Model releases', {} as never),
    ).toBeNull();
  });

  it('cancels inline folder creation through the public cancel action', async () => {
    const onCreateFolder = vi.fn();
    renderTree({ onCreateFolder });
    await userEvent.click(
      screen.getByRole('button', { name: 'Create new folder' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(capturedProps.current?.createdFolderPath).toBeNull();
    expect(onCreateFolder).not.toHaveBeenCalled();
  });

  it('supports a custom folder-creation cancel label', async () => {
    renderTree({ cancelCreatingFolderLabel: 'Discard folder' });
    await userEvent.click(
      screen.getByRole('button', { name: 'Create new folder' }),
    );

    expect(screen.getByRole('button', { name: 'Discard folder' })).toBeTruthy();
  });

  it('disables the create-folder trigger when disabled', () => {
    renderTree({ disabled: true });
    expect(
      screen
        .getByRole('button', { name: 'Create new folder' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  describe('root selection', () => {
    it('renders the bucket root as a tree node with the default label', () => {
      renderTree();
      expect(screen.getByText('Organization')).toBeTruthy();
    });

    it('renders the bucket root as a tree node with a custom label', () => {
      renderTree({ rootLabel: 'Public bucket' });
      expect(screen.getByText('Public bucket')).toBeTruthy();
    });

    it('selects the root (empty array) when the root node is clicked', async () => {
      const onSelectedPathChange = vi.fn();
      renderTree({ onSelectedPathChange });
      await userEvent.click(screen.getByText('Organization'));
      expect(onSelectedPathChange).toHaveBeenCalledWith([]);
    });

    it('deselects (undefined) when clicking the already-selected root node', async () => {
      const onSelectedPathChange = vi.fn();
      renderTree({ selectedPath: [], onSelectedPathChange });
      await userEvent.click(screen.getByText('Organization'));
      expect(onSelectedPathChange).toHaveBeenCalledWith(undefined);
    });

    it('passes an empty-string selectedPath to DialFoldersTree when the root is selected', () => {
      renderTree({ selectedPath: [] });
      expect(capturedProps.current?.selectedPath).toBe('');
    });

    it('passes no selectedPath to DialFoldersTree when nothing is selected', () => {
      renderTree();
      expect(capturedProps.current?.selectedPath).toBeUndefined();
    });

    it('always keeps the root node expanded so its children stay visible', () => {
      renderTree({ expandedPaths: new Set() });
      expect(capturedProps.current?.expandedPaths?.has('')).toBe(true);
    });

    it('never forwards the root path key to the host onExpandedPathsChange', () => {
      const onExpandedPathsChange = vi.fn();
      renderTree({ expandedPaths: new Set(), onExpandedPathsChange });
      act(() =>
        capturedProps.current?.onExpandedPathsChange?.(new Set(['', 'Shared'])),
      );
      expect(onExpandedPathsChange).toHaveBeenCalledWith(new Set(['Shared']));
    });
  });

  describe('externally-controlled expand state', () => {
    it('forwards a host-supplied expandedPaths set to DialFoldersTree, plus the always-expanded root', () => {
      renderTree({ expandedPaths: new Set(['Shared']) });
      expect(capturedProps.current?.expandedPaths).toEqual(
        new Set(['', 'Shared']),
      );
    });

    it('calls the host onExpandedPathsChange instead of managing state internally', () => {
      const onExpandedPathsChange = vi.fn();
      renderTree({
        expandedPaths: new Set(),
        onExpandedPathsChange,
      });

      act(() =>
        capturedProps.current?.onExpandedPathsChange?.(new Set(['Shared'])),
      );

      expect(onExpandedPathsChange).toHaveBeenCalledWith(new Set(['Shared']));
    });

    it('forwards loadingPaths to DialFoldersTree', () => {
      renderTree({ loadingPaths: new Set(['Shared']) });
      expect(capturedProps.current?.loadingPaths).toEqual(new Set(['Shared']));
    });

    it('falls back to internal expand state when uncontrolled', async () => {
      renderTree({ selectedPath: ['Shared'] });
      await userEvent.click(
        screen.getByRole('button', { name: 'Create new folder' }),
      );
      expect(capturedProps.current?.createdFolderPath).toBe('Shared');
      expect(capturedProps.current?.expandedPaths).toEqual(
        new Set(['', 'Shared']),
      );
    });
  });
});
