import {
  DragEvent,
  KeyboardEvent,
  MouseEventHandler,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { Conversation } from '@/types/chat';

import HomeContext from '@/pages/api/home/home.context';

import SidebarActionButton from '@/components/Buttons/SidebarActionButton';
import ChatbarContext from '@/components/Chatbar/Chatbar.context';

import CheckIcon from '../../../public/images/icons/check.svg';
import XmarkIcon from '../../../public/images/icons/xmark.svg';
import { ContextMenu } from '../../Common/NewContextMenu';
import { ModelIcon } from './ModelIcon';

import classNames from 'classnames';

interface Props {
  conversation: Conversation;
}

export const ConversationComponent = ({ conversation }: Props) => {
  const {
    state: {
      messageIsStreaming,
      selectedConversationIds,
      modelsMap,
      lightMode,
    },
    handleSelectConversation,
    handleUpdateConversation,
    handleNewReplayConversation,
    dispatch,
  } = useContext(HomeContext);
  const { handleExportConversation } = useContext(ChatbarContext);

  const { handleDeleteConversation } = useContext(ChatbarContext);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isShowContextMenuButton, setIsShowContextMenuButton] = useState(false);
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
      handleUpdateConversation(conversation, {
        key: 'name',
        value: renameValue,
      });
      setRenameValue('');
      setIsRenaming(false);
    }
  };

  const handleConfirm: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation();
    if (isDeleting) {
      handleDeleteConversation(conversation);
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

    handleNewReplayConversation(conversation);
  };

  useEffect(() => {
    if (isRenaming) {
      setIsDeleting(false);
    } else if (isDeleting) {
      setIsRenaming(false);
    }
  }, [isRenaming, isDeleting]);

  const onMouseOverHandler: MouseEventHandler = (e) => {
    e.stopPropagation();
    setIsShowContextMenuButton(true);
  };
  const onMouseLeaveHandler: MouseEventHandler = (e) => {
    e.stopPropagation();
    setIsShowContextMenuButton(false);
  };

  return (
    <div
      className={classNames(
        'relative flex h-[42px] items-center rounded-[3px] hover:bg-green/[15%]',
        selectedConversationIds.includes(conversation.id)
          ? 'border-l-2 border-l-green bg-green/[15%]'
          : '',
      )}
    >
      {isRenaming && selectedConversationIds.includes(conversation.id) ? (
        <div className="flex w-full items-center gap-3 px-3">
          <ModelIcon
            size={18}
            inverted={lightMode === 'dark'}
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
          className={`flex w-full cursor-pointer items-center gap-3 px-3 transition-colors duration-200 ${
            messageIsStreaming ? 'disabled:cursor-not-allowed' : ''
          }`}
          onClick={() => {
            setIsDeleting(false);
            setIsRenaming(false);
            handleSelectConversation(conversation);
          }}
          onMouseOver={onMouseOverHandler}
          onMouseLeave={onMouseLeaveHandler}
          disabled={messageIsStreaming}
          draggable="true"
          onDragStart={(e) => handleDragStart(e, conversation)}
          ref={buttonRef}
        >
          <ModelIcon
            size={18}
            entityId={conversation.model.id}
            entity={modelsMap[conversation.model.id]}
            inverted={lightMode === 'dark'}
          />
          <div
            className={`relative max-h-5 flex-1 truncate break-all text-left leading-3 ${
              selectedConversationIds.includes(conversation.id)
                ? 'pr-12'
                : 'pr-1'
            }`}
          >
            {conversation.name}
          </div>
        </button>
      )}

      {isShowContextMenuButton &&
        !isDeleting &&
        !isRenaming &&
        !messageIsStreaming && (
          <div
            className="absolute right-1 z-50 flex"
            ref={wrapperRef}
            onMouseOver={onMouseOverHandler}
            onMouseLeave={onMouseLeaveHandler}
          >
            <ContextMenu
              conversation={conversation}
              onDelete={handleOpenDeleteModal}
              onRename={handleOpenRenameModal}
              onExport={() => {
                handleExportConversation(conversation.id);
              }}
              onCompare={() => {
                dispatch({
                  field: 'isCompareMode',
                  value: true,
                });
              }}
              onReplay={handleStartReplay}
              isEmptyConversation={isEmptyConversation}
              featureType="chat"
            />
          </div>
        )}

      {(isDeleting || isRenaming) &&
        selectedConversationIds.includes(conversation.id) && (
          <div className="absolute right-1 z-10 flex">
            <SidebarActionButton handleClick={handleConfirm}>
              <CheckIcon width={18} height={18} size={18} />
            </SidebarActionButton>
            <SidebarActionButton handleClick={handleCancel}>
              <XmarkIcon width={18} height={18} size={18} strokeWidth="2" />
            </SidebarActionButton>
          </div>
        )}
    </div>
  );
};
