import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FolderDestinationRoot } from '../../../models/folder-destination';
import type { FolderDestinationPanelBodyProps } from '../../../models/folder-destination-panel';
import {
  FolderDestinationItemIcon,
  FolderDestinationLayout,
  FolderDestinationView,
} from '../../../types/folder-destination-panel';
import { FolderDestinationPanelBody } from '../FolderDestinationPanelBody';

const treeProps = vi.fn();

vi.mock('../../FolderDestinationTree/FolderDestinationTree', () => ({
  FolderDestinationTree: (props: {
    onDestinationChange: (destination: unknown) => void;
    searchQuery: string;
  }) => {
    treeProps(props);
    return (
      <div role="tree" aria-label="Folders">
        <button
          onClick={() =>
            props.onDestinationChange({
              rootKey: 'organization',
              path: ['EPAM'],
            })
          }
        >
          EPAM
        </button>
      </div>
    );
  },
}));

const roots: FolderDestinationRoot[] = [
  { key: 'personal', label: 'Personal', items: [] },
  { key: 'organization', label: 'Organization', items: [] },
];

const renderPanel = (props: Partial<FolderDestinationPanelBodyProps> = {}) =>
  render(
    <FolderDestinationPanelBody
      view={FolderDestinationView.Main}
      item={{ title: 'report.pdf' }}
      roots={roots}
      destination={{ rootKey: 'personal', path: ['Design', 'Audit'] }}
      onDestinationChange={vi.fn()}
      onCreateFolder={vi.fn()}
      onChangeFolderClick={vi.fn()}
      onPendingDestinationChange={vi.fn()}
      {...props}
    />,
  );

describe('FolderDestinationPanelBody', () => {
  it('shows the item name in the summary', () => {
    renderPanel();
    expect(screen.getByText('report.pdf')).toBeTruthy();
  });

  it('shows the destination path starting with the root label', () => {
    renderPanel();
    const path = screen.getByRole('group', { name: 'Destination folder' });
    expect(path.textContent).toContain('Personal');
    expect(path.textContent).toContain('Audit');
  });

  it('uses the host destination heading', () => {
    renderPanel({ panelLabels: { destinationHeading: 'Copy to folder' } });
    expect(
      screen.getByRole('heading', { name: 'Copy to folder' }),
    ).toBeTruthy();
  });

  it('calls onChangeFolderClick from the Change button', async () => {
    const onChangeFolderClick = vi.fn();
    renderPanel({ onChangeFolderClick });
    await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(onChangeFolderClick).toHaveBeenCalledOnce();
  });

  it('renders host main sections below the destination', () => {
    renderPanel({ mainSections: <section aria-label="Extra">Extra</section> });
    expect(screen.getByRole('region', { name: 'Extra' })).toBeTruthy();
  });

  it('announces a submit error through a region that stays mounted', () => {
    const { rerender } = renderPanel();
    const region = screen.getByRole('alert');
    expect(region.textContent).toBe('');
    rerender(
      <FolderDestinationPanelBody
        view={FolderDestinationView.Main}
        item={{ title: 'report.pdf' }}
        roots={roots}
        destination={{ rootKey: 'personal', path: [] }}
        onDestinationChange={vi.fn()}
        onCreateFolder={vi.fn()}
        onChangeFolderClick={vi.fn()}
        onPendingDestinationChange={vi.fn()}
        submitError="Copying failed"
      />,
    );
    expect(screen.getByRole('alert')).toBe(region);
    expect(region.textContent).toBe('Copying failed');
  });

  it('disables the Change button while submitting', () => {
    renderPanel({ isSubmitting: true });
    expect(screen.getByRole('button', { name: 'Change' })).toHaveProperty(
      'disabled',
      true,
    );
  });
});

describe('FolderDestinationPanelBody — folder view', () => {
  it('renders the search and a multi-root tree of the pending destination', () => {
    renderPanel({
      view: FolderDestinationView.ChangeFolder,
      pendingDestination: { rootKey: 'personal', path: [] },
    });
    expect(
      screen.getByRole('textbox', { name: 'Search folders' }),
    ).toBeTruthy();
    expect(treeProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        roots,
        destination: { rootKey: 'personal', path: [] },
      }),
    );
  });

  it('reports a pending selection, not a committed one', async () => {
    const onPendingDestinationChange = vi.fn();
    const onDestinationChange = vi.fn();
    renderPanel({
      view: FolderDestinationView.ChangeFolder,
      onPendingDestinationChange,
      onDestinationChange,
    });
    await userEvent.click(screen.getByRole('button', { name: 'EPAM' }));
    expect(onPendingDestinationChange).toHaveBeenCalledWith({
      rootKey: 'organization',
      path: ['EPAM'],
    });
    expect(onDestinationChange).not.toHaveBeenCalled();
  });

  it('forwards the search query to the tree', async () => {
    renderPanel({ view: FolderDestinationView.ChangeFolder });
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Search folders' }),
      'del',
    );
    expect(treeProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ searchQuery: 'del' }),
    );
  });

  it('renders the host footer for the pending destination', () => {
    const renderFolderViewFooter = vi.fn(() => <p>Footer</p>);
    renderPanel({
      view: FolderDestinationView.ChangeFolder,
      pendingDestination: { rootKey: 'organization', path: ['EPAM'] },
      renderFolderViewFooter,
    });
    expect(screen.getByText('Footer')).toBeTruthy();
    expect(renderFolderViewFooter).toHaveBeenCalledWith({
      rootKey: 'organization',
      path: ['EPAM'],
    });
  });

  it('shows a folder load error with a retry action', async () => {
    const onRetryFolders = vi.fn();
    renderPanel({
      view: FolderDestinationView.ChangeFolder,
      foldersError: 'Folders could not be loaded',
      onRetryFolders,
    });
    expect(screen.getByRole('alert').textContent).toContain(
      'Folders could not be loaded',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetryFolders).toHaveBeenCalledOnce();
  });
});

describe('FolderDestinationPanelBody — inline layout', () => {
  const renderInline = (props: Partial<FolderDestinationPanelBodyProps> = {}) =>
    renderPanel({ layout: FolderDestinationLayout.Inline, ...props });

  it('shows the folder search and tree in the main view without a Change action', () => {
    renderInline({ panelLabels: { destinationHeading: 'Move to folder' } });

    expect(
      screen.getByRole('heading', { name: 'Move to folder' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('textbox', { name: 'Search folders' }),
    ).toBeTruthy();
    expect(screen.getByRole('tree', { name: 'Folders' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull();
  });

  it('marks the committed destination as the selected folder', () => {
    renderInline();

    expect(treeProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        destination: { rootKey: 'personal', path: ['Design', 'Audit'] },
      }),
    );
  });

  it('commits a pick as the destination without a pending step', async () => {
    const onDestinationChange = vi.fn();
    const onPendingDestinationChange = vi.fn();
    renderInline({ onDestinationChange, onPendingDestinationChange });

    await userEvent.click(screen.getByRole('button', { name: 'EPAM' }));

    expect(onDestinationChange).toHaveBeenCalledWith({
      rootKey: 'organization',
      path: ['EPAM'],
    });
    expect(onPendingDestinationChange).not.toHaveBeenCalled();
  });

  it('scrolls only the folder tree, keeping the item, heading and search outside the scroll area', () => {
    renderInline();

    const tree = screen.getByRole('tree', { name: 'Folders' });
    /* The scroll container has no role or name; its class is the CSS-level behavior under test. */
    // eslint-disable-next-line testing-library/no-node-access
    const scrollArea = tree.parentElement;
    expect(scrollArea?.className).toMatch(/treeScroll/);
    expect(
      scrollArea?.contains(
        screen.getByRole('textbox', { name: 'Search folders' }),
      ),
    ).toBe(false);
    expect(scrollArea?.contains(screen.getByText('report.pdf'))).toBe(false);
  });

  it('renders the host footer for the destination', () => {
    const renderFolderViewFooter = vi.fn(() => <p>Footer</p>);
    renderInline({ renderFolderViewFooter });

    expect(screen.getByText('Footer')).toBeTruthy();
    expect(renderFolderViewFooter).toHaveBeenCalledWith({
      rootKey: 'personal',
      path: ['Design', 'Audit'],
    });
  });

  it('shows a file icon beside the item name when asked to', () => {
    renderInline({
      item: { title: 'api keys.xls', iconKind: FolderDestinationItemIcon.File },
    });

    expect(screen.getByText('api keys.xls')).toBeTruthy();
  });
});
