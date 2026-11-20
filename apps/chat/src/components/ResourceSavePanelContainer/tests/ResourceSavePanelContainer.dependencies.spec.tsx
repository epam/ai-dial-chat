import {
  createEmbeddedApplicationSaveAdapter,
  SaveDestinationRoot,
  type ResourceSaveAdapter,
} from '@epam/ai-dial-chat-hooks';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { PublishDependenciesAppearance } from '@epam/ai-dial-publish-panel';
import { render, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OrgUnitAccessI18nKeys,
  PublishI18nKeys,
  ResourceSavePanelI18nKeys,
} from '../../../constants/translation-keys';
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
  dependenciesNote?: string;
  destinationNote?: string;
  dependenciesLabels: {
    title: string;
    description: string;
    appearance?: string;
  };
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
  useTranslation: () => ({
    t: (key: string, options?: { types?: string }) =>
      options?.types == null ? key : `${key}:${options.types}`,
  }),
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
  extraProps: {
    isFormStateEmbedded?: boolean;
    hasUploadedIcon?: boolean;
  } = {},
  permissions: Record<string, string[]> = DELIVERY.permissions,
) => {
  vi.mocked(useFeatureFlag).mockReturnValue(true);
  vi.mocked(listOrgUnits).mockResolvedValue({
    enabled: true,
    hasAdminAccess: false,
    units: [{ ...DELIVERY, permissions }],
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
        {...extraProps}
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

  it('words the section as dependencies published together with the application', async () => {
    await renderSchemaAppSave();

    expect(lastPanel().dependenciesLabels).toEqual(
      expect.objectContaining({
        title: PublishI18nKeys.DependenciesPublishedTitle,
        description: PublishI18nKeys.DependenciesPublishedDescription,
        appearance: PublishDependenciesAppearance.Published,
      }),
    );
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

  describe('namespaces, the embedded-editor sentence and the icon notice', () => {
    const UNIT_FOLDER = organization('Delivery', 'Teams');
    const APPLICATIONS_ONLY = { applications: ['read', 'write'] };

    it('disables a unit folder whose dependency namespace the user cannot write, naming the type', async () => {
      await renderSchemaAppSave(VALUES, {}, APPLICATIONS_ONLY);

      await chooseDestination(UNIT_FOLDER);
      await waitFor(() => expect(lastPanel().dependencies).toHaveLength(1));

      expect(lastPanel().getDisabledReason?.(UNIT_FOLDER)).toBe(
        `${OrgUnitAccessI18nKeys.NoWriteAccessDependencies}:${PublishI18nKeys.DependenciesTypePrompt}`,
      );
      expect(lastPanel().isSubmitDisabled).toBe(true);
    });

    it('leaves the unit folder usable when the dependency namespaces are writable', async () => {
      await renderSchemaAppSave(
        VALUES,
        {},
        {
          applications: ['read', 'write'],
          prompts: ['read', 'write'],
        },
      );

      await chooseDestination(UNIT_FOLDER);
      await waitFor(() => expect(lastPanel().dependencies).toHaveLength(1));

      expect(lastPanel().getDisabledReason?.(UNIT_FOLDER)).toBeUndefined();
      expect(lastPanel().isSubmitDisabled).toBe(false);
    });

    it('shows the neutral sentence, and no list, for an embedded editor under Organization only', async () => {
      await renderSchemaAppSave(null, { isFormStateEmbedded: true });
      expect(lastPanel().dependenciesNote).toBeUndefined();

      await chooseDestination(organization('EPAM'));

      expect(lastPanel().dependenciesNote).toBe(
        ResourceSavePanelI18nKeys.DependenciesEmbeddedNote,
      );
      expect(lastPanel().dependencies).toEqual([]);
    });

    it('shows no sentence for a kind that is not embedded', async () => {
      await renderSchemaAppSave(null);

      await chooseDestination(organization('EPAM'));

      expect(lastPanel().dependenciesNote).toBeUndefined();
    });

    it('shows the icon notice for a unit folder where files are not writable', async () => {
      await renderSchemaAppSave(
        null,
        { hasUploadedIcon: true },
        APPLICATIONS_ONLY,
      );

      await chooseDestination(UNIT_FOLDER);

      expect(lastPanel().destinationNote).toBe(
        ResourceSavePanelI18nKeys.IconNotCopiedNotice,
      );
      expect(lastPanel().isSubmitDisabled).toBe(false);
    });

    it.each([
      [
        'files are writable',
        { hasUploadedIcon: true },
        { applications: ['read', 'write'], files: ['read', 'write'] },
      ],
      ['the application has no uploaded icon', {}, APPLICATIONS_ONLY],
    ])(
      'shows no icon notice when %s',
      async (_name, extraProps, permissions) => {
        await renderSchemaAppSave(null, extraProps, permissions);

        await chooseDestination(UNIT_FOLDER);

        expect(lastPanel().destinationNote).toBeUndefined();
      },
    );
  });
});
