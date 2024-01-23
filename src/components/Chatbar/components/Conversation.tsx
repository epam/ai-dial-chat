import { useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { IconCheck, IconX } from '@tabler/icons-react';
import {
  DragEvent,
  KeyboardEvent,
  MouseEvent,
  MouseEventHandler,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import classNames from 'classnames';

import { hasParentWithFloatingOverlay } from '@/src/utils/app/modals';
import { defaultMyItemsFilters } from '@/src/utils/app/search';

import { Conversation } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { SharingType } from '@/src/types/share';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { emptyImage } from '@/src/constants/drag-and-drop';

import SidebarActionButton from '@/src/components/Buttons/SidebarActionButton';
import { PlaybackIcon } from '@/src/components/Chat/Playback/PlaybackIcon';
import { ReplayAsIsIcon } from '@/src/components/Chat/ReplayAsIsIcon';
import ShareModal from '@/src/components/Chat/ShareModal';
import ItemContextMenu from '@/src/components/Common/ItemContextMenu';
import { MoveToFolderMobileModal } from '@/src/components/Common/MoveToFolderMobileModal';
import ShareIcon from '@/src/components/Common/ShareIcon';

import PublishModal from '../../Chat/PublishModal';
import UnpublishModal from '../../Chat/UnpublishModal';
import { ModelIcon } from './ModelIcon';

import { v4 as uuidv4 } from 'uuid';

interface ViewProps {
  conversation: Conversation;
  isHighlited: boolean;
}

export function ConversationView({ conversation, isHighlited }: ViewProps) {
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  return (
    <>
      <ShareIcon
        {...conversation}
        isHighlighted={!!isHighlited}
        featureType={FeatureType.Chat}
      >
        {conversation.replay.replayAsIs && (
          <span className="flex shrink-0">
            <ReplayAsIsIcon size={18} />
          </span>
        )}

        {conversation.playback && conversation.playback.isPlayback && (
          <span className="flex shrink-0">
            <PlaybackIcon size={18} />
          </span>
        )}

        {!conversation.replay.replayAsIs &&
          !conversation.playback?.isPlayback && (
            <ModelIcon
              size={18}
              entityId={conversation.model.id}
              entity={modelsMap[conversation.model.id]}
            />
          )}
      </ShareIcon>
      <div
        className="relative max-h-5 flex-1 truncate break-all text-left"
        data-qa="chat-name"
      >
        {conversation.name}
      </div>
    </>
  );
}

interface Props {
  item: Conversation;
  level?: number;
}

export const ConversationComponent = ({ item: conversation, level }: Props) => {
  const dispatch = useAppDispatch();

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const selectedConversationIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );
  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const isReplay = useAppSelector(
    ConversationsSelectors.selectIsReplaySelectedConversations,
  );
  const folders = useAppSelector((state) =>
    ConversationsSelectors.selectFilteredFolders(
      state,
      defaultMyItemsFilters,
      '',
      true,
    ),
  );

  const isPlayback = useAppSelector(
    ConversationsSelectors.selectIsPlaybackSelectedConversations,
  );

  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isShowMoveToModal, setIsShowMoveToModal] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragImageRef = useRef<HTMLImageElement | null>();
  const [isSharing, setIsSharing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [isContextMenu, setIsContextMenu] = useState(false);
  const isSelected = selectedConversationIds.includes(conversation.id);

  const { refs, context } = useFloating({
    open: isContextMenu,
    onOpenChange: setIsContextMenu,
  });

  const dismiss = useDismiss(context);
  const { getFloatingProps } = useInteractions([dismiss]);

  useEffect(() => {
    dragImageRef.current = document.createElement('img');
    dragImageRef.current.src = emptyImage;
  }, []);

  const isEmptyConversation = conversation.messages.length === 0;

  const handleRename = useCallback(
    (conversation: Conversation) => {
      if (renameValue.trim().length > 0) {
        dispatch(
          ConversationsActions.updateConversation({
            id: conversation.id,
            values: {
              name: renameValue.trim(),
              isNameChanged: true,
            },
          }),
        );
        setRenameValue('');
        setIsRenaming(false);
        setIsContextMenu(false);
      }
    },
    [dispatch, renameValue],
  );

  const handleEnterDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        handleRename(conversation);
      }
    },
    [conversation, handleRename],
  );

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLButtonElement>, conversation: Conversation) => {
      if (e.dataTransfer) {
        e.dataTransfer.setDragImage(dragImageRef.current || new Image(), 0, 0);
        e.dataTransfer.setData('conversation', JSON.stringify(conversation));
      }
    },
    [],
  );

  const handleConfirm: MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      e.stopPropagation();
      if (isDeleting) {
        dispatch(
          ConversationsActions.deleteConversations({
            conversationIds: [conversation.id],
          }),
        );
      } else if (isRenaming) {
        handleRename(conversation);
      }
      setIsDeleting(false);
      setIsRenaming(false);
    },
    [conversation, dispatch, handleRename, isDeleting, isRenaming],
  );

  const handleCancel: MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      e.stopPropagation();
      setIsDeleting(false);
      setIsRenaming(false);
    },
    [],
  );

  const handleOpenRenameModal: MouseEventHandler<HTMLButtonElement> =
    useCallback(
      (e) => {
        e.stopPropagation();
        setIsRenaming(true);
        setRenameValue(conversation.name);
      },
      [conversation.name],
    );
  const handleOpenDeleteModal: MouseEventHandler<HTMLButtonElement> =
    useCallback((e) => {
      e.stopPropagation();
      setIsDeleting(true);
    }, []);

  const handleStartReplay: MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      e.stopPropagation();
      setIsContextMenu(false);
      dispatch(
        ConversationsActions.createNewReplayConversation({ conversation }),
      );
    },
    [conversation, dispatch],
  );

  const handleCreatePlayback: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      dispatch(
        ConversationsActions.createNewPlaybackConversation({ conversation }),
      );
      setIsContextMenu(false);
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
      setIsContextMenu(false);
      dispatch(
        ConversationsActions.duplicateConversation({
          conversation,
        }),
      );
    },
    [conversation, dispatch],
  );

  useEffect(() => {
    if (isRenaming) {
      setIsDeleting(false);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }); // set auto-focus
    } else if (isDeleting) {
      setIsRenaming(false);
    }
  }, [isRenaming, isDeleting]);

  const handleOpenSharing: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      setIsSharing(true);
      setIsContextMenu(false);
    }, []);

  const handleCloseShareModal = useCallback(() => {
    setIsSharing(false);
  }, []);

  const handleOpenPublishing: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      setIsPublishing(true);
      setIsContextMenu(false);
    }, []);

  const handleClosePublishModal = useCallback(() => {
    setIsPublishing(false);
  }, []);

  const handleOpenUnpublishing: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      setIsUnpublishing(true);
      setIsContextMenu(false);
    }, []);

  const handleCloseUnpublishModal = useCallback(() => {
    setIsUnpublishing(false);
  }, []);

  const handleMoveToFolder = useCallback(
    ({
      folderId,
      isNewFolder,
    }: {
      folderId?: string;
      isNewFolder?: boolean;
    }) => {
      let localFolderId = folderId;
      if (isNewFolder) {
        localFolderId = uuidv4();
        dispatch(
          ConversationsActions.createFolder({
            folderId: localFolderId,
          }),
        );
      }
      dispatch(
        ConversationsActions.updateConversation({
          id: conversation.id,
          values: { folderId: localFolderId },
        }),
      );
    },
    [conversation.id, dispatch],
  );

  const handleContextMenuOpen = (e: MouseEvent) => {
    if (hasParentWithFloatingOverlay(e.target as Element)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setIsContextMenu(true);
  };

  const isHighlighted = isSelected || isRenaming || isDeleting;

  return (
    <div
      className={classNames(
        'group relative flex h-[30px] items-center rounded border-l-2 pr-3 hover:bg-accent-primary-alpha',
        isHighlighted
          ? 'border-l-accent-primary bg-accent-primary-alpha'
          : 'border-l-transparent',
        { 'bg-accent-primary-alpha': isContextMenu },
      )}
      style={{
        paddingLeft: (level && `${0.875 + level * 1.5}rem`) || '0.875rem',
      }}
      onContextMenu={handleContextMenuOpen}
      data-qa="conversation"
    >
      {isRenaming ? (
        <div className="flex w-full items-center gap-2 pr-12">
          <ShareIcon
            {...conversation}
            isHighlighted={isHighlighted}
            featureType={FeatureType.Chat}
          >
            {conversation.replay.replayAsIs && (
              <span className="flex shrink-0">
                <ReplayAsIsIcon size={18} />
              </span>
            )}

            {conversation.playback && conversation.playback.isPlayback && (
              <span className="flex shrink-0">
                <PlaybackIcon size={18} />
              </span>
            )}

            {!conversation.replay.replayAsIs &&
              !conversation.playback?.isPlayback && (
                <ModelIcon
                  size={18}
                  entityId={conversation.model.id}
                  entity={modelsMap[conversation.model.id]}
                />
              )}
          </ShareIcon>
          <input
            className="flex-1 overflow-hidden text-ellipsis bg-transparent text-left outline-none"
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleEnterDown}
            autoFocus
            ref={inputRef}
          />
        </div>
      ) : (
        <button
          className={classNames(
            'group flex h-full w-full cursor-pointer items-center gap-2 transition-colors duration-200',
            messageIsStreaming && 'disabled:cursor-not-allowed',
            isDeleting && 'pr-12',
            !messageIsStreaming && !isDeleting && 'group-hover:pr-6',
            isSelected && 'pr-0',
          )}
          onClick={() => {
            setIsDeleting(false);
            setIsRenaming(false);
            dispatch(
              ConversationsActions.selectConversations({
                conversationIds: [conversation.id],
              }),
            );
          }}
          disabled={messageIsStreaming}
          draggable="true"
          onDragStart={(e) => handleDragStart(e, conversation)}
          onDragOver={(e) => {
            e.preventDefault();
          }}
          ref={buttonRef}
        >
          <ConversationView
            conversation={conversation}
            isHighlited={isHighlighted || isContextMenu}
          />
        </button>
      )}

      {!isDeleting && !isRenaming && !messageIsStreaming && (
        <div
          ref={refs.setFloating}
          {...getFloatingProps()}
          className={classNames(
            'invisible absolute right-3 z-50 flex justify-end group-hover:visible',
          )}
          data-qa="dots-menu"
        >
          <ItemContextMenu
            entity={conversation}
            isEmptyConversation={isEmptyConversation}
            folders={folders}
            featureType={FeatureType.Chat}
            onOpenMoveToModal={() => {
              setIsShowMoveToModal(true);
            }}
            onMoveToFolder={handleMoveToFolder}
            onDelete={handleOpenDeleteModal}
            onRename={handleOpenRenameModal}
            onExport={() => {
              dispatch(
                ConversationsActions.exportConversation({
                  conversationId: conversation.id,
                }),
              );
            }}
            onCompare={!isReplay && !isPlayback ? handleCompare : undefined}
            onDuplicate={handleDuplicate}
            onReplay={!isPlayback ? handleStartReplay : undefined}
            onPlayback={handleCreatePlayback}
            onShare={handleOpenSharing}
            onPublish={handleOpenPublishing}
            onPublishUpdate={handleOpenPublishing}
            onUnpublish={handleOpenUnpublishing}
            onOpenChange={setIsContextMenu}
            isOpen={isContextMenu}
          />
        </div>
      )}
      <div className="md:hidden">
        {isShowMoveToModal && (
          <MoveToFolderMobileModal
            onClose={() => {
              setIsShowMoveToModal(false);
            }}
            folders={folders}
            onMoveToFolder={handleMoveToFolder}
          />
        )}
      </div>

      {(isDeleting || isRenaming) && (
        <div className="absolute right-1 z-10 flex">
          <SidebarActionButton handleClick={handleConfirm}>
            <IconCheck size={18} className="hover:text-accent-primary" />
          </SidebarActionButton>
          <SidebarActionButton handleClick={handleCancel}>
            <IconX
              size={18}
              strokeWidth="2"
              className="hover:text-accent-primary"
            />
          </SidebarActionButton>
        </div>
      )}
      {isSharing && (
        <ShareModal
          entity={conversation}
          type={SharingType.Conversation}
          isOpen
          onClose={handleCloseShareModal}
        />
      )}
      {isPublishing && (
        <PublishModal
          entity={conversation}
          type={SharingType.Conversation}
          isOpen
          onClose={handleClosePublishModal}
        />
      )}
      {isUnpublishing && (
        <UnpublishModal
          entity={conversation}
          type={SharingType.Conversation}
          isOpen
          onClose={handleCloseUnpublishModal}
        />
      )}
    </div>
  );
};
