import { useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import {
  MouseEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { isEntityNameOnSameLevelUnique } from '@/src/utils/app/common';
import {
  isPlaybackConversation,
  isReplayConversation,
  regenerateConversationId,
} from '@/src/utils/app/conversation';
import { getParentAndCurrentFolderIdsById } from '@/src/utils/app/folders';
import { getIdWithoutRootPathSegments, isRootId } from '@/src/utils/app/id';

import { Conversation } from '@/src/types/chat';
import { FeatureType, ScreenState, isNotLoaded } from '@/src/types/common';
import { ContextMenuProps } from '@/src/types/menu';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import {
  ChatActions,
  ConversationsActions,
  ImportExportActions,
  ShareActions,
  UIActions,
} from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationTypesSchemasSelectors,
  ConversationsSelectors,
  ModelsSelectors,
  PublicationSelectors,
  SettingsSelectors,
  UISelectors,
} from '@/src/store/selectors';

import { PINNED_CONVERSATIONS_SECTION_NAME } from '@/src/constants/sections';

import { PublishModal } from '@/src/components/Chat/Publish/PublishWizard';
import { ExportModal } from '@/src/components/Chatbar/ExportModal';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import ItemContextMenu from '@/src/components/Common/ItemContextMenu';
import { MoveToDialog } from '@/src/components/Common/MoveToDialog';

import {
  ConversationInfo,
  PublishActions,
  UploadStatus,
} from '@epam/ai-dial-shared';

interface ConversationContextMenuProps {
  conversation: ConversationInfo;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  isHeaderMenu?: boolean;
  publicationUrl?: string;
  className?: string;
  TriggerIcon?: ContextMenuProps['TriggerIcon'];
  disabledState?: boolean;
}

export const ConversationContextMenu = ({
  conversation,
  publicationUrl,
  isOpen,
  setIsOpen,
  className,
  TriggerIcon,
  isHeaderMenu,
  disabledState,
}: ConversationContextMenuProps) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const applicationTypeSchemas = useAppSelector(
    ApplicationTypesSchemasSelectors.selectAllSchemas,
  );

  const allConversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const resourceToReview = useAppSelector((state) =>
    PublicationSelectors.selectResourceToReviewByReviewUrl(
      state,
      conversation.id,
    ),
  );
  const isPublishingEnabled = useAppSelector((state) =>
    SettingsSelectors.selectIsPublishingEnabled(state, FeatureType.Chat),
  );

  const collapsedSectionsSelector = useMemo(
    () => UISelectors.selectCollapsedSections(FeatureType.Chat),
    [],
  );

  const collapsedSections = useAppSelector(collapsedSectionsSelector);

  const [isShowMoveToModal, setIsShowMoveToModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isShowExportModal, setIsShowExportModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);

  const screenState = useScreenState();

  const { refs, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
  });

  useEffect(() => {
    if (isOpen && isNotLoaded(conversation.status)) {
      dispatch(
        ConversationsActions.uploadConversationsByIds({
          conversationIds: [conversation.id],
        }),
      );
    }
  }, [conversation.id, conversation.status, dispatch, isOpen]);

  const isReplay = isReplayConversation(conversation);
  const isPlayback = isPlaybackConversation(conversation);
  const isEmptyConversation = !(
    (conversation as Conversation).messages?.length > 0
  );

  const isUnpublishVisible =
    !(isHeaderMenu && resourceToReview) && !isReplay && !publicationUrl;

  const dismiss = useDismiss(context);
  const { getFloatingProps } = useInteractions([dismiss]);

  const handleOpenExportModal = useCallback(() => {
    setIsShowExportModal(true);
  }, []);

  const handleCloseExportModal = useCallback(() => {
    setIsShowExportModal(false);
  }, []);

  useEffect(() => {
    if (screenState !== ScreenState.SM) {
      setIsShowMoveToModal(false);
      handleCloseExportModal();
    }
  }, [handleCloseExportModal, screenState]);

  const handleOpenDeleteModal: MouseEventHandler<HTMLButtonElement> =
    useCallback((e) => {
      e.stopPropagation();

      setIsDeleting(true);
    }, []);

  const handleOpenPublishing = useCallback(() => {
    setIsPublishing(true);
  }, []);

  const handleOpenUnpublishing = useCallback(() => {
    setIsUnpublishing(true);
  }, []);

  const handleClosePublishModal = useCallback(() => {
    setIsPublishing(false);
    setIsUnpublishing(false);
  }, []);

  const handleMoveToFolder = useCallback(
    (folderId: string) => {
      if (
        !isEntityNameOnSameLevelUnique(
          conversation.name,
          { ...conversation, folderId },
          allConversations,
        )
      ) {
        dispatch(
          UIActions.showErrorToast(
            t(
              'Conversation with name "{{name}}" already exists in this folder.',
              {
                ns: Translation.Chat,
                name: conversation.name,
              },
            ),
          ),
        );

        return;
      }

      dispatch(
        UIActions.setCollapsedSections({
          featureType: FeatureType.Chat,
          collapsedSections: collapsedSections.filter(
            (section) => section !== PINNED_CONVERSATIONS_SECTION_NAME,
          ),
        }),
      );
      dispatch(
        ConversationsActions.updateConversation({
          id: conversation.id,
          values: { folderId },
        }),
      );
      dispatch(
        UIActions.setOpenedFoldersIds({
          openedFolderIds: getParentAndCurrentFolderIdsById(folderId),
          featureType: FeatureType.Chat,
        }),
      );
      dispatch(
        UIActions.setScrollToEntityId(
          regenerateConversationId({
            ...conversation,
            folderId,
          }).id,
        ),
      );
    },
    [allConversations, collapsedSections, conversation, dispatch, t],
  );

  const handleCloseMoveTo = useCallback(() => {
    setIsShowMoveToModal(false);
  }, []);

  const handleCompare: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      if (isReplay || isPlayback) return;
      dispatch(
        ConversationsActions.selectConversations({
          conversationIds: [conversation.id],
        }),
      );
      dispatch(UIActions.setIsCompareMode(true));
    }, [conversation.id, dispatch, isPlayback, isReplay]);

  const handleDuplicate: MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      e.stopPropagation();

      setIsOpen(false);
      dispatch(ConversationsActions.duplicateConversation(conversation));
    },
    [conversation, dispatch, setIsOpen],
  );

  const handleExport = useCallback(
    (args?: unknown) => {
      const typedArgs = args as { withAttachments?: boolean };

      dispatch(
        ImportExportActions.exportConversation({
          conversationId: conversation.id,
          withAttachments: typedArgs?.withAttachments ?? false,
        }),
      );
      handleCloseExportModal();
    },
    [conversation.id, dispatch, handleCloseExportModal],
  );

  const handleStartReplay: MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      e.stopPropagation();
      setIsOpen(false);
      dispatch(ConversationsActions.createNewReplayConversation(conversation));
    },
    [conversation, dispatch, setIsOpen],
  );

  const handleCreatePlayback: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      dispatch(
        ConversationsActions.createNewPlaybackConversation(conversation),
      );
      setIsOpen(false);
    }, [conversation, dispatch, setIsOpen]);

  const handleOpenSharing: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      dispatch(
        ShareActions.share({
          featureType: FeatureType.Chat,
          entity: conversation,
        }),
      );
      setIsOpen(false);
    }, [conversation, dispatch, setIsOpen]);

  const handleSelect: MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      e.stopPropagation();
      setIsOpen(false);
      dispatch(
        ConversationsActions.setChosenConversations({
          ids: [conversation.id],
        }),
      );
    },
    [conversation.id, dispatch, setIsOpen],
  );

  const handleDelete = useCallback(() => {
    if (conversation.sharedWithMe) {
      dispatch(
        ShareActions.discardSharedWithMe({
          resourceIds: [conversation.id],
          featureType: FeatureType.Chat,
        }),
      );
    } else {
      dispatch(
        ConversationsActions.deleteConversations({
          conversationIds: [conversation.id],
        }),
      );
    }
    setIsDeleting(false);
  }, [conversation.id, conversation.sharedWithMe, dispatch]);

  const handleOpenRenameModal = useCallback(() => {
    dispatch(ConversationsActions.setRenamingConversationId(conversation.id));
  }, [conversation, dispatch]);

  const isCustomViewerApplication = useMemo(() => {
    return !!applicationTypeSchemas.find(
      (schema) =>
        schema.id === modelsMap[conversation.model.id]?.applicationTypeSchemaId,
    )?.viewerUrl;
  }, [conversation.model.id, modelsMap, applicationTypeSchemas]);

  const handleOpenInfoModal = useCallback(() => {
    const { id, updatedAt, createdAt, author } = conversation;

    dispatch(
      ChatActions.getEntityInfo({
        entityInfo: {
          id,
          updatedAt,
          createdAt,
          author,
        },
      }),
    );
  }, [conversation, dispatch]);

  return (
    <>
      <button
        ref={refs.setFloating}
        {...getFloatingProps()}
        data-qa="dots-menu"
        disabled={disabledState}
        className="group"
      >
        <ItemContextMenu
          TriggerIcon={TriggerIcon}
          className={className}
          entity={conversation}
          isEmptyConversation={!isReplay && !isPlayback && isEmptyConversation}
          featureType={FeatureType.Chat}
          onOpenMoveToModal={() => setIsShowMoveToModal(true)}
          onDelete={handleOpenDeleteModal}
          onRename={handleOpenRenameModal}
          onExport={handleExport}
          onOpenExportModal={handleOpenExportModal}
          onCompare={
            !isReplay && !isPlayback && !isCustomViewerApplication
              ? handleCompare
              : undefined
          }
          onDuplicate={handleDuplicate}
          onReplay={
            !isReplay && !isPlayback && !isCustomViewerApplication
              ? handleStartReplay
              : undefined
          }
          onPlayback={
            !isReplay && !isPlayback && !isCustomViewerApplication
              ? handleCreatePlayback
              : undefined
          }
          onShare={!isReplay ? handleOpenSharing : undefined}
          onPublish={!isReplay ? handleOpenPublishing : undefined}
          onUnpublish={isUnpublishVisible ? handleOpenUnpublishing : undefined}
          onOpenChange={setIsOpen}
          isOpen={isOpen}
          isLoading={conversation.status !== UploadStatus.LOADED}
          onSelect={isHeaderMenu ? undefined : handleSelect}
          useStandardColor={isHeaderMenu}
          onShowInfo={handleOpenInfoModal}
        />
      </button>

      {isShowMoveToModal && (
        <MoveToDialog
          entity={conversation}
          featureType={FeatureType.Chat}
          onClose={handleCloseMoveTo}
          onSelect={handleMoveToFolder}
        />
      )}

      {isShowExportModal && (
        <ExportModal onExport={handleExport} onClose={handleCloseExportModal} />
      )}

      {isPublishingEnabled && (isPublishing || isUnpublishing) && (
        <PublishModal
          entity={conversation}
          type={SharingType.Conversation}
          isOpen={isPublishing || isUnpublishing}
          onClose={handleClosePublishModal}
          publishAction={
            isPublishing ? PublishActions.ADD : PublishActions.DELETE
          }
          defaultPath={
            isUnpublishing && !isRootId(conversation.folderId)
              ? getIdWithoutRootPathSegments(conversation.folderId)
              : undefined
          }
        />
      )}

      {isDeleting && (
        <ConfirmDialog
          isOpen
          heading={t('Confirm deleting conversation')}
          description={`${t('Are you sure that you want to delete a conversation?')}${t(
            conversation.isShared
              ? '\nDeleting will stop sharing and other users will no longer see this conversation.'
              : '',
          )}`}
          confirmLabel={t('Delete')}
          cancelLabel={t('Cancel')}
          onClose={(result) => {
            setIsDeleting(false);
            if (result) handleDelete();
          }}
        />
      )}
    </>
  );
};
