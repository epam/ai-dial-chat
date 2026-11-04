import type { ResourceFoldersResponseDto } from '@epam/ai-dial-chat-api-client';
import { toPublishRuleDto, useResourceFolders } from '@epam/ai-dial-chat-hooks';
import type { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import {
  StandaloneSaveToFolderPanel,
  type FolderDestinationRoot,
} from '@epam/ai-dial-publish-panel';
import type { FC, RefObject } from 'react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  CatalogI18nKeys,
  ConversationPublishI18nKeys,
  ResourceSavePanelI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import { usePublishFolders } from '../../hooks/publish/usePublishFolders';
import { useResourceSavePanel } from '../../hooks/resource-save/useResourceSavePanel';
import type {
  PublishSavedResource,
  ResourceSaveAdapter,
  ResourceSaveResult,
} from '../../models/resource-save';
import { getPublishRules } from '../../server-api/publish-rules.api';
import { publishCatalogEntity } from '../../server-api/publish.api';
import type { NotifiableEntity } from '../../types/entity-notification';
import { SaveDestinationRoot } from '../../types/resource-save';
import {
  getAccessRulesLabels,
  getPublishPanelCommonLabels,
} from '../../utils/publish';

interface Props {
  /** Whether the panel is open. */
  isOpen: boolean;
  /** Called when the panel asks to close without saving. */
  onClose: () => void;
  /** The resource-specific save operations. */
  adapter: ResourceSaveAdapter;
  /** Lists one level of the resource type's Personal folders. */
  listPersonalFolders: (path: string) => Promise<ResourceFoldersResponseDto>;
  /** Full id of the saved resource being edited. */
  resourceId: string;
  /** Its current Personal folder. */
  currentFolderPath: string[];
  /** Display name. */
  resourceName: string;
  /** Current version; omit for an unversioned resource. */
  currentVersion?: string;
  /** Catalog type of the resource, for the summary badge. */
  resourceType: CatalogEntityType;
  /** Resolved icon URL for the summary, if any. */
  iconUrl?: string;
  /** Translated resource type for the panel title, e.g. "QuickApp". */
  typeLabel: string;
  /** Entity the notifications name. */
  notifiableEntity: NotifiableEntity;
  /** Schema display name, for `NotifiableEntity.SchemaApp` copy. */
  notificationType?: string;
  /** Whether the user may publish this resource, which offers the Organization root. */
  canPublish: boolean;
  /** Called once a save whose first step succeeded has finished. */
  onSaved: (result: ResourceSaveResult) => void;
  /** Focus target restored when the panel closes. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/* `usePublishFolders` keys loading folders by API path (`a/b/`); the tree takes plain path keys. */
const toFolderKeys = (apiPaths: Set<string>): Set<string> =>
  new Set([...apiPaths].map((apiPath) => apiPath.replace(/\/$/, '')));

const publishSavedResource: PublishSavedResource = async (
  entityType,
  id,
  folderPath,
  version,
  rules,
) => {
  await publishCatalogEntity(entityType, id, {
    folderPath: folderPath.join('/'),
    ...(version ? { version } : {}),
    rules: rules.map(toPublishRuleDto),
  });
};

const fetchFolderRules = (folderPath: string[]) =>
  getPublishRules(folderPath.join('/'));

/** App adapter for the Save panel: Personal and Organization folders, translated copy, and the save run. */
const ResourceSavePanelContainer: FC<Props> = ({
  isOpen,
  onClose,
  adapter,
  listPersonalFolders,
  resourceId,
  currentFolderPath,
  resourceName,
  currentVersion,
  resourceType,
  iconUrl,
  typeLabel,
  notifiableEntity,
  notificationType,
  canPublish,
  onSaved,
  returnFocusRef,
}) => {
  const { t } = useTranslation();
  const {
    config: { publicationFilterSources },
  } = useAppConfig();
  const personal = useResourceFolders({
    listFolders: listPersonalFolders,
    isEnabled: isOpen,
  });
  const organization = usePublishFolders();

  const panel = useResourceSavePanel({
    isOpen,
    adapter,
    resourceId,
    currentFolderPath,
    resourceName,
    currentVersion,
    notifiableEntity,
    notificationType,
    publish: publishSavedResource,
    rememberPublishFolder: organization.rememberPublishFolder,
    onSaved,
    fetchRules: fetchFolderRules,
  });

  const organizationLoadingPaths = useMemo(
    () => toFolderKeys(organization.loadingPaths),
    [organization.loadingPaths],
  );
  const roots = useMemo<FolderDestinationRoot[]>(() => {
    const personalRoot: FolderDestinationRoot = {
      key: SaveDestinationRoot.Personal,
      label: t(CatalogI18nKeys.FolderPersonal),
      items: personal.folderItems,
      expandedPaths: personal.expandedPaths,
      onExpandedPathsChange: personal.onExpandedPathsChange,
      loadingPaths: personal.loadingPaths,
    };
    if (!canPublish) return [personalRoot];
    return [
      personalRoot,
      {
        key: SaveDestinationRoot.Organization,
        label: t(BasicI18nKeys.Organization),
        items: organization.folderItems,
        expandedPaths: organization.expandedPaths,
        onExpandedPathsChange: organization.onExpandedPathsChange,
        loadingPaths: organizationLoadingPaths,
        hasAccessRules: true,
      },
    ];
  }, [
    canPublish,
    organization.expandedPaths,
    organization.folderItems,
    organization.onExpandedPathsChange,
    organizationLoadingPaths,
    personal.expandedPaths,
    personal.folderItems,
    personal.loadingPaths,
    personal.onExpandedPathsChange,
    t,
  ]);

  const { onCreateFolder: onCreatePersonalFolder } = personal;
  const { onCreatePublishFolder } = organization;
  const handleCreateFolder = useCallback(
    (rootKey: string, parentPath: string[], name: string) =>
      rootKey === SaveDestinationRoot.Organization
        ? onCreatePublishFolder(parentPath, name)
        : onCreatePersonalFolder(parentPath, name),
    [onCreatePersonalFolder, onCreatePublishFolder],
  );

  const resource = useMemo(
    () => ({
      title: resourceName,
      version: currentVersion,
      type: resourceType,
      iconUrl,
    }),
    [currentVersion, iconUrl, resourceName, resourceType],
  );

  const commonLabels = getPublishPanelCommonLabels(t);
  const panelLabels = useMemo(
    () => ({
      saveToFolderHeading: t(ResourceSavePanelI18nKeys.SaveToFolderHeading),
      changeFolderLabel: t(ResourceSavePanelI18nKeys.ChangeFolder),
      destinationAriaLabel: t(ResourceSavePanelI18nKeys.DestinationAriaLabel),
      versionHeading: t(ResourceSavePanelI18nKeys.VersionHeading),
      keepVersionLabel: t(ResourceSavePanelI18nKeys.KeepVersion, {
        version: currentVersion,
      }),
      saveAsNewVersionLabel: t(ResourceSavePanelI18nKeys.SaveAsNewVersion),
      newVersionLabel: t(ResourceSavePanelI18nKeys.NewVersionLabel),
      newVersionPlaceholder: t(ResourceSavePanelI18nKeys.NewVersionPlaceholder),
      searchPlaceholder: t(CatalogI18nKeys.PublishFolderSearchPlaceholder),
      clearSearchAriaLabel: commonLabels.clearSearchAriaLabel,
      folderEmptyStateLabel: t(CatalogI18nKeys.PublishFolderEmptyState),
      cancelCreatingFolderLabel: t(ButtonsI18nKeys.Cancel),
      addSiblingFolderLabel: commonLabels.addSiblingFolderLabel,
      addChildFolderLabel: commonLabels.addChildFolderLabel,
      createFolderEmptyNameError: t(
        ConversationPublishI18nKeys.EmptyFolderNameError,
      ),
      createFolderInvalidNameError: t(
        ConversationPublishI18nKeys.InvalidFolderNameError,
      ),
      createFolderDuplicateNameError: t(
        ConversationPublishI18nKeys.DuplicateFolderNameError,
      ),
      retryLabel: t(ButtonsI18nKeys.Retry),
      summaryVersionLabel: commonLabels.summaryVersionLabel,
    }),
    [
      commonLabels.addChildFolderLabel,
      commonLabels.addSiblingFolderLabel,
      commonLabels.clearSearchAriaLabel,
      commonLabels.summaryVersionLabel,
      currentVersion,
      t,
    ],
  );
  const labels = useMemo(
    () => ({
      title: t(ResourceSavePanelI18nKeys.Title, { type: typeLabel }),
      changeFolderTitle: t(ResourceSavePanelI18nKeys.ChangeFolderTitle),
      closeAriaLabel: t(ButtonsI18nKeys.Close),
      backAriaLabel: t(ButtonsI18nKeys.Back),
      cancelLabel: t(ButtonsI18nKeys.Cancel),
      saveLabel: t(ButtonsI18nKeys.Save),
      savingLabel: t(ButtonsI18nKeys.Saving),
      selectLabel: t(ButtonsI18nKeys.Select),
    }),
    [t, typeLabel],
  );

  const version = useMemo(
    () =>
      adapter.isVersioned && currentVersion != null
        ? {
            versionMode: panel.versionMode,
            onVersionModeChange: panel.setVersionMode,
            currentVersion,
            newVersion: panel.newVersion,
            onNewVersionChange: panel.setNewVersion,
            onNewVersionBlur: panel.markNewVersionTouched,
            newVersionError: panel.newVersionError,
          }
        : undefined,
    [
      adapter.isVersioned,
      currentVersion,
      panel.markNewVersionTouched,
      panel.newVersion,
      panel.newVersionError,
      panel.setNewVersion,
      panel.setVersionMode,
      panel.versionMode,
    ],
  );

  const accessRulesLabels = useMemo(() => getAccessRulesLabels(t), [t]);
  const accessRules = useMemo(
    () => ({
      rules: panel.rules,
      onRulesChange: panel.setRules,
      sourceOptions: publicationFilterSources,
      isLoading: panel.isRulesLoading,
      hasLoadError: panel.hasRulesLoadError,
      labels: accessRulesLabels,
    }),
    [
      accessRulesLabels,
      panel.hasRulesLoadError,
      panel.isRulesLoading,
      panel.rules,
      panel.setRules,
      publicationFilterSources,
    ],
  );

  const { submit } = panel;
  const handleSubmit = useCallback(() => void submit(), [submit]);

  return (
    <StandaloneSaveToFolderPanel
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      isSubmitDisabled={panel.isSubmitDisabled}
      isSubmitting={panel.isSubmitting}
      submitError={panel.submitError}
      returnFocusRef={returnFocusRef}
      resource={resource}
      roots={roots}
      destination={panel.destination}
      onDestinationChange={panel.setDestination}
      onCreateFolder={handleCreateFolder}
      version={version}
      accessRules={accessRules}
      onPendingDestinationChange={panel.setPendingDestination}
      foldersError={
        personal.hasError
          ? t(ResourceSavePanelI18nKeys.FoldersLoadFailed)
          : undefined
      }
      onRetryFolders={personal.retry}
      panelLabels={panelLabels}
      labels={labels}
    />
  );
};

export default memo(ResourceSavePanelContainer);
