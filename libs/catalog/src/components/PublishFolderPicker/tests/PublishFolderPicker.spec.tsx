import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PublishFolderNode } from '../../../models/publish';
import { PublishFolderPicker } from '../PublishFolderPicker';

const items: PublishFolderNode[] = [
  {
    path: ['Shared'],
    name: 'Shared',
    children: [
      {
        path: ['Shared', 'Data Science'],
        name: 'Data Science',
        children: [
          {
            path: ['Shared', 'Data Science', 'Published models'],
            name: 'Published models',
          },
        ],
      },
    ],
  },
  {
    path: ['My workspace'],
    name: 'My workspace',
    children: [{ path: ['My workspace', 'Drafts'], name: 'Drafts' }],
  },
];

const renderPicker = (
  props?: Partial<ComponentProps<typeof PublishFolderPicker>>,
) =>
  render(
    <PublishFolderPicker
      items={items}
      searchQuery=""
      onSelectedPathChange={vi.fn()}
      onCreateFolder={vi.fn()}
      {...props}
    />,
  );

describe('PublishFolderPicker', () => {
  it('renders root-level folders', () => {
    renderPicker();
    expect(screen.getByText('Shared')).toBeTruthy();
    expect(screen.getByText('My workspace')).toBeTruthy();
  });

  it('expands ancestors of the selected folder by default', () => {
    renderPicker({
      selectedPath: ['Shared', 'Data Science', 'Published models'],
    });
    expect(screen.getByText('Data Science')).toBeTruthy();
    expect(screen.getByText('Published models')).toBeTruthy();
  });

  it('marks the selected folder as aria-selected', () => {
    renderPicker({ selectedPath: ['Shared'] });
    const row = screen.getByText('Shared').closest('[role="treeitem"]');
    expect(row?.getAttribute('aria-selected')).toBe('true');
  });

  it('does not show children of a collapsed folder', () => {
    renderPicker();
    expect(screen.queryByText('Drafts')).toBeNull();
  });

  it('reveals children when the expand toggle is clicked', async () => {
    renderPicker();
    await userEvent.click(
      screen.getByRole('button', { name: 'Expand My workspace' }),
    );
    expect(screen.getByText('Drafts')).toBeTruthy();
  });

  it('calls onSelectedPathChange with the folder path when a name is clicked', async () => {
    const onSelectedPathChange = vi.fn();
    renderPicker({ onSelectedPathChange });
    await userEvent.click(screen.getByText('Shared'));
    expect(onSelectedPathChange).toHaveBeenCalledWith(['Shared']);
  });

  it('clears the selection when clicking the already-selected folder', async () => {
    const onSelectedPathChange = vi.fn();
    renderPicker({ selectedPath: ['Shared'], onSelectedPathChange });
    await userEvent.click(screen.getByText('Shared'));
    expect(onSelectedPathChange).toHaveBeenCalledWith([]);
  });

  it('selects a different folder normally when another folder is currently selected', async () => {
    const onSelectedPathChange = vi.fn();
    renderPicker({
      selectedPath: ['Shared'],
      onSelectedPathChange,
    });
    await userEvent.click(screen.getByText('My workspace'));
    expect(onSelectedPathChange).toHaveBeenCalledWith(['My workspace']);
  });

  it('filters the tree to matching folders when searchQuery is set', () => {
    renderPicker({ searchQuery: 'drafts' });
    expect(screen.getByText('Drafts')).toBeTruthy();
    expect(screen.queryByText('Shared')).toBeNull();
  });

  it('highlights the matching substring in folder names while searching', () => {
    renderPicker({ searchQuery: 'draft' });
    const mark = document.querySelector('mark');
    expect(mark?.textContent).toBe('Draft');
  });

  it('does not highlight folder names when there is no search query', () => {
    renderPicker();
    expect(document.querySelector('mark')).toBeNull();
  });

  it('starts the inline create-folder row under the selected folder', async () => {
    renderPicker({ selectedPath: ['Shared', 'Data Science'] });
    await userEvent.click(
      screen.getByRole('button', { name: 'Create new folder' }),
    );
    expect(
      screen.getByRole('textbox', { name: 'New folder name' }),
    ).toBeTruthy();
  });

  it('confirms a new folder and selects it', async () => {
    const onCreateFolder = vi.fn();
    const onSelectedPathChange = vi.fn();
    renderPicker({
      selectedPath: ['Shared', 'Data Science'],
      onCreateFolder,
      onSelectedPathChange,
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Create new folder' }),
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'New folder name' }),
      'Model releases',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm folder name' }),
    );
    expect(onCreateFolder).toHaveBeenCalledWith(
      ['Shared', 'Data Science'],
      'Model releases',
    );
    expect(onSelectedPathChange).toHaveBeenCalledWith([
      'Shared',
      'Data Science',
      'Model releases',
    ]);
  });

  it('cancels the inline create-folder row without calling onCreateFolder', async () => {
    const onCreateFolder = vi.fn();
    renderPicker({ onCreateFolder });
    await userEvent.click(
      screen.getByRole('button', { name: 'Create new folder' }),
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'New folder name' }),
      'Draft name',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByRole('textbox', { name: 'New folder name' }),
    ).toBeNull();
    expect(onCreateFolder).not.toHaveBeenCalled();
  });

  it('disables folder selection and the create-folder button when disabled', () => {
    renderPicker({ disabled: true });
    expect(
      screen.getByText('Shared').closest('button')?.hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen
        .getByRole('button', { name: 'Expand My workspace' })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen
        .getByRole('button', { name: 'Create new folder' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  it('disables the inline create-folder row controls when disabled', async () => {
    const { rerender } = renderPicker({
      selectedPath: ['Shared', 'Data Science'],
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Create new folder' }),
    );
    rerender(
      <PublishFolderPicker
        items={items}
        searchQuery=""
        selectedPath={['Shared', 'Data Science']}
        onSelectedPathChange={vi.fn()}
        onCreateFolder={vi.fn()}
        disabled
      />,
    );
    expect(
      screen
        .getByRole('textbox', { name: 'New folder name' })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen
        .getByRole('button', { name: 'Confirm folder name' })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('shows a no-results message when the search matches nothing', () => {
    renderPicker({ searchQuery: 'zzz_nonexistent_zzz' });
    expect(
      screen.getByText('No folders match "zzz_nonexistent_zzz".'),
    ).toBeTruthy();
  });

  it('does not show a no-results message when the search matches something', () => {
    renderPicker({ searchQuery: 'drafts' });
    expect(screen.queryByText(/No folders match/)).toBeNull();
  });

  it('still offers Create new folder when the search matches nothing', () => {
    renderPicker({ searchQuery: 'zzz_nonexistent_zzz' });
    expect(
      screen.getByRole('button', { name: 'Create new folder' }),
    ).toBeTruthy();
  });

  it('rejects a new folder name that collides with a sibling and does not call onCreateFolder', async () => {
    const onCreateFolder = vi.fn();
    const onSelectedPathChange = vi.fn();
    renderPicker({ onCreateFolder, onSelectedPathChange });
    await userEvent.click(
      screen.getByRole('button', { name: 'Create new folder' }),
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'New folder name' }),
      'Shared',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm folder name' }),
    );
    expect(
      screen.getByText('A folder named "Shared" already exists here.'),
    ).toBeTruthy();
    expect(onCreateFolder).not.toHaveBeenCalled();
    expect(onSelectedPathChange).not.toHaveBeenCalled();
  });

  it('is case-insensitive when detecting a duplicate sibling name', async () => {
    const onCreateFolder = vi.fn();
    renderPicker({ onCreateFolder });
    await userEvent.click(
      screen.getByRole('button', { name: 'Create new folder' }),
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'New folder name' }),
      'SHARED',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm folder name' }),
    );
    expect(screen.getByText(/already exists here/)).toBeTruthy();
    expect(onCreateFolder).not.toHaveBeenCalled();
  });

  it('clears the duplicate-name error once the user edits the name', async () => {
    renderPicker();
    await userEvent.click(
      screen.getByRole('button', { name: 'Create new folder' }),
    );
    const input = screen.getByRole('textbox', { name: 'New folder name' });
    await userEvent.type(input, 'Shared');
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm folder name' }),
    );
    expect(screen.getByText(/already exists here/)).toBeTruthy();
    await userEvent.type(input, ' Team');
    expect(screen.queryByText(/already exists here/)).toBeNull();
  });

  it('allows the same name under a different parent folder', async () => {
    const onCreateFolder = vi.fn();
    renderPicker({
      selectedPath: ['Shared', 'Data Science'],
      onCreateFolder,
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Create new folder' }),
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'New folder name' }),
      'Shared',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm folder name' }),
    );
    expect(onCreateFolder).toHaveBeenCalledWith(
      ['Shared', 'Data Science'],
      'Shared',
    );
  });

  it('moves focus to the next row on ArrowDown', async () => {
    renderPicker();
    screen.getByText('Shared').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement?.textContent).toBe('My workspace');
  });

  it('moves focus to the previous row on ArrowUp', async () => {
    renderPicker();
    screen.getByText('My workspace').focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement?.textContent).toBe('Shared');
  });

  it('expands a collapsed row and moves focus into it on ArrowRight', async () => {
    renderPicker();
    screen.getByText('My workspace').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByText('Drafts')).toBeTruthy();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement?.textContent).toBe('Drafts');
  });

  it('moves focus to the parent on ArrowLeft from a leaf, then collapses the parent on a second ArrowLeft', async () => {
    renderPicker();
    screen.getByText('My workspace').focus();
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement?.textContent).toBe('Drafts');

    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement?.textContent).toBe('My workspace');
    expect(screen.getByText('Drafts')).toBeTruthy();

    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.queryByText('Drafts')).toBeNull();
  });
});
