import {
  DestinationFolderMode,
  DialFileNodeType,
  type DialDestinationRequest,
  type DialFile,
  type FolderDestination,
} from '@epam/ai-dial-react-file-manager';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileManagerDestinationPanelLabels } from '../../labels';
import { FileManagerDestinationPanel } from '../FileManagerDestinationPanel';

interface PanelStubProps {
  labels?: { title?: string; closeAriaLabel?: string; cancelLabel?: string };
  panelLabels?: Record<string, string | undefined>;
  item: { title: string; summary?: ReactNode };
  action: { label: string; isDisabled?: boolean; onClick: () => void };
  onClose: () => void;
  destination: FolderDestination;
  onDestinationChange: (destination: FolderDestination) => void;
  onCreateFolder: (
    rootKey: string,
    parentPath: string[],
    name: string,
  ) => Promise<void>;
  onCreateFolderError?: (error: unknown) => void;
  submitError?: string;
  getDisabledReason?: (destination: FolderDestination) => string | undefined;
}

const panelProps = vi.fn<(props: PanelStubProps) => void>();

/* The real panel lives in the file-manager package; this component owns the mapping onto it. */
vi.mock('@epam/ai-dial-react-file-manager', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@epam/ai-dial-react-file-manager')
  >()),
  FolderDestinationPanel: (props: PanelStubProps) => {
    panelProps(props);
    return (
      <div role="dialog" aria-label={props.labels?.title}>
        <p aria-label="Destination">{props.destination.path.join('/')}</p>
        {props.submitError && <p role="status">{props.submitError}</p>}
        <button
          type="button"
          onClick={() =>
            props.onDestinationChange({ rootKey: 'files', path: ['reports'] })
          }
        >
          Pick reports
        </button>
        <button
          type="button"
          onClick={() =>
            props.onDestinationChange({ rootKey: 'files', path: ['archive'] })
          }
        >
          Pick archive
        </button>
        <button
          type="button"
          onClick={() =>
            void props
              .onCreateFolder('files', ['reports'], 'archive')
              .catch(() => undefined)
          }
        >
          Create folder
        </button>
        <button type="button" onClick={props.onClose}>
          Close panel
        </button>
        <button
          type="button"
          disabled={props.action.isDisabled}
          onClick={props.action.onClick}
        >
          {props.action.label}
        </button>
      </div>
    );
  },
}));

const lastPanelProps = (): PanelStubProps => {
  const call = panelProps.mock.calls.at(-1);
  if (!call) throw new Error('The panel stub has not rendered');
  return call[0];
};

const makeNode = (
  path: string,
  nodeType: DialFileNodeType,
  items?: DialFile[],
): DialFile => ({
  id: path,
  name: path.split('/').pop() ?? '',
  path,
  parentPath: path.split('/').slice(0, -1).join('/'),
  folderId: path,
  nodeType,
  items,
});

const file = makeNode('/My files/reports/a.txt', DialFileNodeType.ITEM);
/* Folder paths from the listing end with a slash. */
const reports: DialFile = {
  ...makeNode('/My files/reports/', DialFileNodeType.FOLDER, [file]),
  name: 'reports',
};
const archive: DialFile = {
  ...makeNode('/My files/archive/', DialFileNodeType.FOLDER, []),
  name: 'archive',
};
const root = makeNode('/My files', DialFileNodeType.FOLDER, [reports, archive]);

const labels: FileManagerDestinationPanelLabels = {
  getCopyTitle: (count) => `Copy ${count}`,
  getMoveTitle: (count) => `Move ${count}`,
  copyHeading: 'Copy to folder',
  moveHeading: 'Move to folder',
  copyButtonLabel: 'Copy here',
  moveButtonLabel: 'Move here',
  addFolderLabel: 'Add folder',
  sourceFolderTooltip: 'Source folder',
  movedIntoItselfTooltip: 'Into itself',
};

const makeRequest = (
  mode: DestinationFolderMode,
  items: DialFile[] = [file],
): DialDestinationRequest => ({
  mode,
  items,
  sourceFolder: '/My files/reports/',
  confirm: vi.fn(),
  cancel: vi.fn(),
});

const loadedFolders = new Set(['/My files/', '/My files/reports/']);

const renderPanel = (
  request: DialDestinationRequest,
  props: Partial<Parameters<typeof FileManagerDestinationPanel>[0]> = {},
) =>
  render(
    <FileManagerDestinationPanel
      request={request}
      roots={[root]}
      loadedPaths={loadedFolders}
      loadingPaths={new Set()}
      onFolderPopupPathChange={vi.fn()}
      onCreateFolder={vi.fn()}
      labels={labels}
      onFinish={vi.fn()}
      {...props}
    />,
  );

describe('FileManagerDestinationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when no section root matches the items', () => {
    const { container } = renderPanel(makeRequest(DestinationFolderMode.Copy), {
      roots: [],
    });
    expect(container.textContent).toBe('');
  });

  it('titles the dialog and labels the primary button by mode', () => {
    const { unmount } = renderPanel(makeRequest(DestinationFolderMode.Copy));
    expect(screen.getByRole('dialog', { name: 'Copy 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy here' })).toBeTruthy();
    expect(lastPanelProps().panelLabels?.destinationHeading).toBe(
      'Copy to folder',
    );
    unmount();

    renderPanel(makeRequest(DestinationFolderMode.Move));
    expect(screen.getByRole('dialog', { name: 'Move 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Move here' })).toBeTruthy();
    expect(lastPanelProps().panelLabels?.destinationHeading).toBe(
      'Move to folder',
    );
  });

  it('starts Copy and Move on the source folder', () => {
    const { unmount } = renderPanel(makeRequest(DestinationFolderMode.Copy));
    expect(screen.getByLabelText('Destination').textContent).toBe('reports');
    unmount();

    renderPanel(makeRequest(DestinationFolderMode.Move));
    expect(screen.getByLabelText('Destination').textContent).toBe('reports');
  });

  it('disables Move for a moved folder and its subfolders', () => {
    renderPanel(makeRequest(DestinationFolderMode.Move, [reports]));
    const { getDisabledReason } = lastPanelProps();

    expect(getDisabledReason?.({ rootKey: 'files', path: ['reports'] })).toBe(
      'Into itself',
    );
    expect(
      getDisabledReason?.({ rootKey: 'files', path: ['reports', 'deep'] }),
    ).toBe('Into itself');
    expect(
      getDisabledReason?.({ rootKey: 'files', path: ['archive'] }),
    ).toBeUndefined();
  });

  it('gives the source folder its own reason when only files are moved', () => {
    renderPanel(makeRequest(DestinationFolderMode.Move));
    expect(
      lastPanelProps().getDisabledReason?.({
        rootKey: 'files',
        path: ['reports'],
      }),
    ).toBe('Source folder');
  });

  it('gives the source folder its own reason for Copy as well', () => {
    renderPanel(makeRequest(DestinationFolderMode.Copy));
    const { getDisabledReason } = lastPanelProps();
    expect(getDisabledReason?.({ rootKey: 'files', path: ['reports'] })).toBe(
      'Source folder',
    );
    expect(
      getDisabledReason?.({ rootKey: 'files', path: ['archive'] }),
    ).toBeUndefined();
  });

  it('loads the folder it opens on and every folder the user picks', async () => {
    const onFolderPopupPathChange = vi.fn();
    renderPanel(makeRequest(DestinationFolderMode.Copy), {
      onFolderPopupPathChange,
    });
    expect(onFolderPopupPathChange).toHaveBeenCalledWith('/My files/reports');

    await userEvent.click(screen.getByRole('button', { name: 'Pick reports' }));
    expect(onFolderPopupPathChange).toHaveBeenCalledTimes(2);
  });

  it('keeps the primary button disabled until the destination is loaded', () => {
    renderPanel(makeRequest(DestinationFolderMode.Move), {
      loadedPaths: new Set(),
    });
    expect(
      (screen.getByRole('button', { name: 'Move here' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('disables Move and Copy while the source folder is the destination', () => {
    const { unmount } = renderPanel(makeRequest(DestinationFolderMode.Move));
    expect(
      (screen.getByRole('button', { name: 'Move here' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    unmount();

    renderPanel(makeRequest(DestinationFolderMode.Copy));
    expect(
      (screen.getByRole('button', { name: 'Copy here' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('keeps the primary button disabled while the destination is loading', () => {
    renderPanel(makeRequest(DestinationFolderMode.Copy), {
      loadingPaths: new Set(['/My files/reports']),
    });
    expect(
      (screen.getByRole('button', { name: 'Copy here' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('confirms with the destination and its loaded items, then finishes', async () => {
    const request = makeRequest(DestinationFolderMode.Copy);
    const onFinish = vi.fn();
    renderPanel(request, {
      onFinish,
      loadedPaths: new Set([...loadedFolders, '/My files/archive/']),
    });

    await userEvent.click(screen.getByRole('button', { name: 'Pick archive' }));
    await userEvent.click(screen.getByRole('button', { name: 'Copy here' }));

    expect(request.confirm).toHaveBeenCalledWith('/My files/archive/', []);
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it('cancels the request and finishes when the panel is closed', async () => {
    const request = makeRequest(DestinationFolderMode.Copy);
    const onFinish = vi.fn();
    renderPanel(request, { onFinish });

    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }));

    expect(request.cancel).toHaveBeenCalledOnce();
    expect(request.confirm).not.toHaveBeenCalled();
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it('forwards the translated search, folder-creation and retry text to the panel', () => {
    renderPanel(makeRequest(DestinationFolderMode.Copy), {
      labels: {
        ...labels,
        cancelLabel: 'Abbrechen',
        closeAriaLabel: 'Schließen',
        searchPlaceholder: 'Ordner suchen',
        retryLabel: 'Erneut',
        createFolderHiddenNameWarning: 'Versteckt',
      },
    });

    expect(lastPanelProps().labels).toEqual(
      expect.objectContaining({
        cancelLabel: 'Abbrechen',
        closeAriaLabel: 'Schließen',
      }),
    );
    expect(lastPanelProps().panelLabels).toEqual(
      expect.objectContaining({
        createFolderLabel: 'Add folder',
        searchPlaceholder: 'Ordner suchen',
        retryLabel: 'Erneut',
        createFolderHiddenNameWarning: 'Versteckt',
      }),
    );
  });

  describe('folder creation', () => {
    it('creates the folder under the full virtual path of its parent', async () => {
      const onCreateFolder = vi.fn().mockResolvedValue(true);
      renderPanel(makeRequest(DestinationFolderMode.Copy), { onCreateFolder });

      await userEvent.click(
        screen.getByRole('button', { name: 'Create folder' }),
      );

      expect(onCreateFolder).toHaveBeenCalledWith(
        expect.objectContaining({ name: '.dial_folder' }),
        '/My files/reports/archive',
        '/My files/reports/archive/.dial_folder',
      );
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('rejects when the controller reports the folder was not created', async () => {
      const onCreateFolder = vi.fn().mockResolvedValue(false);
      renderPanel(makeRequest(DestinationFolderMode.Copy), { onCreateFolder });

      await expect(
        lastPanelProps().onCreateFolder('files', ['reports'], 'archive'),
      ).rejects.toThrow('archive');
    });

    it('resolves when the controller created the folder', async () => {
      const onCreateFolder = vi.fn().mockResolvedValue(true);
      renderPanel(makeRequest(DestinationFolderMode.Copy), { onCreateFolder });

      await expect(
        lastPanelProps().onCreateFolder('files', ['reports'], 'archive'),
      ).resolves.toBeUndefined();
    });

    it('announces a rejected creation with the default message', () => {
      renderPanel(makeRequest(DestinationFolderMode.Copy));

      act(() => lastPanelProps().onCreateFolderError?.(new Error('boom')));

      expect(screen.getByRole('status').textContent).toBe(
        'Failed to create the folder. Please try again.',
      );
    });

    it('announces a rejected creation with the translated message', () => {
      renderPanel(makeRequest(DestinationFolderMode.Copy), {
        labels: {
          ...labels,
          createFolderFailedMessage: 'Ordner fehlgeschlagen',
        },
      });

      act(() => lastPanelProps().onCreateFolderError?.(new Error('boom')));

      expect(screen.getByRole('status').textContent).toBe(
        'Ordner fehlgeschlagen',
      );
    });

    it('clears the error on the next attempt and on the next pick', async () => {
      renderPanel(makeRequest(DestinationFolderMode.Copy));
      act(() => lastPanelProps().onCreateFolderError?.(new Error('boom')));
      expect(screen.getByRole('status')).toBeTruthy();

      await userEvent.click(
        screen.getByRole('button', { name: 'Create folder' }),
      );
      expect(screen.queryByRole('status')).toBeNull();

      act(() => lastPanelProps().onCreateFolderError?.(new Error('boom')));
      await userEvent.click(
        screen.getByRole('button', { name: 'Pick reports' }),
      );
      expect(screen.queryByRole('status')).toBeNull();
    });
  });
});
