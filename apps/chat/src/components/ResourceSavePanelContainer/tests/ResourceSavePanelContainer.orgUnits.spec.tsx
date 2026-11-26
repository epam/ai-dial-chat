import {
  createEmbeddedApplicationSaveAdapter,
  ResourceSaveOutcome,
  SaveDestinationRoot,
  type ResourceSaveAdapter,
} from '@epam/ai-dial-chat-hooks';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { render, waitFor } from '@testing-library/react';
import { act, useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OrgUnitAccessI18nKeys,
  ResourceSavePanelI18nKeys,
} from '../../../constants/translation-keys';
import { useFeatureFlag } from '../../../context/AppConfigContext';
import {
  OrgUnitsProvider,
  useOrgUnitsContext,
} from '../../../context/OrgUnitsContext';
import { usePublishFolders } from '../../../hooks/publish/usePublishFolders';
import { useResourceVersionHistory } from '../../../hooks/publish/useResourceVersionHistory';
import { listOrgUnits } from '../../../server-api/org-units.api';
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
  useAppConfig: () => ({ config: {} }),
  useFeatureFlag: vi.fn(),
}));
vi.mock('../../../server-api/org-units.api', () => ({
  listOrgUnits: vi.fn(),
}));
vi.mock('../../../server-api/publish.api', () => ({
  publishCatalogEntity: vi.fn(),
  publishApiClient: { checkPublishTarget: vi.fn() },
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
    t: (key: string, options?: { name?: string; folder?: string }) =>
      options?.name == null ? key : `${key}:${options.name}:${options.folder}`,
  }),
}));

const APP_ID = 'applications/b1/agent__1.0.0';

const applicationsApi = {
  moveApplication: vi.fn(),
  forkApplicationVersion: vi.fn(),
  commitApplicationVersion: vi.fn(),
  deleteApplication: vi.fn(),
};
const publishClient = { copyCatalogEntityToOrgUnit: vi.fn() };
const runEmbeddedSave = vi.fn();

const unit = (name: string, permissions: Record<string, string[]>) => ({
  id: name,
  name,
  displayName: name,
  path: `public/${name}`,
  folder: `public/${name}/`,
  permissions,
});

const DELIVERY = unit('Delivery', { applications: ['read', 'write'] });
const SALES = unit('Sales', { applications: ['read'] });
/* Keeps `Shared/Reports` listed (an ancestor of a unit) while it stays outside every unit. */
const SHARED_RISK = unit('Shared/Reports/Risk', {});

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

let refreshOrgUnits: () => void = () => undefined;
const RightsProbe = () => {
  const { refreshUnits } = useOrgUnitsContext();
  useEffect(() => {
    refreshOrgUnits = refreshUnits;
  }, [refreshUnits]);
  return null;
};

const renderEditorSave = async ({
  units = [DELIVERY, SALES, SHARED_RISK],
  hasAdminAccess = false,
  isFlagOn = true,
  isListFailing = false,
}: {
  units?: ReturnType<typeof unit>[];
  hasAdminAccess?: boolean;
  isFlagOn?: boolean;
  isListFailing?: boolean;
} = {}) => {
  vi.mocked(useFeatureFlag).mockReturnValue(isFlagOn);
  if (isListFailing) {
    vi.mocked(listOrgUnits).mockRejectedValue(new Error('boom'));
  } else {
    vi.mocked(listOrgUnits).mockResolvedValue({
      enabled: true,
      hasAdminAccess,
      units,
    });
  }
  const adapter: ResourceSaveAdapter = createEmbeddedApplicationSaveAdapter({
    applicationsApi,
    applicationId: APP_ID,
    runEmbeddedSave,
    getCommitFailedMessage: () => 'commit failed',
    publishClient,
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
        typeLabel="QuickApp"
        notifiableEntity={NotifiableEntity.QuickApp}
        canPublish
        onSaved={vi.fn()}
      />
      <RightsProbe />
    </OrgUnitsProvider>,
  );
  if (isFlagOn) await waitFor(() => expect(listOrgUnits).toHaveBeenCalled());
  /* Let the Ready state reach the panel's props. */
  await act(async () => undefined);
};

const chooseAndSave = async (destination: ReturnType<typeof organization>) => {
  act(() => lastPanel().onPendingDestinationChange(destination));
  /* Let the destination's pending checks settle before Save. */
  await act(async () => undefined);
  act(() => lastPanel().onDestinationChange(destination));
  await act(async () => lastPanel().onSubmit());
};

describe('ResourceSavePanelContainer with org units', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePublishFolders).mockReturnValue(organizationFolders);
    vi.mocked(useResourceVersionHistory).mockReturnValue(undefined);
    vi.mocked(publishCatalogEntity).mockResolvedValue({} as never);
    runEmbeddedSave.mockResolvedValue(undefined);
    publishClient.copyCatalogEntityToOrgUnit.mockResolvedValue({
      id: 'applications/public/Delivery/Teams/agent__1.0.0',
    });
  });

  it('saves a Quick App into a unit the user may write to, with no publication request', async () => {
    await renderEditorSave();

    await chooseAndSave(organization('Delivery', 'Teams'));

    await waitFor(() =>
      expect(publishClient.copyCatalogEntityToOrgUnit).toHaveBeenCalledWith(
        'application',
        APP_ID,
        { folderPath: 'Delivery/Teams' },
      ),
    );
    expect(runEmbeddedSave).toHaveBeenCalledOnce();
    expect(publishCatalogEntity).not.toHaveBeenCalled();
    expect(notifySaved).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: ResourceSaveOutcome.Saved,
        isWrittenToOrgUnit: true,
        isPublished: false,
      }),
      expect.objectContaining({ isDirectWrite: true }),
    );
  });

  it('does not let a read-only user save into the unit: the folder is disabled and nothing is sent', async () => {
    await renderEditorSave();
    act(() => lastPanel().onDestinationChange(organization('Sales', 'Q1')));
    await act(async () => undefined);

    expect(lastPanel().isSubmitDisabled).toBe(true);
    await act(async () => lastPanel().onSubmit());

    expect(publishCatalogEntity).not.toHaveBeenCalled();
    expect(publishClient.copyCatalogEntityToOrgUnit).not.toHaveBeenCalled();
    expect(runEmbeddedSave).not.toHaveBeenCalled();
  });

  it('keeps the old flow outside every unit: save in place, then a publication request', async () => {
    await renderEditorSave();

    await chooseAndSave(organization('Shared', 'Reports'));

    await waitFor(() =>
      expect(publishCatalogEntity).toHaveBeenCalledWith(
        'application',
        APP_ID,
        expect.objectContaining({ folderPath: 'Shared/Reports' }),
      ),
    );
    const [[, , body]] = vi.mocked(publishCatalogEntity).mock.calls;
    expect(body).not.toHaveProperty('rules');
    expect(publishClient.copyCatalogEntityToOrgUnit).not.toHaveBeenCalled();
    expect(runEmbeddedSave).toHaveBeenCalledOnce();
  });

  it('does not take the direct path for a DIAL admin outside every unit', async () => {
    await renderEditorSave({ hasAdminAccess: true });

    await chooseAndSave(organization('Shared', 'Reports'));

    await waitFor(() => expect(publishCatalogEntity).toHaveBeenCalledOnce());
    expect(publishClient.copyCatalogEntityToOrgUnit).not.toHaveBeenCalled();
  });

  it('lets a DIAL admin write directly inside a unit', async () => {
    await renderEditorSave({ hasAdminAccess: true });

    await chooseAndSave(organization('Sales', 'Q1'));

    await waitFor(() =>
      expect(publishClient.copyCatalogEntityToOrgUnit).toHaveBeenCalledOnce(),
    );
    expect(publishCatalogEntity).not.toHaveBeenCalled();
  });

  it('keeps the old flow for a unit folder while the flag is off, and reads no units', async () => {
    await renderEditorSave({ isFlagOn: false });

    await chooseAndSave(organization('Delivery', 'Teams'));

    await waitFor(() => expect(publishCatalogEntity).toHaveBeenCalledOnce());
    expect(listOrgUnits).not.toHaveBeenCalled();
    expect(publishClient.copyCatalogEntityToOrgUnit).not.toHaveBeenCalled();
  });

  it('keeps the old flow when the rights could not be read', async () => {
    vi.mocked(listOrgUnits).mockRejectedValue(new Error('boom'));
    vi.mocked(useFeatureFlag).mockReturnValue(true);
    const adapter = createEmbeddedApplicationSaveAdapter({
      applicationsApi,
      applicationId: APP_ID,
      runEmbeddedSave,
      getCommitFailedMessage: () => 'commit failed',
      publishClient,
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
          typeLabel="QuickApp"
          notifiableEntity={NotifiableEntity.QuickApp}
          canPublish
          onSaved={vi.fn()}
        />
      </OrgUnitsProvider>,
    );
    await waitFor(() => expect(listOrgUnits).toHaveBeenCalled());
    await act(async () => undefined);

    await chooseAndSave(organization('Delivery', 'Teams'));

    await waitFor(() => expect(publishCatalogEntity).toHaveBeenCalledOnce());
    expect(publishClient.copyCatalogEntityToOrgUnit).not.toHaveBeenCalled();
  });

  it('shows a refused direct write as a partial outcome, after the app was saved', async () => {
    publishClient.copyCatalogEntityToOrgUnit.mockRejectedValue(
      new Error('403'),
    );
    await renderEditorSave();

    await chooseAndSave(organization('Delivery', 'Teams'));

    await waitFor(() =>
      expect(notifySaved).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: ResourceSaveOutcome.SavedButOrgUnitWriteFailed,
        }),
        expect.anything(),
      ),
    );
    expect(runEmbeddedSave).toHaveBeenCalledOnce();
    expect(publishCatalogEntity).not.toHaveBeenCalled();
  });

  describe('disabled folders', () => {
    const personal = (...path: string[]) => ({
      rootKey: SaveDestinationRoot.Personal,
      path,
    });

    it('disables a unit folder the user may not write to, with the QuickApp reason', async () => {
      await renderEditorSave();

      expect(lastPanel().getDisabledReason?.(organization('Sales', 'Q1'))).toBe(
        OrgUnitAccessI18nKeys.NoSaveAccessQuickApp,
      );
    });

    it('keeps a unit folder the user may write to, and an ancestor of a unit, enabled', async () => {
      await renderEditorSave();

      expect(
        lastPanel().getDisabledReason?.(organization('Delivery', 'Teams')),
      ).toBeUndefined();
      expect(
        lastPanel().getDisabledReason?.(organization('Shared', 'Reports')),
      ).toBeUndefined();
    });

    it('disables a plain public folder the org-unit tree hides, such as one picked before the units loaded', async () => {
      await renderEditorSave();

      expect(
        lastPanel().getDisabledReason?.(organization('Plain', 'Folder')),
      ).toBe(OrgUnitAccessI18nKeys.FolderOutsideOrgUnits);
    });

    it('keeps a Personal folder named like a unit without write enabled', async () => {
      await renderEditorSave();

      expect(
        lastPanel().getDisabledReason?.(personal('Sales')),
      ).toBeUndefined();
      expect(
        lastPanel().getDisabledReason?.(personal('Sales', 'Q1')),
      ).toBeUndefined();
    });

    it('disables nothing while the flag is off', async () => {
      await renderEditorSave({ isFlagOn: false });

      expect(lastPanel().getDisabledReason).toBeUndefined();
      expect(listOrgUnits).not.toHaveBeenCalled();
    });

    it('disables nothing while the rights are not loaded', async () => {
      await renderEditorSave({ isListFailing: true });

      expect(lastPanel().getDisabledReason).toBeUndefined();
    });

    it('shows a committed destination that lost access as not allowed and disables Save', async () => {
      await renderEditorSave();
      act(() =>
        lastPanel().onDestinationChange(organization('Delivery', 'Teams')),
      );
      await act(async () => undefined);
      expect(lastPanel().isSubmitDisabled).toBe(false);

      vi.mocked(listOrgUnits).mockResolvedValue({
        enabled: true,
        hasAdminAccess: false,
        units: [unit('Delivery', { applications: ['read'] })],
      });
      await act(async () => refreshOrgUnits());
      await act(async () => undefined);

      expect(
        lastPanel().getDisabledReason?.(organization('Delivery', 'Teams')),
      ).toBe(OrgUnitAccessI18nKeys.NoSaveAccessQuickApp);
      expect(lastPanel().isSubmitDisabled).toBe(true);
    });

    it('does not save into a committed destination that lost access', async () => {
      await renderEditorSave();
      act(() =>
        lastPanel().onDestinationChange(organization('Delivery', 'Teams')),
      );
      vi.mocked(listOrgUnits).mockResolvedValue({
        enabled: true,
        hasAdminAccess: false,
        units: [unit('Delivery', { applications: ['read'] })],
      });
      await act(async () => refreshOrgUnits());
      await act(async () => undefined);

      await act(async () => lastPanel().onSubmit());

      expect(runEmbeddedSave).not.toHaveBeenCalled();
      expect(publishClient.copyCatalogEntityToOrgUnit).not.toHaveBeenCalled();
      expect(publishCatalogEntity).not.toHaveBeenCalled();
    });
  });
});

describe('ResourceSavePanelContainer taken name in a unit folder', () => {
  const UNIT_FOLDER = organization('Delivery', 'Teams');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePublishFolders).mockReturnValue(organizationFolders);
    vi.mocked(useResourceVersionHistory).mockReturnValue(undefined);
    vi.mocked(publishApiClient.checkPublishTarget).mockResolvedValue({
      taken: false,
    });
  });

  it('shows the reason naming the resource and the folder, and disables Save, for a taken name', async () => {
    vi.mocked(publishApiClient.checkPublishTarget).mockResolvedValue({
      taken: true,
    });
    await renderEditorSave();

    act(() => lastPanel().onDestinationChange(UNIT_FOLDER));
    await waitFor(() => expect(lastPanel().isSubmitDisabled).toBe(true));

    expect(publishApiClient.checkPublishTarget).toHaveBeenCalledWith(
      'application',
      APP_ID,
      'Delivery/Teams',
      undefined,
    );
    expect(lastPanel().getDisabledReason?.(UNIT_FOLDER)).toBe(
      `${ResourceSavePanelI18nKeys.TargetTaken}:Agent:Teams`,
    );
  });

  it('keeps Save enabled for a free name', async () => {
    await renderEditorSave();

    act(() => lastPanel().onDestinationChange(UNIT_FOLDER));
    await waitFor(() =>
      expect(publishApiClient.checkPublishTarget).toHaveBeenCalledOnce(),
    );

    expect(lastPanel().isSubmitDisabled).toBe(false);
    expect(lastPanel().getDisabledReason?.(UNIT_FOLDER)).toBeUndefined();
  });

  it('asks nothing for a folder outside every unit, which sends a publication request', async () => {
    await renderEditorSave();

    act(() => lastPanel().onDestinationChange(organization('EPAM')));
    await act(async () => undefined);

    expect(publishApiClient.checkPublishTarget).not.toHaveBeenCalled();
  });
});
