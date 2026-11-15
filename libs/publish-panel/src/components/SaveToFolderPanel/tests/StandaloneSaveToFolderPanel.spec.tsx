import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FolderDestinationRoot } from '../../../models/folder-destination';
import type { StandaloneSaveToFolderPanelProps } from '../../../models/save-to-folder-panel';
import { StandaloneSaveToFolderPanel } from '../StandaloneSaveToFolderPanel';

vi.mock('../../PublishFoldersTree/PublishFoldersTree', () => ({
  PublishFoldersTree: (props: {
    onDestinationChange: (destination: unknown) => void;
  }) => (
    <div role="tree" aria-label="Folders">
      <button
        onClick={() =>
          props.onDestinationChange({ rootKey: 'organization', path: ['EPAM'] })
        }
      >
        EPAM
      </button>
    </div>
  ),
}));

vi.mock('../../PublishAccessRules/PublishAccessRules', () => ({
  PublishAccessRules: (props: { folderName?: string }) => (
    <section aria-label="Access rules">{props.folderName}</section>
  ),
}));

const accessRules = {
  rules: [],
  onRulesChange: vi.fn(),
  sourceOptions: ['roles'],
};

const roots: FolderDestinationRoot[] = [
  { key: 'personal', label: 'Personal', items: [] },
  {
    key: 'organization',
    label: 'Organization',
    items: [],
    hasAccessRules: true,
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

  it('shows access rules under the tree for a folder of a root that takes them', async () => {
    renderPanel({ accessRules });
    await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.queryByRole('region', { name: 'Access rules' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'EPAM' }));

    expect(
      screen.getByRole('region', { name: 'Access rules' }).textContent,
    ).toBe('EPAM');
  });

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
