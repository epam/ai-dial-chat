import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PublishFoldersTree } from '../PublishFoldersTree';

const REASON = 'You have no access to save your QuickApp to this folder.';

const renderTree = (onSelectedPathChange = vi.fn()) =>
  render(
    <PublishFoldersTree
      items={[
        {
          path: ['Sales'],
          name: 'Sales',
          children: [{ path: ['Sales', 'Open'], name: 'Open' }],
        },
        { path: ['Plain'], name: 'Plain' },
      ]}
      searchQuery=""
      expandedPaths={new Set(['Sales'])}
      onSelectedPathChange={onSelectedPathChange}
      onCreateFolder={vi.fn()}
      getDisabledReason={({ path }) =>
        path.length === 1 && path[0] === 'Sales' ? REASON : undefined
      }
    />,
  );

/* The real file-manager tree, so the row semantics the library relies on are proven rather than assumed. */
describe('PublishFoldersTree disabled rows (real tree)', () => {
  it('marks the disabled row aria-disabled with the reason as its description', () => {
    renderTree();

    const row = screen.getByRole('treeitem', { name: /Sales/ });
    expect(row.getAttribute('aria-disabled')).toBe('true');
    expect(row.getAttribute('aria-describedby')).toBe(
      screen.getByText(REASON).id,
    );
  });

  it('selects an enabled row on click, so the disabled checks below are not vacuous', () => {
    const onSelectedPathChange = vi.fn();
    renderTree(onSelectedPathChange);

    fireEvent.click(screen.getByText('Plain'));

    expect(onSelectedPathChange).toHaveBeenCalledWith(['Plain']);
  });

  it('keeps an enabled row free of aria-disabled', () => {
    renderTree();

    expect(
      screen
        .getByRole('treeitem', { name: /Plain/ })
        .getAttribute('aria-disabled'),
    ).not.toBe('true');
  });

  it('does not select a disabled row by click or keyboard, and keeps it focusable', async () => {
    const onSelectedPathChange = vi.fn();
    renderTree(onSelectedPathChange);
    const row = screen.getByRole('treeitem', { name: /Sales/ });

    fireEvent.click(screen.getByText('Sales'));
    await userEvent.click(row);
    row.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');

    expect(onSelectedPathChange).not.toHaveBeenCalled();
    expect(row.getAttribute('tabindex')).not.toBe(null);
  });

  it('leaves a child of a disabled folder selectable', () => {
    const onSelectedPathChange = vi.fn();
    renderTree(onSelectedPathChange);

    fireEvent.click(screen.getByText('Open'));

    expect(onSelectedPathChange).toHaveBeenCalledWith(['Sales', 'Open']);
  });
});
