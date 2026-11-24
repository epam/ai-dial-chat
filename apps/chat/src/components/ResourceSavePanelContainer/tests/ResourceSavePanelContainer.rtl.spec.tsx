import {
  createEmbeddedApplicationSaveAdapter,
  SaveDestinationRoot,
} from '@epam/ai-dial-chat-hooks';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { type SaveToFolderPanelProps } from '@epam/ai-dial-publish-panel';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResourceSavePanelI18nKeys } from '../../../constants/translation-keys';
import { useFeatureFlag } from '../../../context/AppConfigContext';
import { OrgUnitsProvider } from '../../../context/OrgUnitsContext';
import { usePublishFolders } from '../../../hooks/publish/usePublishFolders';
import { useResourceVersionHistory } from '../../../hooks/publish/useResourceVersionHistory';
import { listOrgUnits } from '../../../server-api/org-units.api';
import { NotifiableEntity } from '../../../types/entity-notification';
import ResourceSavePanelContainer from '../ResourceSavePanelContainer';

/* The real panel body stands in for the drawer shell, so the notes are rendered by the library under `dir="rtl"`. */
vi.mock('@epam/ai-dial-publish-panel', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-publish-panel')>();
  return {
    ...actual,
    StandaloneSaveToFolderPanel: (props: SaveToFolderPanelProps) => (
      <>
        <button
          type="button"
          onClick={() =>
            props.onDestinationChange({
              rootKey: SaveDestinationRoot.Organization,
              path: ['Delivery', 'Teams'],
            })
          }
        >
          Pick unit folder
        </button>
        <actual.SaveToFolderPanel
          {...props}
          view={actual.SaveToFolderView.Main}
        />
      </>
    ),
  };
});
vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: () => ({ config: {} }),
  useFeatureFlag: vi.fn(),
}));
vi.mock('../../../server-api/org-units.api', () => ({
  listOrgUnits: vi.fn(),
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
  useResourceSaveNotification: () => vi.fn(),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const APP_ID = 'applications/b1/agent__1.0.0';

describe('ResourceSavePanelContainer — notes in a right-to-left page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useFeatureFlag).mockReturnValue(true);
    vi.mocked(useResourceVersionHistory).mockReturnValue(undefined);
    vi.mocked(usePublishFolders).mockReturnValue({
      folderItems: [],
      expandedPaths: new Set<string>(),
      loadedPaths: new Set<string>(),
      loadingPaths: new Set<string>(),
      onExpandedPathsChange: vi.fn(),
      onCreatePublishFolder: vi.fn(),
      rememberPublishFolder: vi.fn(),
      hasPublishWriteAccess: vi.fn(),
    });
    vi.mocked(listOrgUnits).mockResolvedValue({
      enabled: true,
      hasAdminAccess: false,
      units: [
        {
          id: 'Delivery',
          name: 'Delivery',
          displayName: 'Delivery',
          path: 'public/Delivery',
          folder: 'public/Delivery/',
          permissions: { applications: ['read', 'write'] },
        },
      ],
    });
  });

  it('renders the embedded-editor sentence and the icon notice as plain text in reading order', async () => {
    render(
      <div dir="rtl">
        <OrgUnitsProvider>
          <ResourceSavePanelContainer
            isOpen
            onClose={vi.fn()}
            adapter={createEmbeddedApplicationSaveAdapter({
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
            })}
            listPersonalFolders={vi.fn().mockResolvedValue({ folders: [] })}
            resourceId={APP_ID}
            currentFolderPath={[]}
            resourceName="Agent"
            currentVersion="1.0.0"
            resourceType={CatalogEntityType.Agent}
            typeLabel="App"
            notifiableEntity={NotifiableEntity.QuickApp}
            canPublish
            isFormStateEmbedded
            hasUploadedIcon
            onSaved={vi.fn()}
          />
        </OrgUnitsProvider>
      </div>,
    );
    await waitFor(() => expect(listOrgUnits).toHaveBeenCalled());

    await userEvent.click(
      screen.getByRole('button', { name: 'Pick unit folder' }),
    );

    const icon = await screen.findByText(
      ResourceSavePanelI18nKeys.IconNotCopiedNotice,
    );
    const dependencies = screen.getByText(
      ResourceSavePanelI18nKeys.DependenciesEmbeddedNote,
    );
    expect(
      icon.compareDocumentPosition(dependencies) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    for (const note of [icon, dependencies]) {
      expect(note.className).not.toMatch(/\b(ml|mr|pl|pr|left|right)-/);
    }
    for (const region of screen.queryAllByRole('alert')) {
      expect(region.textContent).not.toContain(
        ResourceSavePanelI18nKeys.IconNotCopiedNotice,
      );
    }
    expect(screen.queryAllByRole('status')).toHaveLength(0);
  });
});
