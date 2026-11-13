import { ResourceNameConflictCode } from '@epam/ai-dial-chat-api-client';
import {
  ResourceSaveError,
  ResourceSaveOutcome,
  ResourceSaveVersionError,
  SaveDestinationRoot,
  useResourceSavePanel,
  type ResourceSaveAdapter,
  type ResourceSaveChoice,
  type UseResourceSavePanelParams,
} from '@epam/ai-dial-chat-hooks';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { SaveVersionMode } from '@epam/ai-dial-publish-panel';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AppsEditorI18nKeys,
  CatalogI18nKeys,
  ResourceSavePanelI18nKeys,
} from '../../../constants/translation-keys';
import { usePublishFolders } from '../../../hooks/publish/usePublishFolders';
import { NotifiableEntity } from '../../../types/entity-notification';
import ResourceSavePanelContainer from '../ResourceSavePanelContainer';

const panelProps = vi.fn();
const notifySaved = vi.fn();

vi.mock('@epam/ai-dial-publish-panel', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-publish-panel')>()),
  StandaloneSaveToFolderPanel: (props: Record<string, unknown>) => {
    panelProps(props);
    return null;
  },
}));

vi.mock('@epam/ai-dial-chat-hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-hooks')>()),
  useResourceSavePanel: vi.fn(),
}));

vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: () => ({ config: { publicationFilterSources: ['roles'] } }),
}));
vi.mock('../../../server-api/publish-rules.api', () => ({
  getPublishRules: vi.fn(),
}));
vi.mock('../../../server-api/publish.api', () => ({
  publishCatalogEntity: vi.fn(),
}));
vi.mock('../../../hooks/publish/usePublishFolders');
vi.mock('../../../hooks/resource-save/useResourceSaveNotification', () => ({
  useResourceSaveNotification: () => notifySaved,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params == null ? key : `${key}|${JSON.stringify(params)}`,
  }),
}));

const adapter: ResourceSaveAdapter = {
  publishEntityType: 'application',
  isVersioned: true,
  saveInPlace: vi.fn(),
  saveAsNewVersion: vi.fn(),
  move: vi.fn(),
};

const flowPanelProps = {
  onSubmit: vi.fn(),
  roots: [],
  destination: { rootKey: SaveDestinationRoot.Personal, path: [] },
  onDestinationChange: vi.fn(),
  onCreateFolder: vi.fn(),
};

const organizationFolders = {
  folderItems: [],
  expandedPaths: new Set<string>(),
  loadedPaths: new Set<string>(),
  loadingPaths: new Set<string>(),
  onExpandedPathsChange: vi.fn(),
  onCreatePublishFolder: vi.fn(),
  rememberPublishFolder: vi.fn(),
  hasPublishWriteAccess: vi.fn(),
};

const renderContainer = (
  props: Partial<Parameters<typeof ResourceSavePanelContainer>[0]> = {},
) =>
  render(
    <ResourceSavePanelContainer
      isOpen
      onClose={vi.fn()}
      adapter={adapter}
      listPersonalFolders={vi.fn()}
      resourceId="applications/b1/agent__1.0.0"
      currentFolderPath={[]}
      resourceName="Agent"
      currentVersion="1.0.0"
      resourceType={CatalogEntityType.Agent}
      typeLabel="QuickApp"
      notifiableEntity={NotifiableEntity.QuickApp}
      canPublish
      onSaved={vi.fn()}
      {...props}
    />,
  );

const lastFlowParams = () =>
  vi.mocked(useResourceSavePanel).mock
    .lastCall?.[0] as UseResourceSavePanelParams;

const lastPanelProps = () =>
  panelProps.mock.lastCall?.[0] as Record<string, unknown> & {
    labels: { title: string };
  };

describe('ResourceSavePanelContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePublishFolders).mockReturnValue(organizationFolders);
    vi.mocked(useResourceSavePanel).mockReturnValue({
      panelProps: flowPanelProps,
      submit: vi.fn(),
    });
  });

  it('runs the flow with the Organization folders and the configured rule sources', () => {
    renderContainer();
    const params = lastFlowParams();
    expect(params.organizationFolders).toBe(organizationFolders);
    expect(params.ruleSourceOptions).toEqual(['roles']);
    expect(params.labels.personalRoot).toBe(CatalogI18nKeys.FolderPersonal);
    expect(params.labels.foldersLoadError).toBe(
      ResourceSavePanelI18nKeys.FoldersLoadFailed,
    );
  });

  it('leaves out the Organization folders when the user cannot publish', () => {
    renderContainer({ canPublish: false });
    expect(lastFlowParams().organizationFolders).toBeUndefined();
  });

  it('translates each version error', () => {
    renderContainer();
    const { getVersionError } = lastFlowParams().labels;
    expect(getVersionError(ResourceSaveVersionError.Invalid, 'x')).toBe(
      ResourceSavePanelI18nKeys.VersionInvalid,
    );
    expect(getVersionError(ResourceSaveVersionError.Unchanged, '1.0.0')).toBe(
      `${ResourceSavePanelI18nKeys.VersionUnchanged}|${JSON.stringify({ version: '1.0.0' })}`,
    );
    expect(getVersionError(ResourceSaveVersionError.Exists, '1.1.0')).toBe(
      `${ResourceSavePanelI18nKeys.VersionExists}|${JSON.stringify({ version: '1.1.0' })}`,
    );
  });

  it('reports a finished save before notifying, so the toast follows the redirect', () => {
    const calls: string[] = [];
    const onSaved = vi.fn(() => calls.push('onSaved'));
    notifySaved.mockImplementation(() => calls.push('notify'));
    renderContainer({ onSaved });
    const result = {
      outcome: ResourceSaveOutcome.Saved,
      savedId: 'id',
      isCreated: false,
      isNewVersion: false,
      isPublished: false,
    };
    const choice: ResourceSaveChoice = {
      resourceId: 'id',
      currentFolderPath: [],
      destination: flowPanelProps.destination,
      versionMode: SaveVersionMode.Keep,
      newVersion: '',
    };

    lastFlowParams().onSaved(result, choice);

    expect(notifySaved).toHaveBeenCalledWith(result, choice);
    expect(onSaved).toHaveBeenCalledWith(result);
    expect(calls).toEqual(['onSaved', 'notify']);
  });

  describe('duplicate name and version', () => {
    const conflictError = (code?: string) =>
      Object.assign(new Error('Conflict'), {
        response: new Response(JSON.stringify({ statusCode: 409, code }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }),
      });
    const flowAdapter = () => lastFlowParams().adapter;

    it('turns an agent duplicate on a new version into an inline panel message', async () => {
      const saveAsNewVersion = vi
        .fn()
        .mockRejectedValue(
          conflictError(ResourceNameConflictCode.NameTakenAgent),
        );
      renderContainer({
        adapter: { ...adapter, saveAsNewVersion } as ResourceSaveAdapter,
      });

      const error = await (
        flowAdapter() as {
          saveAsNewVersion: (v: string, f: string[]) => Promise<unknown>;
        }
      )
        .saveAsNewVersion('1.1.0', [])
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ResourceSaveError);
      expect((error as Error).message).toBe(
        AppsEditorI18nKeys.ErrorNameConflictAgent,
      );
    });

    it('names a toolset when the toolset holds the identity', async () => {
      const saveInPlace = vi
        .fn()
        .mockRejectedValue(
          conflictError(ResourceNameConflictCode.NameTakenToolset),
        );
      renderContainer({
        adapter: { ...adapter, saveInPlace } as ResourceSaveAdapter,
      });

      const error = await (
        flowAdapter() as { saveInPlace: () => Promise<unknown> }
      )
        .saveInPlace()
        .catch((e: unknown) => e);

      expect((error as Error).message).toBe(
        AppsEditorI18nKeys.ErrorNameConflictToolset,
      );
    });

    it('turns a create-only duplicate into the same inline message', async () => {
      const createIn = vi
        .fn()
        .mockRejectedValue(
          conflictError(ResourceNameConflictCode.NameTakenAgent),
        );
      renderContainer({
        adapter: {
          publishEntityType: 'application',
          isVersioned: false,
          createIn,
        } as ResourceSaveAdapter,
      });

      const error = await (
        flowAdapter() as { createIn: (f: string[]) => Promise<unknown> }
      )
        .createIn([])
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ResourceSaveError);
    });

    it('leaves a 409 without a duplicate code to the panel', async () => {
      const failure = conflictError();
      const saveAsNewVersion = vi.fn().mockRejectedValue(failure);
      renderContainer({
        adapter: { ...adapter, saveAsNewVersion } as ResourceSaveAdapter,
      });

      await expect(
        (
          flowAdapter() as {
            saveAsNewVersion: (v: string, f: string[]) => Promise<unknown>;
          }
        ).saveAsNewVersion('1.1.0', []),
      ).rejects.toBe(failure);
    });
  });

  it('renders the panel with the flow state and the title naming the resource type', () => {
    renderContainer();
    const props = lastPanelProps();
    expect(props.roots).toBe(flowPanelProps.roots);
    expect(props.onSubmit).toBe(flowPanelProps.onSubmit);
    expect(props.labels.title).toBe(
      `${ResourceSavePanelI18nKeys.Title}|${JSON.stringify({ type: 'QuickApp' })}`,
    );
  });
});
