import {
  PublicationRuleFunction,
  SaveVersionMode,
} from '@epam/ai-dial-publish-panel';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ResourceSaveOutcome,
  ResourceSaveVersionError,
  SaveDestinationRoot,
  type ResourceSaveAdapter,
} from '../../resource-save';
import type { UsePublishFoldersResult } from '../../usePublishFolders/usePublishFolders';
import {
  useResourceSavePanel,
  type UseResourceSavePanelParams,
} from '../useResourceSavePanel';

const personalFolders = {
  folderItems: [],
  expandedPaths: new Set<string>(),
  loadingPaths: new Set<string>(),
  onExpandedPathsChange: vi.fn(),
  onCreateFolder: vi.fn(),
  hasError: false,
  retry: vi.fn(),
};

vi.mock('../../useResourceFolders/useResourceFolders', () => ({
  useResourceFolders: vi.fn(() => personalFolders),
}));

const ID = 'applications/b1/agent__1.0.0';
const EPAM = { rootKey: SaveDestinationRoot.Organization, path: ['EPAM'] };
const RULE = {
  source: 'roles',
  function: PublicationRuleFunction.Equal,
  targets: ['dev'],
};

const makeAdapter = (
  overrides: Partial<ResourceSaveAdapter> = {},
): ResourceSaveAdapter => ({
  publishEntityType: 'application',
  isVersioned: true,
  saveInPlace: vi.fn().mockResolvedValue({ id: ID }),
  saveAsNewVersion: vi
    .fn()
    .mockResolvedValue({ id: 'applications/b1/agent__1.1.0' }),
  move: vi.fn(),
  ...overrides,
});

const makeOrganization = (): UsePublishFoldersResult => ({
  folderItems: [{ path: ['EPAM'], name: 'EPAM' }],
  expandedPaths: new Set<string>(),
  loadedPaths: new Set<string>(),
  loadingPaths: new Set(['EPAM/']),
  onExpandedPathsChange: vi.fn(),
  onCreatePublishFolder: vi.fn().mockResolvedValue(undefined),
  rememberPublishFolder: vi.fn(),
  hasPublishWriteAccess: vi.fn(),
});

const renderPanel = (overrides: Partial<UseResourceSavePanelParams> = {}) => {
  const params: UseResourceSavePanelParams = {
    isOpen: true,
    adapter: makeAdapter(),
    resourceId: ID,
    currentFolderPath: [],
    currentVersion: '1.0.0',
    versionPattern: /^\d+(\.\d+)*$/,
    listPersonalFolders: vi.fn(),
    organizationFolders: makeOrganization(),
    publishClient: {
      publishCatalogEntity: vi.fn().mockResolvedValue({}),
      getPublishRules: vi.fn().mockResolvedValue([]),
    },
    ruleSourceOptions: ['roles'],
    labels: {
      personalRoot: 'Personal',
      organizationRoot: 'Organization',
      foldersLoadError: 'Folders failed',
      saveError: 'Save failed',
      getVersionError: (error, version) => `${error}:${version}`,
    },
    onSaved: vi.fn(),
    ...overrides,
  };
  return { params, ...renderHook(() => useResourceSavePanel(params)) };
};

describe('useResourceSavePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts at the current Personal folder, keeping the version', () => {
    const { result } = renderPanel({ currentFolderPath: ['Design'] });
    const { panelProps } = result.current;
    expect(panelProps.destination).toEqual({
      rootKey: SaveDestinationRoot.Personal,
      path: ['Design'],
    });
    expect(panelProps.version?.versionMode).toBe(SaveVersionMode.Keep);
    expect(panelProps.isSubmitDisabled).toBe(false);
  });

  it('offers Personal then Organization, with rules and plain loading keys on Organization', () => {
    const { result } = renderPanel();
    const [personal, organization] = result.current.panelProps.roots;
    expect([personal.key, personal.label]).toEqual([
      SaveDestinationRoot.Personal,
      'Personal',
    ]);
    expect(organization.hasAccessRules).toBe(true);
    expect(organization.loadingPaths).toEqual(new Set(['EPAM']));
  });

  it('offers only the Personal root without Organization folders', () => {
    const { result } = renderPanel({ organizationFolders: undefined });
    expect(result.current.panelProps.roots.map((root) => root.key)).toEqual([
      SaveDestinationRoot.Personal,
    ]);
  });

  it('creates a folder under the root it was asked for', async () => {
    const { result, params } = renderPanel();
    await act(() =>
      result.current.panelProps.onCreateFolder(
        SaveDestinationRoot.Organization,
        ['EPAM'],
        'Team',
      ),
    );
    await act(() =>
      result.current.panelProps.onCreateFolder(
        SaveDestinationRoot.Personal,
        [],
        'Mine',
      ),
    );
    expect(
      params.organizationFolders?.onCreatePublishFolder,
    ).toHaveBeenCalledWith(['EPAM'], 'Team');
    expect(personalFolders.onCreateFolder).toHaveBeenCalledWith([], 'Mine');
  });

  it('saves in place and reports the result with its choice', async () => {
    const { result, params } = renderPanel();
    await act(() => result.current.submit());

    expect(params.adapter.saveInPlace).toHaveBeenCalledOnce();
    expect(params.onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: ResourceSaveOutcome.Saved }),
      expect.objectContaining({ resourceId: ID }),
    );
  });

  it('blocks Save for an invalid new version and shows the error once visited', () => {
    const { result } = renderPanel();
    act(() =>
      result.current.panelProps.version?.onVersionModeChange(
        SaveVersionMode.New,
      ),
    );
    act(() => result.current.panelProps.version?.onNewVersionChange('abc'));

    expect(result.current.panelProps.isSubmitDisabled).toBe(true);
    expect(result.current.panelProps.version?.newVersionError).toBeUndefined();

    act(() => result.current.panelProps.version?.onNewVersionBlur?.());
    expect(result.current.panelProps.version?.newVersionError).toBe(
      `${ResourceSaveVersionError.Invalid}:abc`,
    );
  });

  it('rejects the current version as the new one', () => {
    const { result } = renderPanel();
    act(() =>
      result.current.panelProps.version?.onVersionModeChange(
        SaveVersionMode.New,
      ),
    );
    act(() => result.current.panelProps.version?.onNewVersionChange('1.0.0'));
    act(() => result.current.panelProps.version?.onNewVersionBlur?.());

    expect(result.current.panelProps.version?.newVersionError).toBe(
      `${ResourceSaveVersionError.Unchanged}:1.0.0`,
    );
  });

  it('shows a 409 as an existing version and keeps the panel open', async () => {
    const conflict = Object.assign(new Error('taken'), {
      response: new Response(null, { status: 409 }),
    });
    const adapter = makeAdapter({
      saveAsNewVersion: vi.fn().mockRejectedValue(conflict),
    });
    const { result, params } = renderPanel({ adapter });
    act(() =>
      result.current.panelProps.version?.onVersionModeChange(
        SaveVersionMode.New,
      ),
    );
    act(() => result.current.panelProps.version?.onNewVersionChange('1.1.0'));

    await act(() => result.current.submit());

    await waitFor(() =>
      expect(result.current.panelProps.version?.newVersionError).toBe(
        `${ResourceSaveVersionError.Exists}:1.1.0`,
      ),
    );
    expect(params.onSaved).not.toHaveBeenCalled();
    expect(result.current.panelProps.isSubmitting).toBe(false);
  });

  it('shows a submit error for a failed first step and does not report a save', async () => {
    const adapter = makeAdapter({
      saveInPlace: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const { result, params } = renderPanel({ adapter });

    await act(() => result.current.submit());

    expect(result.current.panelProps.submitError).toBeTruthy();
    expect(params.onSaved).not.toHaveBeenCalled();
  });

  it('publishes to an Organization folder with its rules and remembers it', async () => {
    const { result, params } = renderPanel();
    act(() => result.current.panelProps.onDestinationChange(EPAM));

    await act(() => result.current.submit());

    expect(params.publishClient.publishCatalogEntity).toHaveBeenCalledWith(
      'application',
      ID,
      { folderPath: 'EPAM', version: '1.0.0', rules: [] },
    );
    expect(
      params.organizationFolders?.rememberPublishFolder,
    ).toHaveBeenCalledWith(['EPAM']);
  });

  it('loads the pending Organization folder rules once and publishes the edited ones', async () => {
    const edited = { ...RULE, targets: ['qa'] };
    const getPublishRules = vi.fn().mockResolvedValue([RULE]);
    const { result, params } = renderPanel({
      publishClient: {
        publishCatalogEntity: vi.fn().mockResolvedValue({}),
        getPublishRules,
      },
    });

    act(() => result.current.panelProps.onPendingDestinationChange?.(EPAM));
    await waitFor(() =>
      expect(result.current.panelProps.accessRules?.rules).toEqual([RULE]),
    );
    expect(getPublishRules).toHaveBeenCalledWith('EPAM');

    act(() => result.current.panelProps.accessRules?.onRulesChange([edited]));
    act(() =>
      result.current.panelProps.onPendingDestinationChange?.({
        rootKey: SaveDestinationRoot.Personal,
        path: [],
      }),
    );
    act(() => result.current.panelProps.onPendingDestinationChange?.(EPAM));
    expect(getPublishRules).toHaveBeenCalledOnce();
    expect(result.current.panelProps.accessRules?.rules).toEqual([edited]);

    act(() => result.current.panelProps.onDestinationChange(EPAM));
    await act(() => result.current.submit());
    expect(params.publishClient.publishCatalogEntity).toHaveBeenCalledWith(
      'application',
      ID,
      expect.objectContaining({
        rules: [{ source: 'roles', function: 'EQUAL', targets: ['qa'] }],
      }),
    );
  });

  it('flags a failed rules fetch', async () => {
    const { result } = renderPanel({
      publishClient: {
        publishCatalogEntity: vi.fn(),
        getPublishRules: vi.fn().mockRejectedValue(new Error('boom')),
      },
    });
    act(() => result.current.panelProps.onPendingDestinationChange?.(EPAM));
    await waitFor(() =>
      expect(result.current.panelProps.accessRules?.hasLoadError).toBe(true),
    );
    expect(result.current.panelProps.accessRules?.isLoading).toBe(false);
  });

  it('reports a failed publish after a successful save as a partial outcome', async () => {
    const { result, params } = renderPanel({
      publishClient: {
        publishCatalogEntity: vi.fn().mockRejectedValue(new Error('denied')),
        getPublishRules: vi.fn().mockResolvedValue([]),
      },
    });
    act(() => result.current.panelProps.onDestinationChange(EPAM));

    await act(() => result.current.submit());

    expect(
      params.organizationFolders?.rememberPublishFolder,
    ).not.toHaveBeenCalled();
    expect(params.onSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: ResourceSaveOutcome.SavedButPublishFailed,
      }),
      expect.objectContaining({ destination: EPAM }),
    );
  });

  it('shows the folder load error from the Personal listing', () => {
    personalFolders.hasError = true;
    const { result } = renderPanel();
    expect(result.current.panelProps.foldersError).toBe('Folders failed');
    personalFolders.hasError = false;
  });
});
