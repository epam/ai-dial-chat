import { IconCheck, IconUserShare, IconX } from '@tabler/icons-react';
import {
  DragEvent,
  KeyboardEvent,
  MouseEventHandler,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Conversation } from '@/src/types/chat';
import { FeatureType, HighlightColor } from '@/src/types/common';
import { Feature } from '@/src/types/features';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import { emptyImage } from '@/src/constants/drag-and-drop';

import SidebarActionButton from '@/src/components/Buttons/SidebarActionButton';
import { MoveToFolderMobileModal } from '@/src/components/Common/MoveToFolderMobileModal';

import { PlaybackIcon } from '../../Chat/PlaybackIcon';
import { ReplayAsIsIcon } from '../../Chat/ReplayAsIsIcon';
import ShareModal, { SharingType } from '../../Chat/ShareModal';
import { ContextMenu } from '../../Common/ContextMenu';
import { ModelIcon } from './ModelIcon';

import { v4 as uuidv4 } from 'uuid';

interface Props {
  item: Conversation;
  level?: number;
  readonly?: boolean;
}

export const ConversationComponent = ({ item: conversation, level, readonly }: Props) => {
  const { t } = useTranslation('chat');
  const dispatch = useAppDispatch();

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const theme = useAppSelector(UISelectors.selectThemeState);

  const selectedConversationIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );
  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const isReplay = useAppSelector(
    ConversationsSelectors.selectIsReplaySelectedConversations,
  );
  const folders = useAppSelector(ConversationsSelectors.selectFolders);

  const isPlayback = useAppSelector(
    ConversationsSelectors.selectIsPlaybackSelectedConversations,
  );

  const isSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.ConversationsSharing),
  );

  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isShowMoveToModal, setIsShowMoveToModal] = useState(false);
  const wrapperRef = useRef(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragImageRef = useRef<HTMLImageElement | null>();
  const [isSharing, setIsSharing] = useState(false);
  const { id: conversationId, isShared } = conversation;
  const showSharedIcon = isSharingEnabled && isShared && !isDeleting;

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
    }, [conversation, dispatch]);

  useEffect(() => {
    if (isRenaming) {
      setIsDeleting(false);
      setTimeout(() => inputRef.current?.focus()); // set auto-focus
    } else if (isDeleting) {
      setIsRenaming(false);
    }
  }, [isRenaming, isDeleting]);

  const handleOpenSharing: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      setIsSharing(true);
    }, []);

  const handleCloseShareModal = useCallback(() => {
    setIsSharing(false);
  }, []);

  const handleShared = useCallback(
    (_newShareId: string) => {
      //TODO: send newShareId to API to store {id, createdDate}
      if (!isShared) {
        dispatch(
          ConversationsActions.updateConversation({
            id: conversationId,
            values: {
              //isShared: true,
              sharedWithMe: true //TODO: for development purpose - emulate immediate sharing with yourself
            },
          }),
        );
      }
    },
    [conversationId, dispatch, isShared],
  );

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
            name: t('New folder'),
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
    [conversation.id, dispatch, t],
  );

  return (
    <div
      className={classNames(
        'group relative flex h-[30px] items-center rounded border-l-2 pr-3 hover:bg-green/15',
        selectedConversationIds.includes(conversation.id)
          ? 'border-l-green bg-green/15'
          : 'border-l-transparent',
      )}
      style={{
        paddingLeft: (level && `${0.875 + level * 1.5}rem`) || '0.875rem',
      }}
      data-qa="conversation"
    >
      {isRenaming ? (
        <div className="flex w-full items-center gap-2 pr-12">
          {conversation.replay.replayAsIs ? (
            <span className="relative inline-block shrink-0 leading-none">
              <ReplayAsIsIcon size={18} />
            </span>
          ) : (
            <ModelIcon
              size={18}
              inverted={theme === 'dark'}
              entityId={conversation.model.id}
              entity={modelsMap[conversation.model.id]}
            />
          )}

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
            !messageIsStreaming && !readonly && !isDeleting && 'group-hover:pr-6',
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
                inverted={theme === 'dark'}
              />
            )}

          <div
            className={classNames(
              'relative max-h-5 flex-1 truncate break-all text-left',
            )}
          >
            {conversation.name}
          </div>
          {showSharedIcon && (
            <span className="flex shrink-0 text-gray-500">
              <IconUserShare size={14} />
            </span>
          )}
        </button>
      )}

      {!isDeleting && !isRenaming && !messageIsStreaming && !readonly && (
        <div
          className={classNames(
            'invisible absolute right-3 z-50 flex justify-end md:group-hover:visible',
            selectedConversationIds.includes(conversation.id)
              ? 'max-md:visible'
              : '',
          )}
          ref={wrapperRef}
          data-qa="dots-menu"
        >
          <ContextMenu
            isEmptyConversation={isEmptyConversation}
            folders={folders}
            featureType={FeatureType.Chat}
            highlightColor={HighlightColor.Green}
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
            onCompare={
              !isReplay && !isPlayback
                ? () => {
                    dispatch(
                      ConversationsActions.selectConversations({
                        conversationIds: [conversation.id],
                      }),
                    );
                    dispatch(UIActions.setIsCompareMode(true));
                  }
                : undefined
            }
            onReplay={!isPlayback ? handleStartReplay : undefined}
            onPlayback={handleCreatePlayback}
            onOpenShareModal={isSharingEnabled ? handleOpenSharing : undefined}
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
            <IconCheck size={18} className="hover:text-green" />
          </SidebarActionButton>
          <SidebarActionButton handleClick={handleCancel}>
            <IconX size={18} strokeWidth="2" className="hover:text-green" />
          </SidebarActionButton>
        </div>
      )}
      {isSharing && (
        <ShareModal
          entity={conversation}
          type={SharingType.Conversation}
          isOpen
          onClose={handleCloseShareModal}
          onShare={handleShared}
        />
      )}
    </div>
  );
};
