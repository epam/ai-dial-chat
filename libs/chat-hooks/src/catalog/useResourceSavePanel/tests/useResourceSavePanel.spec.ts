import {
  PublicationRuleFunction,
  SaveVersionMode,
  type PublicationRule,
} from '@epam/ai-dial-publish-panel';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ResourceSaveOutcome,
  ResourceSaveVersionError,
  SaveDestinationRoot,
  type ResourceEditSaveAdapter,
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
  overrides: Partial<ResourceEditSaveAdapter> = {},
): ResourceEditSaveAdapter => ({
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
  loadingPaths: new Set(['EPAM']),
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
    const adapter = makeAdapter();
    const { result, params } = renderPanel({ adapter });
    await act(() => result.current.submit());

    expect(adapter.saveInPlace).toHaveBeenCalledOnce();
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

  it('shows the Core 400 message for an over-long path as a submit error, not as an existing version', async () => {
    const tooLong = Object.assign(new Error('bad request'), {
      response: new Response(
        JSON.stringify({ statusCode: 400, message: 'Path is too long' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    });
    const adapter = makeAdapter({
      saveAsNewVersion: vi.fn().mockRejectedValue(tooLong),
    });
    const { result, params } = renderPanel({ adapter });
    act(() =>
      result.current.panelProps.version?.onVersionModeChange(
        SaveVersionMode.New,
      ),
    );
    act(() =>
      result.current.panelProps.version?.onNewVersionChange('1'.repeat(64)),
    );

    await act(() => result.current.submit());

    await waitFor(() =>
      expect(result.current.panelProps.submitError).toBe('Path is too long'),
    );
    expect(result.current.panelProps.version?.newVersionError).toBeUndefined();
    expect(params.onSaved).not.toHaveBeenCalled();
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

  it('blocks Save on an Organization folder while its rules load or after they fail', async () => {
    let rejectRules: (error: Error) => void = () => undefined;
    const publishCatalogEntity = vi.fn();
    const adapter = makeAdapter();
    const { result } = renderPanel({
      adapter,
      publishClient: {
        publishCatalogEntity,
        getPublishRules: vi.fn(
          () =>
            new Promise<PublicationRule[]>((_resolve, reject) => {
              rejectRules = reject;
            }),
        ),
      },
    });
    act(() => result.current.panelProps.onPendingDestinationChange?.(EPAM));
    act(() => result.current.panelProps.onDestinationChange(EPAM));

    expect(result.current.panelProps.isSubmitDisabled).toBe(true);

    act(() => rejectRules(new Error('boom')));
    await waitFor(() =>
      expect(result.current.panelProps.accessRules?.hasLoadError).toBe(true),
    );
    expect(result.current.panelProps.isSubmitDisabled).toBe(true);

    await act(() => result.current.submit());
    expect(adapter.saveInPlace).not.toHaveBeenCalled();
    expect(publishCatalogEntity).not.toHaveBeenCalled();
  });

  it('keeps Save enabled on a Personal folder when the last Organization rules failed', async () => {
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

    expect(result.current.panelProps.isSubmitDisabled).toBe(false);
  });

  describe('direct write into an org unit', () => {
    const UNIT = {
      rootKey: SaveDestinationRoot.Organization,
      path: ['Acme', 'Teams'],
    };
    const makeDirectAdapter = () =>
      makeAdapter({
        saveIntoOrgUnit: vi
          .fn()
          .mockResolvedValue({ id: 'applications/public/Acme/Teams/agent' }),
      });

    it('writes into the unit folder with no publish request and no rules fetch', async () => {
      const adapter = makeDirectAdapter();
      const getPublishRules = vi.fn().mockResolvedValue([]);
      const { result, params } = renderPanel({
        adapter,
        canSaveDirectlyTo: (path) => path[0] === 'Acme',
        publishClient: {
          publishCatalogEntity: vi.fn().mockResolvedValue({}),
          getPublishRules,
        },
      });
      act(() => result.current.panelProps.onPendingDestinationChange?.(UNIT));
      act(() => result.current.panelProps.onDestinationChange(UNIT));

      await act(() => result.current.submit());

      expect(getPublishRules).not.toHaveBeenCalled();
      expect(adapter.saveIntoOrgUnit).toHaveBeenCalledWith(ID, [
        'Acme',
        'Teams',
      ]);
      expect(params.publishClient.publishCatalogEntity).not.toHaveBeenCalled();
      expect(params.onSaved).toHaveBeenCalledWith(
        expect.objectContaining({ isWrittenToOrgUnit: true }),
        expect.objectContaining({ isDirectWrite: true }),
      );
    });

    it('hides the access rules for a direct destination only', () => {
      const { result } = renderPanel({
        adapter: makeDirectAdapter(),
        canSaveDirectlyTo: (path) => path[0] === 'Acme',
      });
      const isHiddenFor = result.current.panelProps.accessRules?.isHiddenFor;

      expect(isHiddenFor?.(UNIT)).toBe(true);
      expect(isHiddenFor?.(EPAM)).toBe(false);
    });

    it('does not block Save while rules would be loading for a direct destination', () => {
      const { result } = renderPanel({
        adapter: makeDirectAdapter(),
        canSaveDirectlyTo: () => true,
      });
      act(() => result.current.panelProps.onDestinationChange(UNIT));

      expect(result.current.panelProps.isSubmitDisabled).toBe(false);
    });

    it('keeps a Personal folder named like a unit on the normal path', async () => {
      const adapter = makeDirectAdapter();
      const { result, params } = renderPanel({
        adapter,
        canSaveDirectlyTo: () => true,
      });
      act(() =>
        result.current.panelProps.onDestinationChange({
          rootKey: SaveDestinationRoot.Personal,
          path: ['Acme', 'Teams'],
        }),
      );

      await act(() => result.current.submit());

      expect(adapter.saveIntoOrgUnit).not.toHaveBeenCalled();
      expect(params.onSaved).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ isDirectWrite: false }),
      );
    });

    it.each([
      [
        'no direct-save guard (flag off, rights not loaded or Core off)',
        undefined,
      ],
      [
        'a guard that refuses the folder (outside units, a reader, or a DIAL admin outside units)',
        () => false,
      ],
    ])('takes the publish path with %s', async (_label, canSaveDirectlyTo) => {
      const adapter = makeDirectAdapter();
      const { result, params } = renderPanel({ adapter, canSaveDirectlyTo });
      act(() => result.current.panelProps.onDestinationChange(UNIT));

      await act(() => result.current.submit());

      expect(adapter.saveIntoOrgUnit).not.toHaveBeenCalled();
      expect(params.publishClient.publishCatalogEntity).toHaveBeenCalledOnce();
    });

    it('takes the publish path when the adapter has no direct write', async () => {
      const { result, params } = renderPanel({
        canSaveDirectlyTo: () => true,
      });
      act(() => result.current.panelProps.onDestinationChange(UNIT));

      await act(() => result.current.submit());

      expect(params.publishClient.publishCatalogEntity).toHaveBeenCalledOnce();
    });

    it('reports a failed direct write as a partial outcome', async () => {
      const adapter = makeAdapter({
        saveIntoOrgUnit: vi.fn().mockRejectedValue(new Error('denied')),
      });
      const { result, params } = renderPanel({
        adapter,
        canSaveDirectlyTo: () => true,
      });
      act(() => result.current.panelProps.onDestinationChange(UNIT));

      await act(() => result.current.submit());

      expect(params.onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: ResourceSaveOutcome.SavedButOrgUnitWriteFailed,
        }),
        expect.anything(),
      );
    });
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

  describe('disabled destinations', () => {
    const LOCKED = {
      rootKey: SaveDestinationRoot.Organization,
      path: ['Acme', 'Locked'],
    };
    const getDisabledReason = (
      folderPath: string[],
      root: SaveDestinationRoot,
    ) =>
      root === SaveDestinationRoot.Organization && folderPath[1] === 'Locked'
        ? 'No access'
        : undefined;

    it('offers no reason callback while the host passes none', () => {
      const { result } = renderPanel();

      expect(result.current.panelProps.getDisabledReason).toBeUndefined();
    });

    it('maps a destination to the host callback with its root', () => {
      const { result } = renderPanel({ getDisabledReason });

      expect(result.current.panelProps.getDisabledReason?.(LOCKED)).toBe(
        'No access',
      );
      expect(
        result.current.panelProps.getDisabledReason?.({
          rootKey: SaveDestinationRoot.Personal,
          path: ['Acme', 'Locked'],
        }),
      ).toBeUndefined();
    });

    it('disables Save and does nothing on submit for a committed destination with a reason', async () => {
      const adapter = makeAdapter();
      const { result, params } = renderPanel({ adapter, getDisabledReason });
      act(() => result.current.panelProps.onDestinationChange(LOCKED));

      expect(result.current.panelProps.isSubmitDisabled).toBe(true);
      await act(() => result.current.submit());

      expect(adapter.saveInPlace).not.toHaveBeenCalled();
      expect(params.onSaved).not.toHaveBeenCalled();
    });

    it('keeps Save enabled for a destination without a reason', () => {
      const { result } = renderPanel({ getDisabledReason });
      act(() =>
        result.current.panelProps.onDestinationChange({
          rootKey: SaveDestinationRoot.Organization,
          path: ['Acme', 'Open'],
        }),
      );

      expect(result.current.panelProps.isSubmitDisabled).toBe(false);
    });
  });
});
