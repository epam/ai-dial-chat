import { DeleteConfirmationDialog } from '@epam/ai-dial-chat-shared';
import { RenameConversationPopup } from '@epam/ai-dial-conversation-panel';
import { UnpublishConfirmationDialog } from '@epam/ai-dial-publish-panel';
import {
  ConfirmationPopup,
  ConfirmationPopupVariant,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ErrorMessageNotification,
  Popup,
  PopupSize,
  TransferQueue,
} from '@epam/ai-dial-ui-kit';
import { IconMessageCircle } from '@tabler/icons-react';
import { lazy, Suspense, type FC, type RefObject } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { CONFIRMATION_BOLD_COMPONENTS } from '../../constants/confirmation-copy';
import {
  ButtonsI18nKeys,
  ConversationImportI18nKeys,
  ConversationPanelI18nKeys,
  ConversationUnpublishI18nKeys,
} from '../../constants/translation-keys';
import { useConversationEditDialogs } from '../../hooks/conversation-panel/useConversationEditDialogs';
import { useConversationSharingDialogs } from '../../hooks/conversation-panel/useConversationSharingDialogs';
import { useConversationTransfer } from '../../hooks/conversation-panel/useConversationTransfer';
import { usePinnedProjectsPanel } from '../../hooks/projects/usePinnedProjectsPanel';
import { useUnpublishConfirmationLabels } from '../../hooks/publish/useUnpublishConfirmationLabels';
import { useDeleteConfirmationLabels } from '../../hooks/useDeleteConfirmationLabels';
import PinnedProjectActionOverlays from '../PinnedProjectActionOverlays/PinnedProjectActionOverlays';
import { loadPublishConversationPanel } from '../PublishConversationPanelContainer/load-publish-conversation-panel';
import ShareConversationPopoverContainer from '../ShareConversationPopoverContainer/ShareConversationPopoverContainer';

const PublishConversationPanelContainer = lazy(loadPublishConversationPanel);

interface ConversationPanelOverlaysProps {
  transfer: ReturnType<typeof useConversationTransfer>;
  editDialogs: ReturnType<typeof useConversationEditDialogs>;
  sharingDialogs: ReturnType<typeof useConversationSharingDialogs>;
  deleteConfirmationLabels: ReturnType<typeof useDeleteConfirmationLabels>;
  pinnedProjectActionOverlay: ReturnType<
    typeof usePinnedProjectsPanel
  >['actionOverlay'];
  /* The row's kebab trigger; overlays opened from its menu return focus here. */
  rowActionsTriggerRef: RefObject<HTMLButtonElement | null>;
  isConversationsSharingEnabled: boolean;
  isConversationsPublishingEnabled: boolean;
}

/**
 * Everything the conversation panel renders that is not the list: the import
 * input, the transfer queues and the dialogs. Rendered in place beside the
 * panel, but portalled out of the sidebar by `ConversationPanelView`, whose
 * sidebar content is hidden and inert while it is collapsed. Presentational:
 * all state and handlers come from the panel's hooks.
 */
const ConversationPanelOverlays: FC<ConversationPanelOverlaysProps> = ({
  transfer,
  editDialogs,
  sharingDialogs,
  deleteConfirmationLabels,
  pinnedProjectActionOverlay,
  rowActionsTriggerRef,
  isConversationsSharingEnabled,
  isConversationsPublishingEnabled,
}) => {
  const { t } = useTranslation();
  const unpublishLabels = useUnpublishConfirmationLabels({
    title: ConversationUnpublishI18nKeys.ConfirmTitle,
    confirmMessage: ConversationUnpublishI18nKeys.ConfirmMessage,
    selectFolderMessage: ConversationUnpublishI18nKeys.SelectFolderMessage,
    folderGroupAriaLabel: ConversationUnpublishI18nKeys.FolderGroupAriaLabel,
    requestingStatus: ConversationUnpublishI18nKeys.RequestingStatus,
  });
  const {
    importFileInputRef,
    handleImportFileChange,
    exportQueueTitle,
    importQueueTitle,
    exportQueueLabels,
    importQueueLabels,
    exportQueueItems,
    importQueueItems,
    cancelExportJob,
    cancelImportJob,
    dismissAllExports,
    dismissAllImports,
  } = transfer;
  const {
    pendingRename,
    isDeletePending,
    isDeleting,
    deleteError,
    isRenamePending,
    isRenaming,
    renameError,
    pendingDeleteTitle,
    renameLabels,
    handleConfirmDelete,
    handleCloseDeleteDialog,
    handleConfirmRename,
    handleGenerateRenameWithAi,
    handleCloseRenameDialog,
  } = editDialogs;
  const {
    isUnsharePending,
    isUnsharing,
    unshareError,
    isRevokePending,
    isRevoking,
    revokeError,
    pendingShareConversationPath,
    pendingPublishConversation,
    publishPanelHistory,
    pendingUnshareTitle,
    pendingRevokeTitle,
    handleCloseSharePopover,
    handleClosePublishPanel,
    handleConfirmUnshare,
    handleCloseUnshareDialog,
    handleConfirmRevoke,
    handleCloseRevokeDialog,
    unpublishDialog,
  } = sharingDialogs;

  return (
    <>
      <input
        ref={importFileInputRef}
        type="file"
        className="sr-only"
        aria-hidden
        /* axe `label` still asks a hidden file input for a name. */
        aria-label={t(ConversationImportI18nKeys.ImportLabel)}
        tabIndex={-1}
        onChange={handleImportFileChange}
      />

      {/*
       * Above page content (sidebars sit at z-50) but below the kit's portalled
       * overlays — popup 52, dropdown 53, tooltip 55 — so a row's error tooltip
       * and the close confirmation open over the queue, not under it.
       */}
      <div className="fixed inset-e-4 bottom-4 z-51 flex flex-col-reverse gap-2">
        <TransferQueue
          title={importQueueTitle}
          items={importQueueItems}
          onClose={dismissAllImports}
          onCancelItem={cancelImportJob}
          labels={importQueueLabels}
        />
        <TransferQueue
          title={exportQueueTitle}
          items={exportQueueItems}
          onClose={dismissAllExports}
          onCancelItem={cancelExportJob}
          labels={exportQueueLabels}
        />
      </div>

      <DeleteConfirmationDialog
        open={isDeletePending}
        title={t(ConversationPanelI18nKeys.DeleteConfirmTitle)}
        names={[pendingDeleteTitle]}
        icon={
          <IconMessageCircle
            size={DIAL_ICON_SIZE.MD}
            stroke={DIAL_KIT_ICON_STROKE}
            aria-hidden
          />
        }
        message={
          <Trans
            i18nKey={ConversationPanelI18nKeys.DeleteConfirmMessage}
            values={{ name: pendingDeleteTitle }}
            components={CONFIRMATION_BOLD_COMPONENTS}
          />
        }
        labels={deleteConfirmationLabels}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={handleCloseDeleteDialog}
      >
        {deleteError && <ErrorMessageNotification message={deleteError} />}
      </DeleteConfirmationDialog>

      <UnpublishConfirmationDialog
        {...unpublishDialog}
        labels={unpublishLabels}
      />

      <ConfirmationPopup
        open={isUnsharePending}
        header={t(ConversationPanelI18nKeys.UnshareConfirmTitle)}
        confirmLabel={t(ButtonsI18nKeys.RemoveFromMyList)}
        cancelLabel={t(ButtonsI18nKeys.Cancel)}
        variant={ConfirmationPopupVariant.Danger}
        isLoading={isUnsharing}
        description={
          <>
            <span className="wrap-break-word">
              {t(ConversationPanelI18nKeys.UnshareConfirmMessage, {
                name: pendingUnshareTitle,
              })}
            </span>
            {unshareError && (
              <ErrorMessageNotification
                className="mt-3"
                message={unshareError}
              />
            )}
          </>
        }
        onConfirm={handleConfirmUnshare}
        onCancel={handleCloseUnshareDialog}
        onClose={handleCloseUnshareDialog}
      />

      <ConfirmationPopup
        open={isRevokePending}
        header={t(ConversationPanelI18nKeys.RevokeConfirmTitle)}
        confirmLabel={t(ButtonsI18nKeys.RevokeAccess)}
        cancelLabel={t(ButtonsI18nKeys.Cancel)}
        variant={ConfirmationPopupVariant.Danger}
        isLoading={isRevoking}
        description={
          <>
            <span className="wrap-break-word">
              {t(ConversationPanelI18nKeys.RevokeConfirmMessage, {
                name: pendingRevokeTitle,
              })}
            </span>
            {revokeError && (
              <ErrorMessageNotification
                className="mt-3"
                message={revokeError}
              />
            )}
          </>
        }
        onConfirm={handleConfirmRevoke}
        onCancel={handleCloseRevokeDialog}
        onClose={handleCloseRevokeDialog}
      />

      <PinnedProjectActionOverlays {...pinnedProjectActionOverlay} />

      <RenameConversationPopup
        isOpen={isRenamePending}
        currentTitle={pendingRename?.title ?? ''}
        isSaving={isRenaming}
        error={renameError}
        onSave={handleConfirmRename}
        onCancel={handleCloseRenameDialog}
        onGenerateWithAi={handleGenerateRenameWithAi}
        labels={renameLabels}
      />

      {isConversationsSharingEnabled && (
        <Popup
          open={pendingShareConversationPath !== null}
          onClose={handleCloseSharePopover}
          hideClose
          headerClassName="hidden"
          size={PopupSize.Sm}
        >
          <ShareConversationPopoverContainer
            conversationPath={pendingShareConversationPath ?? ''}
            onClose={handleCloseSharePopover}
          />
        </Popup>
      )}

      {isConversationsPublishingEnabled &&
        pendingPublishConversation !== null && (
          /* No fallback: a stand-in dialog flashed before the side panel on
           * the first publish after a page load (#9742, TC-41). The row menu
           * preloads the chunk, so the panel is usually ready by the click. */
          <Suspense fallback={null}>
            <PublishConversationPanelContainer
              isOpen
              conversationPath={pendingPublishConversation.path}
              conversationTitle={pendingPublishConversation.title}
              onClose={handleClosePublishPanel}
              returnFocusRef={rowActionsTriggerRef}
              history={publishPanelHistory.entries}
            />
          </Suspense>
        )}
    </>
  );
};

export default ConversationPanelOverlays;
