import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CatalogI18nKeys,
  ResourceSavePanelI18nKeys,
} from '../../../constants/translation-keys';
import { usePublishFolders } from '../../../hooks/publish/usePublishFolders';
import { useResourceSavePanel } from '../../../hooks/resource-save/useResourceSavePanel';
import type { ResourceSaveAdapter } from '../../../models/resource-save';
import { NotifiableEntity } from '../../../types/entity-notification';
import { SaveDestinationRoot } from '../../../types/resource-save';
import ResourceSavePanelContainer from '../ResourceSavePanelContainer';

const panelProps = vi.fn();
const personalFolders = {
  folderItems: [{ path: ['Design'], name: 'Design' }],
  expandedPaths: new Set<string>(),
  loadingPaths: new Set<string>(),
  onExpandedPathsChange: vi.fn(),
  onCreateFolder: vi.fn(),
  hasError: false,
  retry: vi.fn(),
};

vi.mock('@epam/ai-dial-publish-panel', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-publish-panel')>()),
  StandaloneSaveToFolderPanel: (props: Record<string, unknown>) => {
    panelProps(props);
    return null;
  },
}));

vi.mock('@epam/ai-dial-chat-hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-hooks')>()),
  useResourceFolders: vi.fn(() => personalFolders),
}));

vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: () => ({ config: { publicationFilterSources: ['roles'] } }),
}));
vi.mock('../../../server-api/publish-rules.api', () => ({
  getPublishRules: vi.fn(),
}));
vi.mock('../../../hooks/publish/usePublishFolders');
vi.mock('../../../hooks/resource-save/useResourceSavePanel');
vi.mock('../../../server-api/publish.api', () => ({
  publishCatalogEntity: vi.fn(),
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

const panelState = {
  destination: { rootKey: SaveDestinationRoot.Personal, path: [] },
  setDestination: vi.fn(),
  versionMode: 'keep',
  setVersionMode: vi.fn(),
  newVersion: '',
  setNewVersion: vi.fn(),
  markNewVersionTouched: vi.fn(),
  isSubmitting: false,
  isSubmitDisabled: false,
  submit: vi.fn().mockResolvedValue(undefined),
  rules: [],
  setRules: vi.fn(),
  isRulesLoading: false,
  hasRulesLoadError: false,
  setPendingDestination: vi.fn(),
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

const lastPanelProps = () =>
  panelProps.mock.lastCall?.[0] as Record<string, unknown> & {
    roots: { key: string; label: string }[];
    labels: { title: string };
    onCreateFolder: (root: string, parent: string[], name: string) => void;
    onSubmit: () => void;
    version?: unknown;
    foldersError?: string;
  };

describe('ResourceSavePanelContainer', () => {
  const organizationFolders = {
    folderItems: [{ path: ['EPAM'], name: 'EPAM' }],
    expandedPaths: new Set<string>(),
    loadedPaths: new Set<string>(),
    loadingPaths: new Set(['EPAM/']),
    onExpandedPathsChange: vi.fn(),
    onCreatePublishFolder: vi.fn(),
    rememberPublishFolder: vi.fn(),
    hasPublishWriteAccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePublishFolders).mockReturnValue(organizationFolders);
    vi.mocked(useResourceSavePanel).mockReturnValue(panelState as never);
  });

  it('offers the Personal and Organization roots, in that order', () => {
    renderContainer();
    const { roots } = lastPanelProps();
    expect(roots.map((root) => [root.key, root.label])).toEqual([
      [SaveDestinationRoot.Personal, CatalogI18nKeys.FolderPersonal],
      [SaveDestinationRoot.Organization, 'basic.organization'],
    ]);
  });

  it('takes access rules on Organization folders only, with the configured sources', () => {
    renderContainer();
    const props = lastPanelProps() as ReturnType<typeof lastPanelProps> & {
      roots: { hasAccessRules?: boolean }[];
      accessRules: { sourceOptions: string[]; onRulesChange: unknown };
      onPendingDestinationChange: unknown;
    };
    expect(props.roots.map((root) => Boolean(root.hasAccessRules))).toEqual([
      false,
      true,
    ]);
    expect(props.accessRules.sourceOptions).toEqual(['roles']);
    expect(props.accessRules.onRulesChange).toBe(panelState.setRules);
    expect(props.onPendingDestinationChange).toBe(
      panelState.setPendingDestination,
    );
  });

  it('translates Organization loading keys to plain folder keys', () => {
    renderContainer();
    const organization = lastPanelProps().roots[1] as unknown as {
      loadingPaths: Set<string>;
    };
    expect(organization.loadingPaths).toEqual(new Set(['EPAM']));
  });

  it('offers only the Personal root when the user cannot publish', () => {
    renderContainer({ canPublish: false });
    expect(lastPanelProps().roots.map((root) => root.key)).toEqual([
      SaveDestinationRoot.Personal,
    ]);
  });

  it('titles the panel with the resource type', () => {
    renderContainer();
    expect(lastPanelProps().labels.title).toBe(
      `${ResourceSavePanelI18nKeys.Title}|${JSON.stringify({ type: 'QuickApp' })}`,
    );
  });

  it('routes folder creation to the folder source of the chosen root', () => {
    renderContainer();
    const { onCreateFolder } = lastPanelProps();
    onCreateFolder(SaveDestinationRoot.Personal, ['Design'], 'Reviews');
    onCreateFolder(SaveDestinationRoot.Organization, ['EPAM'], 'Sales');
    expect(personalFolders.onCreateFolder).toHaveBeenCalledWith(
      ['Design'],
      'Reviews',
    );
    expect(organizationFolders.onCreatePublishFolder).toHaveBeenCalledWith(
      ['EPAM'],
      'Sales',
    );
  });

  it('offers the version choice only for a versioned resource', () => {
    renderContainer();
    expect(lastPanelProps().version).toBeDefined();
    renderContainer({
      adapter: { ...adapter, isVersioned: false },
      currentVersion: undefined,
    });
    expect(lastPanelProps().version).toBeUndefined();
  });

  it('shows a folder load error from the Personal listing', () => {
    personalFolders.hasError = true;
    renderContainer();
    expect(lastPanelProps().foldersError).toBe(
      ResourceSavePanelI18nKeys.FoldersLoadFailed,
    );
    personalFolders.hasError = false;
  });

  it('runs the save when the panel submits', () => {
    renderContainer();
    lastPanelProps().onSubmit();
    expect(panelState.submit).toHaveBeenCalledOnce();
  });
});
