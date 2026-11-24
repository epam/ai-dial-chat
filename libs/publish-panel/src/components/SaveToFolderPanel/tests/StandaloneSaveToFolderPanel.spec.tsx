import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FolderDestinationRoot } from '../../../models/folder-destination';
import type { StandaloneSaveToFolderPanelProps } from '../../../models/save-to-folder-panel';
import { SaveVersionMode } from '../../../types/save-to-folder';
import { StandaloneSaveToFolderPanel } from '../StandaloneSaveToFolderPanel';

interface PanelStubProps {
  isOpen: boolean;
  labels: { title: string };
  item: { title: string; summary?: ReactNode };
  action: {
    label: string;
    busyLabel: string;
    isDisabled?: boolean;
    onClick: () => void;
  };
  isSubmitting?: boolean;
  submitError?: string;
  roots: unknown[];
  mainSections: ReactNode;
  getDisabledReason?: unknown;
}

const panelProps = vi.fn();

/* The real panel and its tree live in the file-manager package; this lib owns only the mapping onto them. */
vi.mock('@epam/ai-dial-react-file-manager', () => ({
  FolderDestinationPanel: (props: PanelStubProps) => {
    panelProps(props);
    return (
      <div role="dialog" aria-label={props.labels.title}>
        <div role="group" aria-label="Summary">
          {props.item.summary ?? props.item.title}
        </div>
        {props.mainSections}
        {props.submitError && <p>{props.submitError}</p>}
        <button
          disabled={props.action.isDisabled}
          onClick={props.action.onClick}
        >
          {props.isSubmitting ? props.action.busyLabel : props.action.label}
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
  beforeEach(() => {
    panelProps.mockClear();
  });

  it('names the dialog by its title and shows the resource title when there is no entity type', () => {
    renderPanel();
    expect(screen.getByRole('dialog', { name: 'Save QuickApp' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Summary' }).textContent).toBe(
      'Design Review Agent',
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('submits from the panel action and disables it when the host says so', async () => {
    const onSubmit = vi.fn();
    const { rerender } = renderPanel({ onSubmit });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledOnce();

    rerender(
      <StandaloneSaveToFolderPanel
        isOpen
        onClose={vi.fn()}
        onSubmit={onSubmit}
        isSubmitDisabled
        resource={{ title: 'Design Review Agent' }}
        roots={roots}
        destination={{ rootKey: 'personal', path: [] }}
        onDestinationChange={vi.fn()}
        onCreateFolder={vi.fn()}
      />,
    );
    expect(
      (screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('shows the saving label while submitting and forwards the submit error', () => {
    renderPanel({ isSubmitting: true, submitError: 'Could not save' });
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeTruthy();
    expect(screen.getByText('Could not save')).toBeTruthy();
  });

  it('forwards getDisabledReason to the panel', () => {
    const getDisabledReason = vi.fn();
    renderPanel({ getDisabledReason });
    expect(panelProps).toHaveBeenCalledWith(
      expect.objectContaining({ getDisabledReason }),
    );
  });

  it('renders the version choice, the destination note and the dependencies note in the main view', () => {
    renderPanel({
      destinationNote: 'Org note',
      dependenciesNote: 'Dependencies note',
      version: {
        versionMode: SaveVersionMode.Keep,
        onVersionModeChange: vi.fn(),
        currentVersion: '1.0.0',
        newVersion: '',
        onNewVersionChange: vi.fn(),
      },
    });
    expect(screen.getByText('Org note')).toBeTruthy();
    expect(screen.getByText('Dependencies note')).toBeTruthy();
    expect(screen.getByText('Keep version 1.0.0')).toBeTruthy();
  });
});
