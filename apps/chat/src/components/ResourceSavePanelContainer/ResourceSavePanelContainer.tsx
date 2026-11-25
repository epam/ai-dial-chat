import type {
  ApplicationValuesDependenciesRequestDto,
  ResourceFoldersResponseDto,
} from '@epam/ai-dial-chat-api-client';
import {
  getDependencyTypeOfNamespace,
  getMissingDirectWriteNamespaces,
  getOrgUnitNamespace,
  mapResourceDependencyDto,
  OrgUnitFolderGuardPurpose,
  OrgUnitsStatus,
  ResourceNameConflictKind,
  ResourceSaveVersionError,
  useResourceSavePanel,
  withResourceNameConflictMessages,
  type ResourceSaveAdapter,
  type ResourceSaveChoice,
  type ResourceSaveResult,
  type UseResourceSavePanelLabels,
} from '@epam/ai-dial-chat-hooks';
import {
  type CatalogEntityType,
  type OrgUnitNamespace,
  RESOURCE_VERSION_PATTERN,
} from '@epam/ai-dial-chat-shared';
import { StandaloneSaveToFolderPanel } from '@epam/ai-dial-publish-panel';
import type { FC, RefObject } from 'react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  CatalogI18nKeys,
  ConversationPublishI18nKeys,
  DialFileManagerI18nKeys,
  EditorI18nKeys,
  OrgUnitAccessI18nKeys,
  ResourceSavePanelI18nKeys,
} from '../../constants/translation-keys';
import { useFeatureFlag } from '../../context/AppConfigContext';
import { useOrgUnitsContext } from '../../context/OrgUnitsContext';
import { useOrgUnitFolderGuards } from '../../hooks/publish/useOrgUnitFolderGuards';
import { usePublishDependencyIconResolver } from '../../hooks/publish/usePublishDependencyIconResolver';
import { usePublishFolders } from '../../hooks/publish/usePublishFolders';
import { useResourceVersionHistory } from '../../hooks/publish/useResourceVersionHistory';
import {
  type SaveNotifiableEntity,
  useResourceSaveNotification,
} from '../../hooks/resource-save/useResourceSaveNotification';
import {
  publishApiClient,
  publishCatalogEntity,
} from '../../server-api/publish.api';
import { NotifiableEntity } from '../../types/entity-notification';
import {
  getPublishFolderLabel,
  getApplicationPublishDependenciesLabels,
  getPublishPanelCommonLabels,
} from '../../utils/publish';
import { RESOURCE_NAME_CONFLICT_KEYS } from '../../utils/resource-name-conflict';

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
  notifiableEntity: SaveNotifiableEntity;
  /** Schema display name, for `NotifiableEntity.SchemaApp` copy. */
  notificationType?: string;
  /** Whether the user may publish this resource, which offers the Organization root. */
  canPublish: boolean;
  /** Schema and form values whose private dependencies the panel lists for an Organization destination; omit for a resource with none to list. */
  dependencyValues?: ApplicationValuesDependenciesRequestDto;
  /** Whether the application's form state lives inside an embedded editor, so the panel shows one sentence about its dependencies instead of a list. Defaults to `false`. */
  isFormStateEmbedded?: boolean;
  /** Whether the application has an uploaded icon of the user's own, which a direct write into an org unit may be unable to copy. Defaults to `false`. */
  hasUploadedIcon?: boolean;
  /** Called once a save whose first step succeeded has finished. */
  onSaved: (result: ResourceSaveResult) => void;
  /** Focus target restored when the panel closes. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

const publishClient = {
  publishCatalogEntity,
  checkPublishTarget: (
    ...args: Parameters<typeof publishApiClient.checkPublishTarget>
  ) => publishApiClient.checkPublishTarget(...args),
};

/** App adapter for the Save panel: translated copy, notifications and the app's API clients around `useResourceSavePanel`. */
const ResourceSavePanelContainer: FC<Props> = ({
  isOpen,
  onClose,
  adapter: editorAdapter,
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
  dependencyValues,
  isFormStateEmbedded = false,
  hasUploadedIcon = false,
  onSaved,
  returnFocusRef,
}) => {
  const { t } = useTranslation();
  const adapter = useMemo(
    () =>
      withResourceNameConflictMessages(editorAdapter, {
        [ResourceNameConflictKind.Agent]: t(
          RESOURCE_NAME_CONFLICT_KEYS[ResourceNameConflictKind.Agent],
        ),
        [ResourceNameConflictKind.Toolset]: t(
          RESOURCE_NAME_CONFLICT_KEYS[ResourceNameConflictKind.Toolset],
        ),
      }),
    [editorAdapter, t],
  );
  const organization = usePublishFolders();
  const { canSaveDirectlyTo, getDisabledReason } = useOrgUnitFolderGuards({
    purpose: OrgUnitFolderGuardPurpose.Save,
    namespace: getOrgUnitNamespace(editorAdapter.publishEntityType),
    isActive: isOpen,
    isQuickApp: notifiableEntity === NotifiableEntity.QuickApp,
    shouldRefreshOnOpen: true,
  });
  const notifySaved = useResourceSaveNotification({
    resourceName,
    notifiableEntity,
    notificationType,
  });

  const handleSaved = useCallback(
    (result: ResourceSaveResult, choice: ResourceSaveChoice) => {
      // The host navigates in `onSaved`; notifying after it keeps the toast from preceding the redirect.
      onSaved(result);
      notifySaved(result, choice);
    },
    [notifySaved, onSaved],
  );

  const flowLabels = useMemo<UseResourceSavePanelLabels>(
    () => ({
      personalRoot: t(CatalogI18nKeys.FolderPersonal),
      organizationRoot: t(BasicI18nKeys.Organization),
      foldersLoadError: t(ResourceSavePanelI18nKeys.FoldersLoadFailed),
      saveError: t(ResourceSavePanelI18nKeys.SaveFailed),
      getVersionError: (error, version) => {
        if (error === ResourceSaveVersionError.Invalid) {
          return t(ResourceSavePanelI18nKeys.VersionInvalid);
        }
        if (error === ResourceSaveVersionError.Unchanged) {
          return t(ResourceSavePanelI18nKeys.VersionUnchanged, { version });
        }
        return t(ResourceSavePanelI18nKeys.VersionExists, { version });
      },
    }),
    [t],
  );

  const resolveDependencyIcon = usePublishDependencyIconResolver();
  const loadDependencies = useMemo(
    () =>
      dependencyValues &&
      (async () =>
        (
          await publishApiClient.getApplicationValuesPublishDependencies(
            dependencyValues,
          )
        ).dependencies.map((dependency) =>
          mapResourceDependencyDto(dependency, resolveDependencyIcon),
        )),
    [dependencyValues, resolveDependencyIcon],
  );

  const isOrgUnitsEnabled = useFeatureFlag('orgUnitsEnabled');
  const {
    status: orgUnitsStatus,
    canSaveDirectlyAt,
    hasAdminAccess,
  } = useOrgUnitsContext();
  const isFolderReferenceRuleOn =
    isOrgUnitsEnabled && orgUnitsStatus === OrgUnitsStatus.Ready;
  const getMissingNamespaces = useCallback(
    (folderPath: string[], namespaces: OrgUnitNamespace[]) =>
      getMissingDirectWriteNamespaces(
        {
          isEnabled: isOrgUnitsEnabled,
          status: orgUnitsStatus,
          canSaveDirectlyAt,
        },
        folderPath,
        namespaces,
      ),
    [canSaveDirectlyAt, isOrgUnitsEnabled, orgUnitsStatus],
  );
  const dependenciesLabels = useMemo(
    () => getApplicationPublishDependenciesLabels(t),
    [t],
  );

  const getMissingNamespacesReason = useCallback(
    (missing: OrgUnitNamespace[]) =>
      t(OrgUnitAccessI18nKeys.NoWriteAccessDependencies, {
        types: missing
          .flatMap((namespace) => {
            const type = getDependencyTypeOfNamespace(namespace);
            return (type && dependenciesLabels.typeLabels?.[type]) || [];
          })
          .join(', '),
      }),
    [dependenciesLabels, t],
  );

  const getTargetTakenReason = useCallback(
    (folderPath: string[], version?: string) =>
      t(
        version == null
          ? ResourceSavePanelI18nKeys.TargetTaken
          : ResourceSavePanelI18nKeys.TargetTakenVersion,
        {
          name: resourceName,
          version,
          folder: getPublishFolderLabel(folderPath, t),
        },
      ),
    [resourceName, t],
  );

  const { panelProps } = useResourceSavePanel({
    isOpen,
    adapter,
    resourceId,
    currentFolderPath,
    currentVersion,
    versionPattern: RESOURCE_VERSION_PATTERN,
    listPersonalFolders,
    organizationFolders: canPublish ? organization : undefined,
    publishClient,
    canSaveDirectlyTo,
    getDisabledReason,
    loadDependencies,
    getMissingNamespaces,
    getMissingNamespacesReason,
    getTargetTakenReason,
    hasAdminAccess: isFolderReferenceRuleOn ? hasAdminAccess : undefined,
    folderReferenceNote: t(ResourceSavePanelI18nKeys.DirectUnavailableFolder),
    dependenciesNote: isFormStateEmbedded
      ? t(ResourceSavePanelI18nKeys.DependenciesEmbeddedNote)
      : undefined,
    iconNote: hasUploadedIcon
      ? t(ResourceSavePanelI18nKeys.IconNotCopiedNotice)
      : undefined,
    labels: flowLabels,
    onSaved: handleSaved,
  });

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
      versionHeading: t(EditorI18nKeys.VersionLabel),
      keepVersionLabel: t(ResourceSavePanelI18nKeys.KeepVersion, {
        version: currentVersion,
      }),
      saveAsNewVersionLabel: t(ResourceSavePanelI18nKeys.SaveAsNewVersion),
      newVersionLabel: t(ResourceSavePanelI18nKeys.NewVersionLabel),
      newVersionPlaceholder: t(ResourceSavePanelI18nKeys.NewVersionPlaceholder),
      searchPlaceholder: t(CatalogI18nKeys.PublishFolderSearchPlaceholder),
      clearSearchAriaLabel: commonLabels.clearSearchAriaLabel,
      folderEmptyStateLabel: t(CatalogI18nKeys.PublishFolderEmptyState, {
        query: '{query}',
      }),
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
      createFolderSameAsParentNameError: t(
        ConversationPublishI18nKeys.SameAsParentFolderNameError,
      ),
      createFolderHiddenNameWarning: t(
        DialFileManagerI18nKeys.RenameHiddenItemWarning,
      ),
      retryLabel: t(ButtonsI18nKeys.Retry),
      createFolderFailedMessage: t(DialFileManagerI18nKeys.FolderCreateError),
    }),
    [
      commonLabels.addChildFolderLabel,
      commonLabels.addSiblingFolderLabel,
      commonLabels.clearSearchAriaLabel,
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

  const versionHistory = useResourceVersionHistory(
    resourceId,
    resourceType,
    isOpen && currentVersion != null,
  );

  return (
    <StandaloneSaveToFolderPanel
      {...panelProps}
      versionHistory={versionHistory}
      isOpen={isOpen}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      resource={resource}
      panelLabels={panelLabels}
      labels={labels}
      dependenciesLabels={dependenciesLabels}
    />
  );
};

export default memo(ResourceSavePanelContainer);
