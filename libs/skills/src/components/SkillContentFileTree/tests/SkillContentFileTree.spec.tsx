import { CatalogContentNodeType } from '@epam/ai-dial-catalog';
import type { CatalogContentTreeNode } from '@epam/ai-dial-catalog';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ComponentProps, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SkillContentFileTree } from '../SkillContentFileTree';

const nodes: CatalogContentTreeNode[] = [
  { type: CatalogContentNodeType.File, id: 'SKILL.md', name: 'SKILL.md' },
  {
    type: CatalogContentNodeType.Folder,
    id: 'scripts',
    name: 'scripts',
    items: [
      {
        type: CatalogContentNodeType.File,
        id: 'scripts/run.py',
        name: 'run.py',
      },
    ],
  },
  {
    type: CatalogContentNodeType.File,
    id: '.env.example',
    name: '.env.example',
  },
];

type TreeProps = ComponentProps<typeof SkillContentFileTree>;

/* Holds expansion the way `DetailsPanel` does, so toggling round-trips. */
const ControlledTree = (props: Partial<TreeProps>) => {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  return (
    <SkillContentFileTree
      nodes={nodes}
      expandedFolderIds={expanded}
      onToggleFolder={(id) =>
        setExpanded((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        })
      }
      onSelectFile={vi.fn()}
      onClose={vi.fn()}
      ariaLabel="Select file"
      rowNameClassName="dial-small-text"
      {...props}
    />
  );
};

describe('SkillContentFileTree', () => {
  it('renders a labelled tree with every root node, dotfiles included', () => {
    render(<ControlledTree />);

    expect(screen.getByRole('tree', { name: 'Select file' })).toBeTruthy();
    expect(screen.getByRole('treeitem', { name: 'SKILL.md' })).toBeTruthy();
    expect(
      screen
        .getByRole('treeitem', { name: 'scripts' })
        .getAttribute('aria-expanded'),
    ).toBe('false');
    expect(screen.getByRole('treeitem', { name: '.env.example' })).toBeTruthy();
  });

  it('marks and focuses the selected file on mount', () => {
    render(<ControlledTree selectedFileId="SKILL.md" />);

    const selected = screen.getByRole('treeitem', { name: 'SKILL.md' });
    expect(selected.getAttribute('aria-selected')).toBe('true');
    expect(selected.matches(':focus')).toBe(true);
  });

  it('reports a folder toggle once, by its id, and reveals its children', async () => {
    const onToggleFolder = vi.fn();
    const { rerender } = render(
      <SkillContentFileTree
        nodes={nodes}
        expandedFolderIds={new Set()}
        onToggleFolder={onToggleFolder}
        onSelectFile={vi.fn()}
        onClose={vi.fn()}
        ariaLabel="Select file"
        rowNameClassName="dial-small-text"
      />,
    );

    await userEvent.click(screen.getByText('scripts'));
    expect(onToggleFolder).toHaveBeenCalledTimes(1);
    expect(onToggleFolder).toHaveBeenCalledWith('scripts');

    rerender(
      <SkillContentFileTree
        nodes={nodes}
        expandedFolderIds={new Set(['scripts'])}
        onToggleFolder={onToggleFolder}
        onSelectFile={vi.fn()}
        onClose={vi.fn()}
        ariaLabel="Select file"
        rowNameClassName="dial-small-text"
      />,
    );
    expect(screen.getByRole('treeitem', { name: 'run.py' })).toBeTruthy();
  });

  it('selects a nested file by its opaque id and never selects a folder', async () => {
    const onSelectFile = vi.fn();
    render(<ControlledTree onSelectFile={onSelectFile} />);

    await userEvent.click(screen.getByText('scripts'));
    expect(onSelectFile).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText('run.py'));
    expect(onSelectFile).toHaveBeenCalledWith('scripts/run.py');
  });

  it('navigates with the keyboard and picks a file with Enter', async () => {
    const onSelectFile = vi.fn();
    render(
      <ControlledTree selectedFileId="SKILL.md" onSelectFile={onSelectFile} />,
    );

    await userEvent.keyboard('{ArrowDown}');
    expect(
      screen.getByRole('treeitem', { name: 'scripts' }).matches(':focus'),
    ).toBe(true);
    await userEvent.keyboard('{ArrowRight}');
    expect(
      screen
        .getByRole('treeitem', { name: 'scripts' })
        .getAttribute('aria-expanded'),
    ).toBe('true');
    await userEvent.keyboard('{ArrowRight}{Enter}');
    expect(onSelectFile).toHaveBeenCalledWith('scripts/run.py');
  });

  it('closes on Escape without selecting', async () => {
    const onClose = vi.fn();
    const onSelectFile = vi.fn();
    render(
      <ControlledTree
        selectedFileId="SKILL.md"
        onClose={onClose}
        onSelectFile={onSelectFile}
      />,
    );

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelectFile).not.toHaveBeenCalled();
  });

  it('renders no context menu actions', () => {
    render(<ControlledTree />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
