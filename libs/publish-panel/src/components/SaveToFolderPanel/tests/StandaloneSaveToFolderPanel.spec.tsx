import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FolderDestinationRoot } from '../../../models/folder-destination';
import type { StandaloneSaveToFolderPanelProps } from '../../../models/save-to-folder-panel';
import { StandaloneSaveToFolderPanel } from '../StandaloneSaveToFolderPanel';

const treeProps = vi.fn();

vi.mock('../../PublishFoldersTree/PublishFoldersTree', () => ({
  PublishFoldersTree: (props: {
    onDestinationChange: (destination: unknown) => void;
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
  {
    key: 'organization',
    label: 'Organization',
    items: [],
  },
];

const renderPanel = (props: Partial<StandaloneSaveToFolderPanelProps> = {}) =>
  render(
    <StandaloneSaveToFolderPanel
      isOpen
      onClose={vi.fn()}
      onSubmit={vi.fn()}
      resource={{ title: 'Design Review Agent' }}
      roots={roots}
      destination={{ rootKey: 'personal', path: [] }}
      onDestinationChange={vi.fn()}
      onCreateFolder={vi.fn()}
      labels={{ title: 'Save QuickApp' }}
      {...props}
    />,
  );

describe('StandaloneSaveToFolderPanel', () => {
  it('opens on the main view, named by its title', () => {
    renderPanel();
    expect(screen.getByRole('dialog', { name: 'Save QuickApp' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('submits from Save and closes from Cancel', async () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    renderPanel({ onSubmit, onClose });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('disables Save when the host says so', () => {
    renderPanel({ isSubmitDisabled: true });
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('shows the saving label and keeps controls disabled while submitting', () => {
    renderPanel({ isSubmitting: true });
    expect(screen.getByRole('button', { name: 'Saving…' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('switches to the folder view, moving focus to its heading', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    const heading = screen.getByText('Change folder');
    expect(heading.matches(':focus')).toBe(true);
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Select' })).toBeTruthy();
  });

  it('forwards getDisabledReason to the folder tree in the folder view', async () => {
    const getDisabledReason = vi.fn();
    renderPanel({ getDisabledReason });
    await userEvent.click(screen.getByRole('button', { name: 'Change' }));

    expect(treeProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ getDisabledReason }),
    );
  });

  it('commits the pending destination only on Select', async () => {
    const onDestinationChange = vi.fn();
    renderPanel({ onDestinationChange });
    await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    await userEvent.click(screen.getByRole('button', { name: 'EPAM' }));
    expect(onDestinationChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Select' }));
    expect(onDestinationChange).toHaveBeenCalledWith({
      rootKey: 'organization',
      path: ['EPAM'],
    });
    expect(
      screen.getByRole('button', { name: 'Change' }).matches(':focus'),
    ).toBe(true);
  });

  it('discards the pending destination on Back and on Cancel', async () => {
    const onDestinationChange = vi.fn();
    const onClose = vi.fn();
    renderPanel({ onDestinationChange, onClose });

    await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    await userEvent.click(screen.getByRole('button', { name: 'EPAM' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    await userEvent.click(screen.getByRole('button', { name: 'EPAM' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onDestinationChange).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it.each([
    ['a personal folder', 'Personal'],
    ['an organization folder', 'EPAM'],
  ])(
    'shows no access-rules section in the Change-folder view for %s',
    async (_case, folder) => {
      renderPanel();
      await userEvent.click(screen.getByRole('button', { name: 'Change' }));
      const folderButton = screen.queryByRole('button', { name: folder });
      if (folderButton) await userEvent.click(folderButton);

      expect(
        screen.queryByRole('region', { name: /access rules/i }),
      ).toBeNull();
      expect(screen.queryByText(/allow access if all match/i)).toBeNull();
    },
  );

  it('reports the pending destination and resets it to the committed one on Back', async () => {
    const onPendingDestinationChange = vi.fn();
    renderPanel({ onPendingDestinationChange });
    const committed = { rootKey: 'personal', path: [] };

    await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(onPendingDestinationChange).toHaveBeenLastCalledWith(committed);
    await userEvent.click(screen.getByRole('button', { name: 'EPAM' }));
    expect(onPendingDestinationChange).toHaveBeenLastCalledWith({
      rootKey: 'organization',
      path: ['EPAM'],
    });
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onPendingDestinationChange).toHaveBeenLastCalledWith(committed);
  });
});
