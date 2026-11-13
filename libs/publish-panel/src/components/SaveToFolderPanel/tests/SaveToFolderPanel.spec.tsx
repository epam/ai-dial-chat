import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FolderDestinationRoot } from '../../../models/folder-destination';
import type { SaveToFolderPanelProps } from '../../../models/save-to-folder-panel';
import {
  SaveToFolderView,
  SaveVersionMode,
} from '../../../types/save-to-folder';
import { SaveToFolderPanel } from '../SaveToFolderPanel';

const treeProps = vi.fn();

vi.mock('../../PublishFoldersTree/PublishFoldersTree', () => ({
  PublishFoldersTree: (props: {
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

const renderPanel = (props: Partial<SaveToFolderPanelProps> = {}) =>
  render(
    <SaveToFolderPanel
      view={SaveToFolderView.Main}
      resource={{ title: 'Design Review Agent', version: '1.0.0' }}
      roots={roots}
      destination={{ rootKey: 'personal', path: ['Design', 'Audit'] }}
      onDestinationChange={vi.fn()}
      onCreateFolder={vi.fn()}
      onChangeFolderClick={vi.fn()}
      onPendingDestinationChange={vi.fn()}
      {...props}
    />,
  );

const versionProps = (
  overrides: Partial<NonNullable<SaveToFolderPanelProps['version']>> = {},
) => ({
  versionMode: SaveVersionMode.Keep,
  onVersionModeChange: vi.fn(),
  currentVersion: '1.0.0',
  newVersion: '',
  onNewVersionChange: vi.fn(),
  ...overrides,
});

describe('SaveToFolderPanel', () => {
  it('shows the destination path starting with the root label', () => {
    renderPanel();
    const path = screen.getByRole('group', { name: 'Destination folder' });
    expect(path.textContent).toContain('Personal');
    expect(path.textContent).toContain('Audit');
  });

  it('calls onChangeFolderClick from the Change button', async () => {
    const onChangeFolderClick = vi.fn();
    renderPanel({ onChangeFolderClick });
    await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(onChangeFolderClick).toHaveBeenCalledOnce();
  });

  it('renders no version section for an unversioned resource', () => {
    renderPanel();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByText('Version')).toBeNull();
  });

  it('renders the version choice with keep selected', () => {
    renderPanel({ version: versionProps() });
    expect(
      screen.getByRole('radio', { name: 'Keep version 1.0.0' }),
    ).toHaveProperty('checked', true);
    expect(
      screen.getByRole('radio', { name: 'Save as new version' }),
    ).toHaveProperty('checked', false);
  });

  it('reports a version mode change', async () => {
    const onVersionModeChange = vi.fn();
    renderPanel({ version: versionProps({ onVersionModeChange }) });
    await userEvent.click(
      screen.getByRole('radio', { name: 'Save as new version' }),
    );
    expect(onVersionModeChange).toHaveBeenCalledWith(SaveVersionMode.New);
  });

  it('shows the new version input with its error when saving a new version', async () => {
    const onNewVersionChange = vi.fn();
    renderPanel({
      version: versionProps({
        versionMode: SaveVersionMode.New,
        onNewVersionChange,
        newVersionError: 'Version already exists',
      }),
    });
    const input = screen.getByRole('textbox', { name: /Version/ });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Version already exists')).toBeTruthy();
    await userEvent.type(input, '2');
    expect(onNewVersionChange).toHaveBeenCalledWith('2');
  });

  it('announces a submit error through a region that stays mounted', () => {
    const { rerender } = renderPanel();
    const region = screen.getByRole('alert');
    expect(region.textContent).toBe('');
    rerender(
      <SaveToFolderPanel
        view={SaveToFolderView.Main}
        resource={{ title: 'Design Review Agent' }}
        roots={roots}
        destination={{ rootKey: 'personal', path: [] }}
        onDestinationChange={vi.fn()}
        onCreateFolder={vi.fn()}
        onChangeFolderClick={vi.fn()}
        onPendingDestinationChange={vi.fn()}
        submitError="Saving failed"
      />,
    );
    expect(screen.getByRole('alert')).toBe(region);
    expect(region.textContent).toBe('Saving failed');
  });

  it('disables the controls while submitting', () => {
    renderPanel({ version: versionProps(), isSubmitting: true });
    expect(screen.getByRole('button', { name: 'Change' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(
      screen.getByRole('radio', { name: 'Keep version 1.0.0' }),
    ).toHaveProperty('disabled', true);
  });
});

describe('SaveToFolderPanel — folder view', () => {
  it('renders the search and a multi-root tree of the pending destination', () => {
    renderPanel({
      view: SaveToFolderView.ChangeFolder,
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
      view: SaveToFolderView.ChangeFolder,
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
    renderPanel({ view: SaveToFolderView.ChangeFolder });
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Search folders' }),
      'del',
    );
    expect(treeProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ searchQuery: 'del' }),
    );
  });

  it('shows a folder load error with a retry action', async () => {
    const onRetryFolders = vi.fn();
    renderPanel({
      view: SaveToFolderView.ChangeFolder,
      foldersError: 'Folders could not be loaded',
      onRetryFolders,
    });
    expect(screen.getByRole('alert').textContent).toContain(
      'Folders could not be loaded',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetryFolders).toHaveBeenCalledOnce();
  });

  it('renders no history or dependencies in either view', () => {
    renderPanel({ version: versionProps() });
    expect(screen.queryByText(/history/i)).toBeNull();
    expect(screen.queryByText(/dependencies/i)).toBeNull();
  });
});

describe('SaveToFolderPanel — versions history', () => {
  const versionHistory = {
    rows: [
      { id: 'a', version: '1.0.0' },
      { id: 'b', version: 'beta-2' },
    ],
  };

  it('renders the section as the last section of the main view', () => {
    renderPanel({ version: versionProps(), versionHistory });

    const region = screen.getByRole('region', { name: 'Versions history' });
    const versionHeading = screen.getByRole('heading', { name: 'Version' });
    expect(
      versionHeading.compareDocumentPosition(region) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('renders no section when the host supplies no history', () => {
    renderPanel({ version: versionProps() });

    expect(
      screen.queryByRole('region', { name: 'Versions history' }),
    ).toBeNull();
  });

  it('does not render the section in the folder view', () => {
    renderPanel({ versionHistory, view: SaveToFolderView.ChangeFolder });

    expect(
      screen.queryByRole('region', { name: 'Versions history' }),
    ).toBeNull();
  });
});
