import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FolderDestinationRoot } from '../../../models/folder-destination';
import { PublishDependencyType } from '../../../models/publish-dependency';
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

  it('forwards getDisabledReason to the folder tree', () => {
    const getDisabledReason = vi.fn();
    renderPanel({ view: SaveToFolderView.ChangeFolder, getDisabledReason });

    expect(treeProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ getDisabledReason }),
    );
  });

  it('shows the reason when the committed destination is disabled', () => {
    renderPanel({
      getDisabledReason: ({ path }) =>
        path[0] === 'Design' ? 'You have no access to save here.' : undefined,
    });

    expect(screen.getByText('You have no access to save here.')).toBeTruthy();
  });

  it('describes the destination by the reason so the state is not visual only', () => {
    renderPanel({
      getDisabledReason: () => 'You have no access to save here.',
    });

    const group = screen.getByRole('group', { name: 'Destination folder' });
    const reason = screen.getByText('You have no access to save here.');
    expect(group.getAttribute('aria-describedby')).toBe(reason.id);
  });

  it('keeps the reason inside the live region that is mounted with the view', () => {
    const { rerender } = renderPanel({ getDisabledReason: () => undefined });
    const region = screen.getByRole('alert');
    expect(region.textContent).toBe('');

    rerender(
      <SaveToFolderPanel
        view={SaveToFolderView.Main}
        resource={{ title: 'Design Review Agent', version: '1.0.0' }}
        roots={roots}
        destination={{ rootKey: 'personal', path: ['Design', 'Audit'] }}
        onDestinationChange={vi.fn()}
        onCreateFolder={vi.fn()}
        onChangeFolderClick={vi.fn()}
        onPendingDestinationChange={vi.fn()}
        getDisabledReason={() => 'You have no access to save here.'}
      />,
    );

    expect(screen.getByRole('alert')).toBe(region);
    expect(region.textContent).toBe('You have no access to save here.');
  });

  it('shows no reason for a usable committed destination', () => {
    renderPanel({ getDisabledReason: () => undefined });

    expect(screen.queryByText('You have no access to save here.')).toBeNull();
  });
});

describe('SaveToFolderPanel — private dependencies', () => {
  const dependencies = [
    {
      id: 'prompts/b/Hi',
      name: 'Greeting prompt',
      type: PublishDependencyType.Prompt,
      location: 'Support',
    },
  ];

  it('lists the dependencies in the main view with the host labels', () => {
    renderPanel({
      dependencies,
      dependenciesLabels: { title: 'Private dependencies' },
    });
    expect(screen.getByText('Private dependencies')).toBeTruthy();
    expect(screen.getByText('Greeting prompt')).toBeTruthy();
  });

  it('renders no section when the list is empty or omitted', () => {
    const { unmount } = renderPanel({ dependencies: [] });
    expect(screen.queryByText('Private dependencies')).toBeNull();
    unmount();
    renderPanel();
    expect(screen.queryByText('Private dependencies')).toBeNull();
  });

  it('does not render the section in the folder view', () => {
    renderPanel({ view: SaveToFolderView.ChangeFolder, dependencies });
    expect(screen.queryByText('Greeting prompt')).toBeNull();
  });
});

describe('SaveToFolderPanel — dependencies note', () => {
  const dependencies = [
    {
      id: 'prompts/b/Hi',
      name: 'Greeting prompt',
      type: PublishDependencyType.Prompt,
      location: 'Support',
    },
  ];
  const dependenciesLabels = { title: 'Saved together' };

  it('renders the heading and the note when there is no list', () => {
    renderPanel({
      dependenciesNote: 'Dependencies are saved together.',
      dependenciesLabels,
    });

    expect(
      screen.getByRole('heading', { name: 'Saved together' }),
    ).toBeTruthy();
    expect(screen.getByText('Dependencies are saved together.')).toBeTruthy();
    expect(screen.queryByText('Greeting prompt')).toBeNull();
  });

  it('renders the note when the list is empty', () => {
    renderPanel({
      dependencies: [],
      dependenciesNote: 'Dependencies are saved together.',
      dependenciesLabels,
    });

    expect(screen.getByText('Dependencies are saved together.')).toBeTruthy();
  });

  it('lists the dependencies and not the note when both are given', () => {
    renderPanel({
      dependencies,
      dependenciesNote: 'Dependencies are saved together.',
      dependenciesLabels,
    });

    expect(screen.getByText('Greeting prompt')).toBeTruthy();
    expect(screen.queryByText('Dependencies are saved together.')).toBeNull();
  });

  it('renders nothing when neither a list nor a note is given', () => {
    renderPanel({ dependenciesLabels });

    expect(screen.queryByText('Saved together')).toBeNull();
  });

  it('does not render the note in the folder view', () => {
    renderPanel({
      view: SaveToFolderView.ChangeFolder,
      dependenciesNote: 'Dependencies are saved together.',
    });

    expect(screen.queryByText('Dependencies are saved together.')).toBeNull();
  });
});

describe('SaveToFolderPanel — destination note', () => {
  it('shows the note under the destination without a live region', () => {
    renderPanel({ destinationNote: 'The icon will not be copied.' });

    expect(screen.getByText('The icon will not be copied.')).toBeTruthy();
    for (const region of screen.queryAllByRole('alert')) {
      expect(region.textContent).not.toContain('The icon will not be copied.');
    }
    expect(screen.queryAllByRole('status')).toHaveLength(0);
  });

  it('shows no note when none is given', () => {
    renderPanel();

    expect(screen.queryByText('The icon will not be copied.')).toBeNull();
  });
});

describe('SaveToFolderPanel — notes in a right-to-left page', () => {
  it('keeps both notes in reading order with no physical direction classes', () => {
    render(
      <div dir="rtl">
        <SaveToFolderPanel
          view={SaveToFolderView.Main}
          resource={{ title: 'Design Review Agent' }}
          roots={roots}
          destination={{ rootKey: 'personal', path: [] }}
          onDestinationChange={vi.fn()}
          onCreateFolder={vi.fn()}
          onChangeFolderClick={vi.fn()}
          onPendingDestinationChange={vi.fn()}
          destinationNote="Icon notice."
          dependenciesNote="Dependencies note."
        />
      </div>,
    );

    const icon = screen.getByText('Icon notice.');
    const dependencies = screen.getByText('Dependencies note.');
    expect(
      icon.compareDocumentPosition(dependencies) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    for (const note of [icon, dependencies]) {
      expect(note.className).not.toMatch(/\b(ml|mr|pl|pr|left|right)-/);
    }
  });
});
