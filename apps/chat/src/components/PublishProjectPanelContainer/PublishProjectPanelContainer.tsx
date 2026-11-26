import {
  mapPublishHistoryEntryDto,
  mapResourceDependencyDto,
  usePublishDependencies,
  usePublishTargetGuard,
  usePublishHistory,
  OrgUnitFolderGuardPurpose,
  toPublishDisabledReason,
} from '@epam/ai-dial-chat-hooks';
import { OrgUnitNamespace } from '@epam/ai-dial-chat-shared';
import {
  PublishResourceSummary,
  StandalonePublishPanel,
  usePublishFlow,
} from '@epam/ai-dial-publish-panel';
import {
  Notification,
  NotificationType,
  NotificationVariant,
} from '@epam/ai-dial-ui-kit';
import type { FC, RefObject } from 'react';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  ProjectsI18nKeys,
  PublishI18nKeys,
  ResourceSavePanelI18nKeys,
} from '../../constants/translation-keys';
import { useOrgUnitFolderGuards } from '../../hooks/publish/useOrgUnitFolderGuards';
import { usePublishDependencyIconResolver } from '../../hooks/publish/usePublishDependencyIconResolver';
import { usePublishErrorNotification } from '../../hooks/publish/usePublishErrorNotification';
import { usePublishFolders } from '../../hooks/publish/usePublishFolders';
import { useOperationNotification } from '../../hooks/useOperationNotification';
import { useUserProfile } from '../../hooks/user-profile/useUserProfile';
import {
  CatalogPublishEntityType,
  getCatalogPublishDependencies,
  getCatalogPublishHistory,
  publishApiClient,
  publishCatalogEntity,
} from '../../server-api/publish.api';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../types/entity-notification';
import {
  getPublishAuthorLabels,
  getPublishApprovalLabels,
  getPublishDependenciesLabels,
  getPublishFooterProgressLabels,
  getPublishPanelCommonLabels,
  getPublishFolderLabel,
} from '../../utils/publish';

/** Props for `PublishProjectPanelContainer`. */
interface Props {
  /** Whether the panel is open (controls the slide-in animation and backdrop). */
  isOpen: boolean;
  /** The project's DIAL Core id, used as the publish `entityId`. */
  projectId: string;
  /** The project's name, shown in the summary row. */
  projectName: string;
  /** Number of chats stored in the project; a warning says they are published with it. */
  conversationCount?: number;
  /** Called when the panel should be dismissed. */
  onClose: () => void;
  /** Called after a publish request succeeds, so the host can re-read the project's publish state. */
  onPublished?: () => void;
  /** Publish trigger that receives focus after dismissal. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Wires the shared publish building blocks (`usePublishFlow`,
 * `StandalonePublishPanel`, `usePublishFolders`) to the catalog publish
 * endpoint for one project, following `PublishConversationPanelContainer`.
 * A project is published whole and unversioned, so republishing to a folder
 * that already has it is blocked rather than offered as a replacement.
 */
const PublishProjectPanelContainer: FC<Props> = ({
  isOpen,
  projectId,
  projectName,
  conversationCount = 0,
  onClose,
  onPublished,
  returnFocusRef,
}) => {
  const { t } = useTranslation();
  const { notifyOperationSuccess } = useOperationNotification();
  const showPublishError = usePublishErrorNotification();
  /* The publish panel pre-fills its author field with this; the lib cannot read the session itself. */
  const { displayName } = useUserProfile();

  const { isDestinationUsable, getDisabledReason, canCreateFolderIn } =
    useOrgUnitFolderGuards({
      purpose: OrgUnitFolderGuardPurpose.Publish,
      namespace: OrgUnitNamespace.Projects,
      isActive: isOpen,
      shouldRefreshOnOpen: true,
    });

  const {
    folderItems,
    expandedPaths,
    onExpandedPathsChange,
    loadingPaths,
    onCreatePublishFolder,
    rememberPublishFolder,
    hasPublishWriteAccess,
  } = usePublishFolders({ canPublishTo: isDestinationUsable });

  const resource = useMemo<PublishResourceSummary>(
    () => ({ title: projectName }),
    [projectName],
  );
  /* Publication copies the whole project, chats included: warn, do not block. */
  const renderSummary = useMemo(
    () =>
      conversationCount > 0
        ? () => (
            <div className="flex min-w-0 flex-col gap-3">
              <span className="dial-body-semi-text truncate">
                {projectName}
              </span>
              <Notification
                variant={NotificationVariant.Warning}
                type={NotificationType.SectionMessage}
                message={t(ProjectsI18nKeys.PublishChatsWarning, {
                  count: conversationCount,
                })}
              />
            </div>
          )
        : undefined,
    [conversationCount, projectName, t],
  );

  const loadHistory = useCallback(
    async (id: string) =>
      (
        await getCatalogPublishHistory(CatalogPublishEntityType.Project, id)
      ).map(mapPublishHistoryEntryDto),
    [],
  );
  const history = usePublishHistory({
    isOpen,
    entityId: projectId,
    loadHistory,
  });

  const resolveDependencyIcon = usePublishDependencyIconResolver();
  const loadDependencies = useCallback(
    async (id: string) =>
      (
        await getCatalogPublishDependencies(
          CatalogPublishEntityType.Project,
          id,
        )
      ).dependencies.map((dependency) =>
        mapResourceDependencyDto(dependency, resolveDependencyIcon),
      ),
    [resolveDependencyIcon],
  );
  const dependencies = usePublishDependencies({
    isOpen,
    entityId: projectId,
    loadDependencies,
  });

  const getPublishTargetEntity = useCallback(
    () => ({
      entityType: CatalogPublishEntityType.Project,
      entityId: projectId,
    }),
    [projectId],
  );
  const targetGuard = usePublishTargetGuard<PublishResourceSummary>({
    client: publishApiClient,
    getEntity: getPublishTargetEntity,
  });

  const publishFlow = usePublishFlow<PublishResourceSummary>({
    item: resource,
    history,
    folderItems,
    hasWriteAccess: hasPublishWriteAccess,
    onCreateFolder: onCreatePublishFolder,
    defaultAuthor: displayName,
    onPublish: targetGuard.wrapPublish(async (_item, folderPath, author) => {
      const trimmedAuthor = author?.trim();
      await publishCatalogEntity(CatalogPublishEntityType.Project, projectId, {
        folderPath: folderPath.join('/'),
        ...(trimmedAuthor ? { author: trimmedAuthor } : {}),
      });
    }),
    onPublishSuccess: (_item, folderPath) => {
      rememberPublishFolder(folderPath);
      notifyOperationSuccess(
        NotifiableEntity.Project,
        EntityOperation.PublishRequested,
        { name: projectName, folder: getPublishFolderLabel(folderPath, t) },
      );
      onPublished?.();
    },
    onPublishError: (_item, _folderPath, error) =>
      showPublishError(error, undefined, { isVersioned: false }),
    onCheckTargetExists: targetGuard.onCheckTargetExists,
    isTargetTakenError: targetGuard.isTargetTakenError,
  });

  useEffect(() => {
    if (!isOpen) {
      publishFlow.reset();
    }
    // Reset publish-flow-local state only when the panel closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSubmit = async () => {
    const isSuccess = await publishFlow.handleSubmit();
    if (isSuccess) {
      onClose();
    }
  };

  return (
    <StandalonePublishPanel
      isOpen={isOpen}
      resource={resource}
      renderSummary={renderSummary}
      dependencies={dependencies}
      folderItems={publishFlow.folderItems}
      selectedFolderPath={publishFlow.selectedFolderPath}
      onSelectedFolderPathChange={publishFlow.setSelectedFolderPath}
      onCreateFolder={publishFlow.handleCreateFolder}
      getDisabledReason={toPublishDisabledReason(getDisabledReason)}
      canCreateFolderIn={canCreateFolderIn}
      expandedPaths={expandedPaths}
      onExpandedPathsChange={onExpandedPathsChange}
      loadingPaths={loadingPaths}
      hasExistingPublicationInFolder={
        publishFlow.hasExistingPublicationInFolder
      }
      hasWriteAccess={publishFlow.hasWriteAccess}
      isSubmitting={publishFlow.isSubmitting}
      hasSubmitError={publishFlow.hasSubmitError}
      isTargetTaken={publishFlow.isTargetTaken}
      isTargetChecking={publishFlow.isTargetChecking}
      allowReplace={false}
      author={publishFlow.author}
      onAuthorChange={publishFlow.setAuthor}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      onSubmit={handleSubmit}
      footerLabels={{
        cancelLabel: t(ButtonsI18nKeys.Cancel),
        publishDefaultLabel: t(ButtonsI18nKeys.Publish),
        ...getPublishFooterProgressLabels(t),
      }}
      panelLabels={{
        replaceWarning: t(ProjectsI18nKeys.PublishAlreadyPublishedWarning),
        cancelCreatingFolderLabel: t(ButtonsI18nKeys.Cancel),
        createFolderEmptyNameError: t(
          ProjectsI18nKeys.PublishEmptyFolderNameError,
        ),
        createFolderInvalidNameError: t(
          ProjectsI18nKeys.PublishInvalidFolderNameError,
        ),
        createFolderDuplicateNameError: t(
          ProjectsI18nKeys.PublishDuplicateFolderNameError,
        ),
        createFolderSameAsParentNameError: t(
          ProjectsI18nKeys.PublishSameAsParentFolderNameError,
        ),
        submitError: t(PublishI18nKeys.SubmitErrorCallout),
        rootFolderLabel: t(BasicI18nKeys.Organization),
        dependenciesLabels: getPublishDependenciesLabels(
          t,
          PublishI18nKeys.DependenciesEntityProject,
        ),
        ...getPublishApprovalLabels(
          t,
          PublishI18nKeys.DependenciesEntityProject,
        ),
        ...getPublishAuthorLabels(t),
        ...getPublishPanelCommonLabels(t),
      }}
      labels={{
        title: t(ButtonsI18nKeys.Publish),
        ariaLabel: t(ProjectsI18nKeys.PublishPanelAriaLabel),
        closeAriaLabel: t(ButtonsI18nKeys.Close),
        changeFolderTitle: t(ResourceSavePanelI18nKeys.ChangeFolderTitle),
        backAriaLabel: t(ButtonsI18nKeys.Back),
      }}
    />
  );
};

export default memo(PublishProjectPanelContainer);
