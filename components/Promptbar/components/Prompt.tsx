import {
  IconBulbFilled,
  IconCheck,
  IconDots,
  IconX,
} from '@tabler/icons-react';
import {
  DragEvent,
  MouseEventHandler,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import useOutsideAlerter from '@/hooks/useOutsideAlerter';

import { exportPrompt } from '@/utils/app/importExport';

import { Prompt } from '@/types/prompt';

import SidebarActionButton from '@/components/Buttons/SidebarActionButton';
import { ContextMenu } from '@/components/Common/ContextMenu';

import PromptbarContext from '../PromptBar.context';
import { PromptModal } from './PromptModal';

interface Props {
  prompt: Prompt;
}

export const PromptComponent = ({ prompt }: Props) => {
  const {
    dispatch: promptDispatch,
    handleUpdatePrompt,
    handleDeletePrompt,
  } = useContext(PromptbarContext);

  const [showModal, setShowModal] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isContextMenuOpened, setIsContextMenuOpened] = useState(false);
  const [isSelected, setIsSelected] = useState(false);

  const contextMenuParentRef = useRef(null);
  const wrapperRef = useRef(null);

  const handleUpdate = (prompt: Prompt) => {
    handleUpdatePrompt(prompt);
    promptDispatch({ field: 'searchTerm', value: '' });
    setIsRenaming(false);
  };

  const handleDelete: MouseEventHandler = (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (isDeleting) {
      handleDeletePrompt(prompt);
      promptDispatch({ field: 'searchTerm', value: '' });
    }

    setIsDeleting(false);
    setIsContextMenuOpened(false);
    setIsSelected(false);
  };

  const handleCancelDelete: MouseEventHandler = (e) => {
    e.stopPropagation();
    e.preventDefault();

    setIsDeleting(false);
    setIsContextMenuOpened(false);
  };

  const handleOpenDeleteModal: MouseEventHandler = (e) => {
    e.stopPropagation();
    e.preventDefault();

    setIsDeleting(true);
  };

  const handleDragStart = (e: DragEvent<HTMLButtonElement>, prompt: Prompt) => {
    if (e.dataTransfer) {
      e.dataTransfer.setData('prompt', JSON.stringify(prompt));
    }
  };

  const handleOpenRenameModal: MouseEventHandler = (e) => {
    e.stopPropagation();
    e.preventDefault();

    setShowModal(true);
    setIsRenaming(true);
  };

  const handleOnClickPrompt: MouseEventHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();

    setIsSelected(true);
  };

  const handleOnClickContextMenuButton: MouseEventHandler = (e) => {
    e.stopPropagation();
    e.preventDefault();

    setIsContextMenuOpened((isOpened) => !isOpened);
  };

  const handleExportPrompt: MouseEventHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();

    exportPrompt(prompt.id);
    setIsContextMenuOpened(false);
  };

  useEffect(() => {
    if (isRenaming) {
      setIsDeleting(false);
      setIsContextMenuOpened(false);
    } else if (isDeleting) {
      setIsRenaming(false);
      setIsContextMenuOpened(false);
    }
  }, [isRenaming, isDeleting]);

  useOutsideAlerter(wrapperRef, setIsContextMenuOpened);
  useOutsideAlerter(wrapperRef, setIsSelected);

  return (
    <div className="relative flex items-center">
      <button
        className={`flex w-full cursor-pointer items-center gap-3 rounded-lg p-3 text-sm transition-colors duration-200 ${
          isSelected ? 'bg-[#343541]/90' : ''
        } hover:bg-[#343541]/90`}
        draggable="true"
        onClick={handleOnClickPrompt}
        onDragStart={(e) => handleDragStart(e, prompt)}
      >
        <IconBulbFilled size={18} />

        <div className="relative max-h-5 flex-1 truncate break-all pr-4 text-left text-[12.5px] leading-3">
          {prompt.name}
        </div>
      </button>

      {isDeleting && (
        <div className="absolute right-1 z-10 flex text-gray-300">
          <SidebarActionButton handleClick={handleDelete}>
            <IconCheck size={18} />
          </SidebarActionButton>

          <SidebarActionButton handleClick={handleCancelDelete}>
            <IconX size={18} />
          </SidebarActionButton>
        </div>
      )}
      {isSelected && !isDeleting && !isRenaming && (
        <div
          className="z-100 absolute right-1 flex text-gray-300"
          ref={wrapperRef}
          onClick={handleOnClickPrompt}
        >
          <SidebarActionButton handleClick={handleOnClickContextMenuButton}>
            <IconDots size={18} />
          </SidebarActionButton>
          <div className="relative" ref={contextMenuParentRef}>
            {!isDeleting && !isRenaming && isContextMenuOpened && (
              <ContextMenu
                parentRef={contextMenuParentRef}
                onDelete={handleOpenDeleteModal}
                onRename={handleOpenRenameModal}
                onExport={handleExportPrompt}
                featureType="prompt"
              />
            )}
          </div>
        </div>
      )}

      {showModal && (
        <PromptModal
          prompt={prompt}
          onClose={() => {
            setShowModal(false);
            setIsRenaming(false);
          }}
          onUpdatePrompt={handleUpdate}
        />
      )}
    </div>
  );
};
