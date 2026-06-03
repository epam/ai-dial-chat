import { useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { MouseEventHandler, useCallback, useEffect, useMemo } from 'react';

import { useScreenState } from '@/src/hooks/useScreenState';

import {
  isPlaybackConversation,
  isReplayConversation,
} from '@/src/utils/app/conversation';

import { Conversation } from '@/src/types/chat';
import { FeatureType, ScreenState, isNotLoaded } from '@/src/types/common';
import { ContextMenuProps } from '@/src/types/menu';

import {
  ChatActions,
  ConversationsActions,
  ImportExportActions,
  PublicationActions,
  ShareActions,
  UIActions,
} from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationTypesSchemasSelectors,
  ModelsSelectors,
  PublicationSelectors,
  SettingsSelectors,
} from '@/src/store/selectors';

import { ItemContextMenu } from '@/src/components/Common/ItemContextMenu';

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
  const dispatch = useAppDispatch();

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const applicationTypeSchemas = useAppSelector(
    ApplicationTypesSchemasSelectors.selectAllSchemas,
  );
  const resourceToReview = useAppSelector((state) =>
    PublicationSelectors.selectResourceToReviewByReviewUrl(
      state,
      conversation.id,
    ),
  );
  const isCompareModeDisabled = useAppSelector(
    SettingsSelectors.selectIsCompareModeDisabled,
  );

  const screenState = useScreenState();
  const isMobileOrTablet =
    screenState === ScreenState.SM || screenState === ScreenState.MD;

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
    dispatch(ConversationsActions.setExportingConversationId(conversation.id));
  }, [conversation.id, dispatch]);

  const handleCloseExportModal = useCallback(() => {
    dispatch(ConversationsActions.setExportingConversationId());
  }, [dispatch]);

  const handleOpenDeleteModal: MouseEventHandler<HTMLButtonElement> =
    useCallback(
      (e) => {
        e.stopPropagation();

        dispatch(
          ConversationsActions.setDeletingConversationId(conversation.id),
        );
      },
      [conversation.id, dispatch],
    );

  const handleOpenPublishing = useCallback(() => {
    dispatch(
      PublicationActions.setPublishModel({
        entity: conversation,
        action: PublishActions.ADD,
      }),
    );
  }, [conversation, dispatch]);

  const handleOpenUnpublishing = useCallback(() => {
    dispatch(
      PublicationActions.setPublishModel({
        entity: conversation,
        action: PublishActions.DELETE,
      }),
    );
  }, [conversation, dispatch]);

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

  const handleOpenUnshareModal: MouseEventHandler<HTMLButtonElement> =
    useCallback(
      (e) => {
        e.stopPropagation();
        dispatch(ShareActions.setUnshareEntity(conversation));
      },
      [conversation, dispatch],
    );

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

  const handleOpenMoveToModal = useCallback(() => {
    dispatch(ConversationsActions.setMoveToConversationId(conversation.id));
  }, [conversation, dispatch]);

  const handleOpenRenameModal = useCallback(() => {
    dispatch(ConversationsActions.setRenamingConversationId(conversation.id));
  }, [conversation, dispatch]);

  const { isCustomViewerApplication, applicationTypePlaybackSupport } =
    useMemo(() => {
      const applicationTypeSchema = applicationTypeSchemas.find(
        (schema) =>
          schema.id ===
          modelsMap[conversation.model.id]?.applicationTypeSchemaId,
      );
      return {
        isCustomViewerApplication: !!applicationTypeSchema?.viewerUrl,
        applicationTypePlaybackSupport:
          !!applicationTypeSchema?.applicationTypePlaybackSupport,
      };
    }, [conversation.model.id, modelsMap, applicationTypeSchemas]);

  const isPlaybackActionAvailable = useMemo(() => {
    return isCustomViewerApplication
      ? !isReplay && !isPlayback && applicationTypePlaybackSupport
      : !isReplay && !isPlayback;
  }, [
    isReplay,
    isPlayback,
    isCustomViewerApplication,
    applicationTypePlaybackSupport,
  ]);

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
        onOpenMoveToModal={handleOpenMoveToModal}
        onDelete={handleOpenDeleteModal}
        onRename={handleOpenRenameModal}
        onExport={handleExport}
        onOpenExportModal={handleOpenExportModal}
        onCompare={
          !isCompareModeDisabled &&
          !isReplay &&
          !isPlayback &&
          !isCustomViewerApplication
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
          isPlaybackActionAvailable ? handleCreatePlayback : undefined
        }
        onShare={!isReplay ? handleOpenSharing : undefined}
        onUnshare={!isReplay ? handleOpenUnshareModal : undefined}
        onPublish={!isReplay ? handleOpenPublishing : undefined}
        onUnpublish={isUnpublishVisible ? handleOpenUnpublishing : undefined}
        onOpenChange={setIsOpen}
        isOpen={isOpen}
        isLoading={conversation.status !== UploadStatus.LOADED}
        onSelect={isHeaderMenu ? undefined : handleSelect}
        useStandardColor={isHeaderMenu}
        onShowInfo={handleOpenInfoModal}
        hideTriggerIcon={!isHeaderMenu && isMobileOrTablet}
      />
    </button>
  );
};
