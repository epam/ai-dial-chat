import {
  mapPublishHistoryEntryDto,
  toPublishRuleDto,
} from '@epam/ai-dial-chat-hooks';
import {
  PublishHistoryEntry,
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
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  ProjectsI18nKeys,
  PublishI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import { usePublishErrorNotification } from '../../hooks/publish/usePublishErrorNotification';
import { usePublishFolders } from '../../hooks/publish/usePublishFolders';
import { useOperationNotification } from '../../hooks/useOperationNotification';
import { useUserProfile } from '../../hooks/user-profile/useUserProfile';
import { getPublishRules } from '../../server-api/publish-rules.api';
import {
  CatalogPublishEntityType,
  getCatalogPublishHistory,
  publishCatalogEntity,
} from '../../server-api/publish.api';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../types/entity-notification';
import {
  getAccessRulesLabels,
  getPublishAuthorLabels,
  getPublishFolderLabel,
} from '../../utils/publish';

const EMPTY_HISTORY: PublishHistoryEntry[] = [];

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
  returnFocusRef,
}) => {
  const { t } = useTranslation();
  const { notifyOperationSuccess } = useOperationNotification();
  const showPublishError = usePublishErrorNotification();
  const {
    config: { publicationFilterSources },
  } = useAppConfig();
  /* The publish panel pre-fills its author field with this; the lib cannot read the session itself. */
  const { displayName } = useUserProfile();

  const {
    folderItems,
    expandedPaths,
    onExpandedPathsChange,
    loadingPaths,
    onCreatePublishFolder,
    rememberPublishFolder,
    hasPublishWriteAccess,
  } = usePublishFolders();

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

  /* Re-read on every open, so a publication requested since the last one
   * already blocks its folder. A failed lookup leaves the history empty: the
   * backend still refuses a duplicate publication. */
  const [history, setHistory] = useState<PublishHistoryEntry[]>(EMPTY_HISTORY);
  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;
    const load = async () => {
      try {
        const entries = await getCatalogPublishHistory(
          CatalogPublishEntityType.Project,
          projectId,
        );
        if (!isCancelled) setHistory(entries.map(mapPublishHistoryEntryDto));
      } catch {
        if (!isCancelled) setHistory(EMPTY_HISTORY);
      }
    };
    void load();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, projectId]);

  const publishFlow = usePublishFlow<PublishResourceSummary>({
    item: resource,
    history,
    folderItems,
    hasWriteAccess: hasPublishWriteAccess,
    onCreateFolder: onCreatePublishFolder,
    defaultAuthor: displayName,
    onPublish: async (_item, folderPath, rules, author) => {
      const trimmedAuthor = author?.trim();
      await publishCatalogEntity(CatalogPublishEntityType.Project, projectId, {
        folderPath: folderPath.join('/'),
        ...(trimmedAuthor ? { author: trimmedAuthor } : {}),
        rules: rules.map(toPublishRuleDto),
      });
    },
    onPublishSuccess: (_item, folderPath) => {
      rememberPublishFolder(folderPath);
      notifyOperationSuccess(
        NotifiableEntity.Project,
        EntityOperation.PublishRequested,
        { name: projectName, folder: getPublishFolderLabel(folderPath, t) },
      );
    },
    onPublishError: (_item, _folderPath, error) => showPublishError(error),
    onFetchExistingRules: (folderPath) => getPublishRules(folderPath.join('/')),
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
      folderItems={publishFlow.folderItems}
      selectedFolderPath={publishFlow.selectedFolderPath}
      onSelectedFolderPathChange={publishFlow.setSelectedFolderPath}
      onCreateFolder={publishFlow.handleCreateFolder}
      expandedPaths={expandedPaths}
      onExpandedPathsChange={onExpandedPathsChange}
      loadingPaths={loadingPaths}
      hasExistingPublicationInFolder={
        publishFlow.hasExistingPublicationInFolder
      }
      hasWriteAccess={publishFlow.hasWriteAccess}
      isSubmitting={publishFlow.isSubmitting}
      hasSubmitError={publishFlow.hasSubmitError}
      allowReplace={false}
      author={publishFlow.author}
      onAuthorChange={publishFlow.setAuthor}
      rules={publishFlow.rules}
      onRulesChange={publishFlow.setRules}
      ruleSourceOptions={publicationFilterSources}
      isRulesLoading={publishFlow.isRulesLoading}
      hasRulesLoadError={publishFlow.hasRulesLoadError}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      onSubmit={handleSubmit}
      footerLabels={{
        cancelLabel: t(ButtonsI18nKeys.Cancel),
        publishDefaultLabel: t(ButtonsI18nKeys.Publish),
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
        submitError: t(PublishI18nKeys.SubmitErrorCallout),
        rootFolderLabel: t(BasicI18nKeys.Organization),
        accessRulesLabels: getAccessRulesLabels(t),
        ...getPublishAuthorLabels(t),
      }}
      labels={{
        title: t(ButtonsI18nKeys.Publish),
        ariaLabel: t(ProjectsI18nKeys.PublishPanelAriaLabel),
        closeAriaLabel: t(ButtonsI18nKeys.Close),
      }}
    />
  );
};

export default memo(PublishProjectPanelContainer);
