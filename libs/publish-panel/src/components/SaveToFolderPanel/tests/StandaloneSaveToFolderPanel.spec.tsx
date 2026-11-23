import type { FolderDestination } from '@epam/ai-dial-react-file-manager';
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
  renderFolderViewFooter: (pending: FolderDestination | undefined) => ReactNode;
  getDisabledReason?: unknown;
}

const panelProps = vi.fn();
let pendingForFooter: FolderDestination | undefined;

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
        <div>{props.renderFolderViewFooter(pendingForFooter)}</div>
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
  beforeEach(() => {
    panelProps.mockClear();
    pendingForFooter = undefined;
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

  it('hands the panel roots without the host-only access-rules flag', () => {
    renderPanel();
    expect(panelProps).toHaveBeenCalledWith(
      expect.objectContaining({
        roots: [
          { key: 'personal', label: 'Personal', items: [] },
          { key: 'organization', label: 'Organization', items: [] },
        ],
      }),
    );
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

  it('shows access rules under the tree for a folder of a root that takes them', () => {
    pendingForFooter = { rootKey: 'organization', path: ['EPAM'] };
    renderPanel({ accessRules });
    expect(
      screen.getByRole('region', { name: 'Access rules' }).textContent,
    ).toBe('EPAM');
  });

  it('shows no access rules for a root that takes none or before a folder is picked', () => {
    pendingForFooter = { rootKey: 'personal', path: ['Notes'] };
    const { unmount } = renderPanel({ accessRules });
    expect(screen.queryByRole('region', { name: 'Access rules' })).toBeNull();
    unmount();

    pendingForFooter = undefined;
    renderPanel({ accessRules });
    expect(screen.queryByRole('region', { name: 'Access rules' })).toBeNull();
  });

  it('hides the access rules for a destination the host marks as taking none', () => {
    pendingForFooter = { rootKey: 'organization', path: ['EPAM'] };
    const isHiddenFor = vi.fn(
      (destination: { path: string[] }) => destination.path[0] === 'EPAM',
    );
    renderPanel({ accessRules: { ...accessRules, isHiddenFor } });

    expect(screen.queryByRole('region', { name: 'Access rules' })).toBeNull();
    expect(isHiddenFor).toHaveBeenCalledWith({
      rootKey: 'organization',
      path: ['EPAM'],
    });
  });
});
