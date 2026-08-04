import {
  PublishHistoryEntry,
  PublishResourceSummary,
  StandalonePublishPanel,
  usePublishFlow,
} from '@epam/ai-dial-publish-panel';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import type { FC, RefObject } from 'react';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  ConversationPublishI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import { useNotification } from '../../context/NotificationContext';
import { usePublishFolders } from '../../hooks/publish/usePublishFolders';
import { publishConversation } from '../../server-api/conversation-publish.api';
import { getPublishRules } from '../../server-api/publish-rules.api';
import { getAccessRulesLabels } from '../../utils/publish';

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
    config: { publicationFilterSources },
  } = useAppConfig();

  const {
    folderItems,
    expandedPaths,
    onExpandedPathsChange,
    loadingPaths,
    onCreatePublishFolder,
    hasPublishWriteAccess,
  } = usePublishFolders();

  /*
   * Version history is not fetched: the backend endpoint is not yet
   * functional (returns 503 for DIAL Core, see GH issue #7897).
   */
  const [history] = useState<PublishHistoryEntry[]>([]);
  const [isHistoryLoading] = useState(false);
  const [hasHistoryError, setHasHistoryError] = useState(false);

  const resource: PublishResourceSummary = { title: conversationTitle };

  const publishFlow = usePublishFlow<PublishResourceSummary>({
    item: resource,
    history,
    folderItems,
    hasWriteAccess: hasPublishWriteAccess,
    onCreateFolder: onCreatePublishFolder,
    onPublish: async (_item, folderPath, rules) => {
      await publishConversation(conversationPath, folderPath.join('/'), rules);
    },
    onPublishSuccess: () => {
      showNotification({
        variant: NotificationVariant.Success,
        message: t(ConversationPublishI18nKeys.SuccessMessage),
      });
    },
    onFetchExistingRules: (folderPath) => getPublishRules(folderPath.join('/')),
  });

  useEffect(() => {
    if (!isOpen) {
      publishFlow.reset();
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
        accessRulesLabels: getAccessRulesLabels(t),
      }}
      labels={{
        title: t(ButtonsI18nKeys.Publish),
        ariaLabel: t(ConversationPublishI18nKeys.PanelAriaLabel),
        closeAriaLabel: t(ButtonsI18nKeys.Close),
      }}
    />
  );
};

export default memo(PublishConversationPanelContainer);
