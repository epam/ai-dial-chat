import { IconCheck, IconDots, IconX } from '@tabler/icons-react';
import {
  DragEvent,
  KeyboardEvent,
  MouseEventHandler,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import useOutsideAlerter from '@/hooks/useOutsideAlerter';

import { Conversation } from '@/types/chat';

import HomeContext from '@/pages/api/home/home.context';

import SidebarActionButton from '@/components/Buttons/SidebarActionButton';
import ChatbarContext from '@/components/Chatbar/Chatbar.context';

import { ContextMenu } from '../../Common/ContextMenu';
import { ModelIcon } from './ModelIcon';

interface Props {
  conversation: Conversation;
}

export const ConversationComponent = ({ conversation }: Props) => {
  const {
    state: { messageIsStreaming, selectedConversationIds, modelIconMapping },
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
  const [isContextMenuOpened, setIsContextMenuOpened] = useState(false);
  const contextMenuParentRef = useRef(null);

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
    setIsContextMenuOpened(false);
    setIsRenaming(true);
    setRenameValue(conversation.name);
  };
  const handleOpenDeleteModal: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation();
    setIsContextMenuOpened(false);
    setIsDeleting(true);
  };

  const handleStartReplay: MouseEventHandler<HTMLLIElement> = (e) => {
    e.stopPropagation();

    setIsContextMenuOpened(false);
    handleNewReplayConversation(conversation);
  };

  useEffect(() => {
    if (isRenaming) {
      setIsDeleting(false);
    } else if (isDeleting) {
      setIsRenaming(false);
    }
  }, [isRenaming, isDeleting]);

  const wrapperRef = useRef(null);

  useOutsideAlerter(wrapperRef, setIsContextMenuOpened);

  return (
    <div className="relative flex items-center">
      {isRenaming && selectedConversationIds.includes(conversation.id) ? (
        <div className="flex w-full items-center gap-3 rounded-lg bg-[#343541]/90 p-3">
          <ModelIcon
            size={18}
            modelIconMapping={modelIconMapping}
            modelId={conversation.model.id}
            modelName={conversation.model.name}
            inverted
          />

          <input
            className="mr-12 flex-1 overflow-hidden text-ellipsis border-neutral-400 bg-transparent text-left text-[12.5px] leading-3 text-white outline-none focus:border-neutral-100"
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleEnterDown}
            autoFocus
          />
        </div>
      ) : (
        <button
          className={`flex w-full cursor-pointer items-center gap-3 rounded-lg p-3 text-sm transition-colors duration-200 hover:bg-[#343541]/90 ${
            messageIsStreaming ? 'disabled:cursor-not-allowed' : ''
          } ${
            selectedConversationIds.includes(conversation.id)
              ? 'bg-[#343541]/90'
              : ''
          }`}
          onClick={() => {
            setIsDeleting(false);
            setIsContextMenuOpened(false);
            setIsRenaming(false);
            handleSelectConversation(conversation);
          }}
          disabled={messageIsStreaming}
          draggable="true"
          onDragStart={(e) => handleDragStart(e, conversation)}
        >
          <ModelIcon
            size={18}
            modelIconMapping={modelIconMapping}
            modelId={conversation.model.id}
            modelName={conversation.model.name}
            inverted
          />
          <div
            className={`relative max-h-5 flex-1 truncate break-all text-left text-[12.5px] leading-3${
              selectedConversationIds.includes(conversation.id)
                ? 'pr-12'
                : 'pr-1'
            }`}
          >
            {conversation.name}
          </div>
        </button>
      )}

      {selectedConversationIds.includes(conversation.id) &&
        !isDeleting &&
        !isRenaming &&
        !messageIsStreaming && (
          <div
            className="z-100 absolute right-1 flex text-gray-300"
            ref={wrapperRef}
          >
            <SidebarActionButton
              handleClick={(e) => {
                e.stopPropagation();
                setIsContextMenuOpened((isOpened) => !isOpened);
              }}
            >
              <IconDots size={18} />
            </SidebarActionButton>
            <div className="relative" ref={contextMenuParentRef}>
              {!isDeleting && !isRenaming && isContextMenuOpened && (
                <ContextMenu
                  parentRef={contextMenuParentRef}
                  onDelete={handleOpenDeleteModal}
                  onRename={handleOpenRenameModal}
                  onExport={() => {
                    setIsContextMenuOpened(false);
                    handleExportConversation(conversation.id);
                  }}
                  onCompare={() => {
                    dispatch({
                      field: 'isCompareMode',
                      value: true,
                    });
                    setIsContextMenuOpened(false);
                  }}
                  onReplay={handleStartReplay}
                  isEmptyConversation={isEmptyConversation}
                  featureType="conversation"
                />
              )}
            </div>
          </div>
        )}

      {(isDeleting || isRenaming) &&
        selectedConversationIds.includes(conversation.id) && (
          <div className="absolute right-1 z-10 flex text-gray-300">
            <SidebarActionButton handleClick={handleConfirm}>
              <IconCheck size={18} />
            </SidebarActionButton>
            <SidebarActionButton handleClick={handleCancel}>
              <IconX size={18} />
            </SidebarActionButton>
          </div>
        )}
    </div>
  );
};
