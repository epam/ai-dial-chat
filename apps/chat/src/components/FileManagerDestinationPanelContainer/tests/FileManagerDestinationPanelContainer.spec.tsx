import type { UseDialFileManagerResult } from '@epam/ai-dial-chat-hooks';
import {
  FolderDestinationItemIcon,
  FolderDestinationLayout,
  type FolderDestinationPanelProps,
  DestinationFolderMode,
  DialFileNodeType,
  DialFilePermission,
  type DialDestinationRequest,
  type DialFile,
} from '@epam/ai-dial-react-file-manager';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DialFileManagerI18nKeys } from '../../../constants/translation-keys';
import FileManagerDestinationPanelContainer from '../FileManagerDestinationPanelContainer';

const panelProps = vi.fn<(props: FolderDestinationPanelProps) => void>();

vi.mock('@epam/ai-dial-react-file-manager', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@epam/ai-dial-react-file-manager')
  >()),
  FolderDestinationPanel: (props: FolderDestinationPanelProps) => {
    panelProps(props);
    return null;
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params == null ? key : `${key}|${JSON.stringify(params)}`,
  }),
}));

const folder = (name: string, path: string, items: DialFile[] = []): DialFile =>
  ({
    id: path,
    name,
    path,
    nodeType: DialFileNodeType.FOLDER,
    items,
    permissions: [DialFilePermission.WRITE],
  }) as DialFile;

const items: DialFile[] = [
  folder('My files', '/My files', [
    folder('reports', '/My files/reports'),
    folder('archive', '/My files/archive'),
  ]),
];

const onFolderPopupPathChange = vi.fn();
const onCreateFolder = vi.fn().mockResolvedValue(undefined);

const makeRequest = (
  overrides: Partial<DialDestinationRequest> = {},
): DialDestinationRequest => ({
  mode: DestinationFolderMode.Copy,
  items: [
    {
      id: '/My files/reports/a.pdf',
      name: 'a.pdf',
      path: '/My files/reports/a.pdf',
      nodeType: DialFileNodeType.ITEM,
    } as DialFile,
  ],
  sourceFolder: '/My files/reports',
  confirm: vi.fn(),
  cancel: vi.fn(),
  ...overrides,
});

const renderContainer = (
  request: DialDestinationRequest,
  folderPopupLoadingPaths = new Set<string>(),
  onClose = vi.fn(),
) =>
  render(
    <FileManagerDestinationPanelContainer
      request={request}
      hookResult={
        {
          items,
          folderPopupLoadingPaths,
          onFolderPopupPathChange,
          onCreateFolder,
        } as unknown as UseDialFileManagerResult
      }
      onClose={onClose}
    />,
  );

const lastProps = (): FolderDestinationPanelProps => {
  const props = panelProps.mock.calls.at(-1)?.[0];
  if (!props) throw new Error('panel not rendered');
  return props;
};

describe('FileManagerDestinationPanelContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens on the folder the items are in and preloads it', () => {
    renderContainer(makeRequest());

    expect(lastProps().destination).toEqual({
      rootKey: 'My files',
      path: ['reports'],
    });
    expect(onFolderPopupPathChange).toHaveBeenCalledWith('/My files/reports');
  });

  it('shows the folder hierarchy inline, already opened along the source folder', () => {
    renderContainer(makeRequest());

    expect(lastProps().layout).toBe(FolderDestinationLayout.Inline);
    expect(lastProps().collapsibleRoots).toBe(true);
    expect(lastProps().roots[0]?.expandedPaths).toEqual(new Set(['reports']));
  });

  it('titles a single file and shows it with a file icon', () => {
    renderContainer(makeRequest());

    expect(lastProps().labels?.title).toBe(
      DialFileManagerI18nKeys.CopyTitleFile,
    );
    expect(lastProps().item).toEqual({
      title: 'a.pdf',
      iconKind: FolderDestinationItemIcon.File,
    });
    expect(lastProps().panelLabels?.destinationHeading).toBe(
      DialFileManagerI18nKeys.CopyToFolderHeading,
    );
  });

  it('titles a moved folder and uses a Move button', () => {
    renderContainer(
      makeRequest({
        mode: DestinationFolderMode.Move,
        items: [folder('reports', '/My files/reports')],
        sourceFolder: '/My files',
      }),
    );

    expect(lastProps().labels?.title).toBe(
      DialFileManagerI18nKeys.MoveTitleFolder,
    );
    expect(lastProps().item.iconKind).toBe(FolderDestinationItemIcon.Folder);
    expect(lastProps().action.label).toBe(
      DialFileManagerI18nKeys.MoveButtonLabel,
    );
    expect(lastProps().panelLabels?.destinationHeading).toBe(
      DialFileManagerI18nKeys.MoveToFolderHeading,
    );
  });

  it('titles several items by their count', () => {
    renderContainer(
      makeRequest({
        mode: DestinationFolderMode.Move,
        items: [makeRequest().items[0] as DialFile, folder('x', '/My files/x')],
      }),
    );

    expect(lastProps().labels?.title).toBe(
      `${DialFileManagerI18nKeys.MoveHeaderMultiple}|{"count":2}`,
    );
    expect(lastProps().item).toEqual({
      title: `${DialFileManagerI18nKeys.SelectedItemsSummary}|{"count":2}`,
    });
  });

  it('disables the action while the destination is the folder the items are in', () => {
    renderContainer(makeRequest());

    expect(lastProps().action.isDisabled).toBe(true);
  });

  it('disables the action and says why while the destination folder is loading', () => {
    renderContainer(makeRequest(), new Set(['/My files/archive']));

    act(() => {
      lastProps().onDestinationChange({
        rootKey: 'My files',
        path: ['archive'],
      });
    });

    expect(lastProps().action.isDisabled).toBe(true);
    expect(
      render(<>{lastProps().mainSections}</>).container.textContent,
    ).toContain(DialFileManagerI18nKeys.FolderPickerLoadingTooltip);
  });

  it('enables the action for another loaded folder', () => {
    renderContainer(makeRequest());

    act(() => {
      lastProps().onDestinationChange({
        rootKey: 'My files',
        path: ['archive'],
      });
    });

    expect(lastProps().action.isDisabled).toBe(false);
  });

  it('confirms the chosen destination and closes without cancelling', () => {
    const request = makeRequest();
    const onClose = vi.fn();
    renderContainer(request, new Set(), onClose);

    act(() => {
      lastProps().onDestinationChange({
        rootKey: 'My files',
        path: ['archive'],
      });
    });
    act(() => {
      lastProps().action.onClick();
    });

    expect(request.confirm).toHaveBeenCalledWith('/My files/archive');
    expect(request.cancel).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('cancels the request when the panel is dismissed', () => {
    const request = makeRequest();
    const onClose = vi.fn();
    renderContainer(request, new Set(), onClose);

    lastProps().onClose();

    expect(request.cancel).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('creates a folder through the file manager under the chosen parent', async () => {
    renderContainer(makeRequest());

    await lastProps().onCreateFolder('My files', ['reports'], 'new');

    expect(onCreateFolder).toHaveBeenCalledWith(
      expect.objectContaining({ name: '.dial_folder' }),
      '/My files/reports/new',
      '',
    );
  });

  it('preloads a folder when it is opened in the tree', () => {
    renderContainer(makeRequest());
    onFolderPopupPathChange.mockClear();

    lastProps().roots[0]?.onExpandedPathsChange?.(new Set(['archive']));

    expect(onFolderPopupPathChange).toHaveBeenCalledWith('/My files/archive');
  });
});
