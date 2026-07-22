import {
  PublishHistoryEntry,
  PublishResourceSummary,
  StandalonePublishPanel,
  usePublishFlow,
} from '@epam/ai-dial-catalog';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import type { FC, RefObject } from 'react';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  ConversationPublishI18nKeys,
} from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import { usePublishFolders } from '../../hooks/publish/usePublishFolders';
import {
  getConversationPublishHistory,
  publishConversation,
} from '../../server-api/conversation-publish.api';

/** Props for `PublishConversationPanelContainer`. */
interface Props {
  /** Whether the panel is open (controls the slide-in animation and backdrop). */
  isOpen: boolean;
  /** The conversation's DIAL Core resource path, used as the publish `path`. */
  conversationPath: string;
  /** The conversation's current title, shown in the summary row. */
  conversationTitle: string;
  /** Called when the panel should be dismissed. */
  onClose: () => void;
  /** Conversation-row action trigger that receives focus after dismissal. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

const splitFolderPath = (folderPath: string): string[] =>
  folderPath ? folderPath.split('/') : [];

/**
 * Wires the shared catalog publish building blocks (`usePublishFlow`,
 * `StandalonePublishPanel`, `usePublishFolders`) to the conversation publish
 * backend endpoints for a single conversation. Unlike catalog publish, there
 * is no version — republishing to a folder that already has this
 * conversation is blocked (see design.md D2) rather than offered as an
 * update.
 */
const PublishConversationPanelContainer: FC<Props> = ({
  isOpen,
  conversationPath,
  conversationTitle,
  onClose,
  returnFocusRef,
}) => {
  const { t } = useTranslation();
  const { showNotification } = useNotification();

  const {
    folderItems,
    expandedPaths,
    onExpandedPathsChange,
    loadingPaths,
    onCreatePublishFolder,
    hasPublishWriteAccess,
  } = usePublishFolders();

  const [history, setHistory] = useState<PublishHistoryEntry[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [hasHistoryError, setHasHistoryError] = useState(false);

  useEffect(() => {
    if (!isOpen || !conversationPath) {
      return;
    }
    let isCancelled = false;
    setIsHistoryLoading(true);
    setHasHistoryError(false);
    getConversationPublishHistory(conversationPath)
      .then((entries) => {
        if (isCancelled) return;
        setHistory(
          entries.map((entry) => ({
            version: undefined,
            publishedAt: new Date(entry.publishedAt).getTime(),
            publishedBy: entry.publishedBy,
            folderPath: splitFolderPath(entry.folderPath),
          })),
        );
      })
      .catch(() => {
        if (!isCancelled) setHasHistoryError(true);
      })
      .finally(() => {
        if (!isCancelled) setIsHistoryLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [isOpen, conversationPath]);

  const resource: PublishResourceSummary = { title: conversationTitle };

  const publishFlow = usePublishFlow<PublishResourceSummary>({
    item: resource,
    history,
    folderItems,
    hasWriteAccess: hasPublishWriteAccess,
    onCreateFolder: onCreatePublishFolder,
    onPublish: async (_item, folderPath) => {
      await publishConversation(conversationPath, folderPath.join('/'));
    },
    onPublishSuccess: () => {
      showNotification({
        variant: NotificationVariant.Success,
        message: t(ConversationPublishI18nKeys.SuccessMessage),
      });
    },
  });

  useEffect(() => {
    if (!isOpen) {
      publishFlow.reset();
      setHistory([]);
      setHasHistoryError(false);
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
      history={history}
      isHistoryLoading={isHistoryLoading}
      hasHistoryError={hasHistoryError}
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
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      onSubmit={handleSubmit}
      footerTexts={{
        cancelLabel: t(ButtonsI18nKeys.Cancel),
        publishDefaultLabel: t(ButtonsI18nKeys.Publish),
      }}
      panelTexts={{
        replaceWarning: t(ConversationPublishI18nKeys.AlreadyPublishedWarning),
        createFolderEmptyNameError: t(
          ConversationPublishI18nKeys.EmptyFolderNameError,
        ),
        createFolderInvalidNameError: t(
          ConversationPublishI18nKeys.InvalidFolderNameError,
        ),
        createFolderDuplicateNameError: t(
          ConversationPublishI18nKeys.DuplicateFolderNameError,
        ),
      }}
      texts={{
        title: t(ButtonsI18nKeys.Publish),
        ariaLabel: t(ConversationPublishI18nKeys.PanelAriaLabel),
        closeAriaLabel: t(ButtonsI18nKeys.Close),
      }}
    />
  );
};

export default memo(PublishConversationPanelContainer);
