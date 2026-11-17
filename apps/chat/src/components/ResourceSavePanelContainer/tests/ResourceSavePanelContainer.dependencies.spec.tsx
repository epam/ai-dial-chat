import {
  createEmbeddedApplicationSaveAdapter,
  SaveDestinationRoot,
  type ResourceSaveAdapter,
} from '@epam/ai-dial-chat-hooks';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { render, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeatureFlag } from '../../../context/AppConfigContext';
import { OrgUnitsProvider } from '../../../context/OrgUnitsContext';
import { usePublishFolders } from '../../../hooks/publish/usePublishFolders';
import { useResourceVersionHistory } from '../../../hooks/publish/useResourceVersionHistory';
import { listOrgUnits } from '../../../server-api/org-units.api';
import { getPublishRules } from '../../../server-api/publish-rules.api';
import {
  publishApiClient,
  publishCatalogEntity,
} from '../../../server-api/publish.api';
import { NotifiableEntity } from '../../../types/entity-notification';
import ResourceSavePanelContainer from '../ResourceSavePanelContainer';

type PanelProps = {
  onSubmit: () => void;
  onDestinationChange: (destination: {
    rootKey: string;
    path: string[];
  }) => void;
  onPendingDestinationChange: (
    destination: { rootKey: string; path: string[] } | undefined,
  ) => void;
  isSubmitDisabled?: boolean;
  getDisabledReason?: (destination: {
    rootKey: string;
    path: string[];
  }) => string | undefined;
  dependencies: unknown[];
  accessRules: {
    isHiddenFor: (destination: { rootKey: string; path: string[] }) => boolean;
  };
};

const panelProps = vi.fn<(props: PanelProps) => void>();
const notifySaved = vi.fn();

vi.mock('@epam/ai-dial-publish-panel', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-publish-panel')>()),
  StandaloneSaveToFolderPanel: (props: PanelProps) => {
    panelProps(props);
    return null;
  },
}));
vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: () => ({ config: { publicationFilterSources: ['roles'] } }),
  useFeatureFlag: vi.fn(),
}));
vi.mock('../../../server-api/org-units.api', () => ({
  listOrgUnits: vi.fn(),
}));
vi.mock('../../../server-api/publish-rules.api', () => ({
  getPublishRules: vi.fn(),
}));
vi.mock('../../../server-api/publish.api', () => ({
  publishCatalogEntity: vi.fn(),
  publishApiClient: { getApplicationValuesPublishDependencies: vi.fn() },
}));
vi.mock('../../../hooks/publish/usePublishFolders');
vi.mock('../../../hooks/publish/useResourceVersionHistory');
vi.mock('../../../hooks/publish/usePublishDependencyIconResolver', () => ({
  usePublishDependencyIconResolver: () => undefined,
}));
vi.mock('../../../hooks/resource-save/useResourceSaveNotification', () => ({
  useResourceSaveNotification: () => notifySaved,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const APP_ID = 'applications/b1/agent__1.0.0';
const VALUES = {
  schemaId: 'https://schema/form',
  properties: { skills: [{ url: 'prompts/b1/Hi' }] },
};
const DEPENDENCY_DTO = {
  id: 'prompts/b1/Hi',
  name: 'Hi',
  type: 'prompt',
  location: '',
};

const DELIVERY = {
  id: 'Delivery',
  name: 'Delivery',
  displayName: 'Delivery',
  path: 'public/Delivery',
  folder: 'public/Delivery/',
  permissions: { applications: ['read', 'write'] },
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

const lastPanel = () => panelProps.mock.lastCall?.[0] as PanelProps;
const organization = (...path: string[]) => ({
  rootKey: SaveDestinationRoot.Organization,
  path,
});

const renderSchemaAppSave = async (
  dependencyValues: typeof VALUES | null = VALUES,
) => {
  vi.mocked(useFeatureFlag).mockReturnValue(true);
  vi.mocked(listOrgUnits).mockResolvedValue({
    enabled: true,
    hasAdminAccess: false,
    units: [DELIVERY],
  });
  const adapter: ResourceSaveAdapter = createEmbeddedApplicationSaveAdapter({
    applicationsApi: {
      moveApplication: vi.fn(),
      forkApplicationVersion: vi.fn(),
      commitApplicationVersion: vi.fn(),
      deleteApplication: vi.fn(),
    },
    applicationId: APP_ID,
    runEmbeddedSave: vi.fn(),
    getCommitFailedMessage: () => 'commit failed',
    publishClient: { copyCatalogEntityToOrgUnit: vi.fn() },
  });
  render(
    <OrgUnitsProvider>
      <ResourceSavePanelContainer
        isOpen
        onClose={vi.fn()}
        adapter={adapter}
        listPersonalFolders={vi.fn().mockResolvedValue({ folders: [] })}
        resourceId={APP_ID}
        currentFolderPath={[]}
        resourceName="Agent"
        currentVersion="1.0.0"
        resourceType={CatalogEntityType.Agent}
        typeLabel="App"
        notifiableEntity={NotifiableEntity.QuickApp}
        canPublish
        dependencyValues={dependencyValues ?? undefined}
        onSaved={vi.fn()}
      />
    </OrgUnitsProvider>,
  );
  await waitFor(() => expect(listOrgUnits).toHaveBeenCalled());
  await act(async () => undefined);
};

const chooseDestination = async (
  destination: ReturnType<typeof organization>,
) => {
  act(() => lastPanel().onPendingDestinationChange(destination));
  await act(async () => undefined);
  act(() => lastPanel().onDestinationChange(destination));
  await act(async () => undefined);
};

describe('ResourceSavePanelContainer private dependencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePublishFolders).mockReturnValue(organizationFolders);
    vi.mocked(useResourceVersionHistory).mockReturnValue(undefined);
    vi.mocked(getPublishRules).mockResolvedValue([]);
    vi.mocked(publishCatalogEntity).mockResolvedValue({} as never);
    vi.mocked(
      publishApiClient.getApplicationValuesPublishDependencies,
    ).mockResolvedValue({ dependencies: [DEPENDENCY_DTO] } as never);
  });

  it('lists nothing and reads nothing for the Personal root', async () => {
    await renderSchemaAppSave();

    expect(lastPanel().dependencies).toEqual([]);
    expect(
      publishApiClient.getApplicationValuesPublishDependencies,
    ).not.toHaveBeenCalled();
  });

  it('lists them for a public-folder save that sends a publication request', async () => {
    await renderSchemaAppSave();
    const folder = organization('EPAM');
    expect(lastPanel().accessRules.isHiddenFor(folder)).toBe(false);

    await chooseDestination(folder);

    await waitFor(() =>
      expect(lastPanel().dependencies).toEqual([
        expect.objectContaining({ id: 'prompts/b1/Hi', name: 'Hi' }),
      ]),
    );
    expect(
      publishApiClient.getApplicationValuesPublishDependencies,
    ).toHaveBeenCalledWith(VALUES);
  });

  it('lists them for a direct write into an org unit the user may write to', async () => {
    await renderSchemaAppSave();
    const unitFolder = organization('Delivery', 'Teams');
    expect(lastPanel().accessRules.isHiddenFor(unitFolder)).toBe(true);

    await chooseDestination(unitFolder);

    await waitFor(() =>
      expect(lastPanel().dependencies).toEqual([
        expect.objectContaining({ id: 'prompts/b1/Hi' }),
      ]),
    );
    expect(
      publishApiClient.getApplicationValuesPublishDependencies,
    ).toHaveBeenCalledWith(VALUES);
  });

  it('lists nothing for a kind that passes no values, even under Organization', async () => {
    await renderSchemaAppSave(null);

    await chooseDestination(organization('EPAM'));

    expect(lastPanel().dependencies).toEqual([]);
    expect(
      publishApiClient.getApplicationValuesPublishDependencies,
    ).not.toHaveBeenCalled();
  });

  it('keeps Save enabled and lists nothing when the read fails', async () => {
    vi.mocked(
      publishApiClient.getApplicationValuesPublishDependencies,
    ).mockRejectedValue(new Error('boom'));
    await renderSchemaAppSave();

    await chooseDestination(organization('EPAM'));

    expect(lastPanel().dependencies).toEqual([]);
    expect(lastPanel().isSubmitDisabled).toBe(false);
  });
});
