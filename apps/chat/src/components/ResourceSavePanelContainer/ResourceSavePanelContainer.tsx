import { SEMVER_VERSION_PATTERN } from '@epam/ai-dial-builder-form';
import type { ResourceFoldersResponseDto } from '@epam/ai-dial-chat-api-client';
import {
  ResourceNameConflictKind,
  ResourceSaveVersionError,
  useResourceSavePanel,
  withResourceNameConflictMessages,
  type ResourceSaveAdapter,
  type ResourceSaveChoice,
  type ResourceSaveResult,
  type UseResourceSavePanelLabels,
} from '@epam/ai-dial-chat-hooks';
import type { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { StandaloneSaveToFolderPanel } from '@epam/ai-dial-publish-panel';
import type { FC, RefObject } from 'react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  CatalogI18nKeys,
  ConversationPublishI18nKeys,
  EditorI18nKeys,
  ResourceSavePanelI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import { usePublishFolders } from '../../hooks/publish/usePublishFolders';
import { useResourceSaveNotification } from '../../hooks/resource-save/useResourceSaveNotification';
import { getPublishRules } from '../../server-api/publish-rules.api';
import { publishCatalogEntity } from '../../server-api/publish.api';
import type { NotifiableEntity } from '../../types/entity-notification';
import {
  getAccessRulesLabels,
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

const publishClient = { publishCatalogEntity, getPublishRules };

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
  const {
    config: { publicationFilterSources },
  } = useAppConfig();
  const organization = usePublishFolders();
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
      accessRules: getAccessRulesLabels(t),
    }),
    [t],
  );

  const { panelProps } = useResourceSavePanel({
    isOpen,
    adapter,
    resourceId,
    currentFolderPath,
    currentVersion,
    versionPattern: SEMVER_VERSION_PATTERN,
    listPersonalFolders,
    organizationFolders: canPublish ? organization : undefined,
    publishClient,
    ruleSourceOptions: publicationFilterSources,
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

  return (
    <StandaloneSaveToFolderPanel
      {...panelProps}
      isOpen={isOpen}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      resource={resource}
      panelLabels={panelLabels}
      labels={labels}
    />
  );
};

export default memo(ResourceSavePanelContainer);
