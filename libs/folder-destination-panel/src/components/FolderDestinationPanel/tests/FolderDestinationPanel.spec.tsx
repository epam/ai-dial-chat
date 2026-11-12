import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FolderDestinationRoot } from '../../../models/folder-destination';
import type { FolderDestinationPanelProps } from '../../../models/folder-destination-panel';
import { FolderDestinationLayout } from '../../../types/folder-destination-panel';
import { FolderDestinationPanel } from '../FolderDestinationPanel';

vi.mock('../../FolderDestinationTree/FolderDestinationTree', () => ({
  FolderDestinationTree: (props: {
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

const roots: FolderDestinationRoot[] = [
  { key: 'personal', label: 'Personal', items: [] },
  { key: 'organization', label: 'Organization', items: [] },
];

const renderPanel = (props: Partial<FolderDestinationPanelProps> = {}) =>
  render(
    <FolderDestinationPanel
      isOpen
      onClose={vi.fn()}
      action={{ label: 'Copy', busyLabel: 'Copying…', onClick: vi.fn() }}
      item={{ title: 'report.pdf' }}
      roots={roots}
      destination={{ rootKey: 'personal', path: [] }}
      onDestinationChange={vi.fn()}
      onCreateFolder={vi.fn()}
      labels={{ title: 'Copy report.pdf' }}
      {...props}
    />,
  );

describe('FolderDestinationPanel', () => {
  it('opens on the main view, named by its title', () => {
    renderPanel();
    expect(
      screen.getByRole('dialog', { name: 'Copy report.pdf' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('runs the action from its button and closes from Cancel', async () => {
    const onClick = vi.fn();
    const onClose = vi.fn();
    renderPanel({ action: { label: 'Copy', onClick }, onClose });
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('disables the action when the host says so', () => {
    renderPanel({
      action: { label: 'Move', onClick: vi.fn(), isDisabled: true },
    });
    expect(screen.getByRole('button', { name: 'Move' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('shows the busy label and keeps controls disabled while submitting', () => {
    renderPanel({ isSubmitting: true });
    expect(screen.getByRole('button', { name: 'Copying…' })).toHaveProperty(
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
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    await userEvent.click(screen.getByRole('button', { name: 'EPAM' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onDestinationChange).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
  });

  it('renders the host footer under the tree for the pending folder', async () => {
    renderPanel({
      renderFolderViewFooter: (pending) => (
        <section aria-label="Footer">{pending?.path.join('/')}</section>
      ),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    await userEvent.click(screen.getByRole('button', { name: 'EPAM' }));

    expect(screen.getByRole('region', { name: 'Footer' }).textContent).toBe(
      'EPAM',
    );
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

describe('FolderDestinationPanel — inline layout', () => {
  it('opens with the folder tree and no Back, Change or Select controls', () => {
    renderPanel({ layout: FolderDestinationLayout.Inline });

    expect(screen.getByRole('tree', { name: 'Folders' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Select' })).toBeNull();
  });

  it('runs the action on the folder picked in the tree and closes from Cancel', async () => {
    const onClick = vi.fn();
    const onClose = vi.fn();
    const onDestinationChange = vi.fn();
    renderPanel({
      layout: FolderDestinationLayout.Inline,
      action: { label: 'Move', onClick },
      onClose,
      onDestinationChange,
    });

    await userEvent.click(screen.getByRole('button', { name: 'EPAM' }));
    await userEvent.click(screen.getByRole('button', { name: 'Move' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onDestinationChange).toHaveBeenCalledWith({
      rootKey: 'organization',
      path: ['EPAM'],
    });
    expect(onClick).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows the action icon beside its label', () => {
    renderPanel({
      layout: FolderDestinationLayout.Inline,
      action: {
        label: 'Move',
        onClick: vi.fn(),
        icon: <svg role="img" aria-label="move icon" />,
      },
    });

    expect(screen.getByRole('img', { name: 'move icon' })).toBeTruthy();
  });
});
