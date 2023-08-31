import {
  DragEvent,
  KeyboardEvent,
  MouseEventHandler,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import { Conversation } from '@/types/chat';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { ModelsSelectors } from '@/store/models/models.reducers';
import { UIActions, UISelectors } from '@/store/ui-store/ui.reducers';

import SidebarActionButton from '@/components/Buttons/SidebarActionButton';
import { MoveToFolderMobileModal } from '@/components/Common/MoveToFolderMobileModal';

import CheckIcon from '../../../public/images/icons/check.svg';
import XmarkIcon from '../../../public/images/icons/xmark.svg';
import { ContextMenu } from '../../Common/ContextMenu';
import { ModelIcon } from './ModelIcon';

import classNames from 'classnames';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  conversation: Conversation;
}

export const ConversationComponent = ({ conversation }: Props) => {
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
  const folders = useAppSelector(ConversationsSelectors.selectFolders);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isShowMoveToModal, setIsShowMoveToModal] = useState(false);
  const wrapperRef = useRef(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isEmptyConversation = conversation.messages.length === 0;

  const handleEnterDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRename(conversation);
    }
  };

  const handleDragStart = (
    e: DragEvent<HTMLButtonElement>,
    conversation: Conversation,
  ) => {
    if (e.dataTransfer) {
      e.dataTransfer.setData('conversation', JSON.stringify(conversation));
    }
  };

  const handleRename = (conversation: Conversation) => {
    if (renameValue.trim().length > 0) {
      dispatch(
        ConversationsActions.updateConversation({
          id: conversation.id,
          values: {
            name: renameValue,
          },
        }),
      );
      setRenameValue('');
      setIsRenaming(false);
    }
  };

  const handleConfirm: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation();
    if (isDeleting) {
      dispatch(
        ConversationsActions.deleteConversation({
          conversationId: conversation.id,
        }),
      );
    } else if (isRenaming) {
      handleRename(conversation);
    }
    setIsDeleting(false);
    setIsRenaming(false);
  };

  const handleCancel: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation();
    setIsDeleting(false);
    setIsRenaming(false);
  };

  const handleOpenRenameModal: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation();
    setIsRenaming(true);
    setRenameValue(conversation.name);
  };
  const handleOpenDeleteModal: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation();
    setIsDeleting(true);
  };

  const handleStartReplay: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation();

    dispatch(
      ConversationsActions.createNewReplayConversation({ conversation }),
    );
  };

  useEffect(() => {
    if (isRenaming) {
      setIsDeleting(false);
    } else if (isDeleting) {
      setIsRenaming(false);
    }
  }, [isRenaming, isDeleting]);

  const handleMoveToFolder = ({
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
  };

  return (
    <div
      className={classNames(
        'group relative flex h-[42px] items-center rounded hover:bg-green/15',
        selectedConversationIds.includes(conversation.id)
          ? 'border-l-2 border-l-green bg-green/15'
          : '',
      )}
    >
      {isRenaming ? (
        <div className="flex w-full items-center gap-3 px-3">
          <ModelIcon
            size={18}
            inverted={theme === 'dark'}
            entityId={conversation.model.id}
            entity={modelsMap[conversation.model.id]}
          />

          <input
            className="mr-12 flex-1 overflow-hidden text-ellipsis bg-transparent text-left leading-3 outline-none"
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleEnterDown}
            autoFocus
          />
        </div>
      ) : (
        <button
          className={`group flex h-full w-full cursor-pointer items-center gap-3 px-3 transition-colors duration-200 ${
            messageIsStreaming ? 'disabled:cursor-not-allowed' : ''
          }`}
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
          <ModelIcon
            size={18}
            entityId={conversation.model.id}
            entity={modelsMap[conversation.model.id]}
            inverted={theme === 'dark'}
          />
          <div
            className={`relative max-h-5 flex-1 truncate break-all text-left leading-3  ${
              isDeleting || isRenaming ? 'pr-10' : 'group-hover:pr-5'
            }`}
          >
            {conversation.name}
          </div>
        </button>
      )}

      {!isDeleting && !isRenaming && !messageIsStreaming && (
        <div
          className={classNames(
            'invisible absolute right-3 z-50 flex justify-end md:group-hover:visible',
            selectedConversationIds.includes(conversation.id)
              ? 'max-md:visible'
              : '',
          )}
          ref={wrapperRef}
        >
          <ContextMenu
            isEmptyConversation={isEmptyConversation}
            folders={folders}
            featureType="chat"
            highlightColor="green"
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
            onCompare={() => {
              dispatch(
                ConversationsActions.selectConversations({
                  conversationIds: [conversation.id],
                }),
              );
              dispatch(UIActions.setIsCompareMode(true));
            }}
            onReplay={handleStartReplay}
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
            <CheckIcon
              width={18}
              height={18}
              size={18}
              className="hover:text-green"
            />
          </SidebarActionButton>
          <SidebarActionButton handleClick={handleCancel}>
            <XmarkIcon
              width={18}
              height={18}
              size={18}
              strokeWidth="2"
              className="hover:text-green"
            />
          </SidebarActionButton>
        </div>
      )}
    </div>
  );
};
