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
import { ContextMenu } from '@/components/Common/NewContextMenu';

import CheckIcon from '../../../public/images/icons/check.svg';
import LightbulbIcon from '../../../public/images/icons/lightbulb.svg';
import XmarkIcon from '../../../public/images/icons/xmark.svg';
import PromptbarContext from '../PromptBar.context';
import { PromptModal } from './PromptModal';

import classNames from 'classnames';

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
  const [isShowContextMenuButton, setIsShowContextMenuButton] = useState(true);

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
        'relative flex  h-[42px] cursor-pointer items-center rounded-[3px] transition-colors duration-200 hover:bg-green/[15%]',
        isSelected ? 'border-l-2 border-l-green bg-green/[15%]' : '',
      )}
      onMouseOver={onMouseOverHandler}
      onMouseLeave={onMouseLeaveHandler}
      ref={wrapperRef}
      onClick={handleOnClickPrompt}
    >
      <button
        className="flex w-full items-center gap-3  px-3 "
        draggable="true"
        onDragStart={(e) => handleDragStart(e, prompt)}
      >
        <LightbulbIcon width={18} height={18} size={18} />

        <div className="relative max-h-5 flex-1 truncate break-all pr-4 text-left leading-3">
          {prompt.name}
        </div>
      </button>

      {(isDeleting || isRenaming) && (
        <div className="absolute right-1 z-10 flex">
          <SidebarActionButton handleClick={handleDelete}>
            <CheckIcon width={18} height={18} size={18} />
          </SidebarActionButton>

          <SidebarActionButton handleClick={handleCancelDelete}>
            <XmarkIcon width={18} height={18} size={18} strokeWidth="2" />
          </SidebarActionButton>
        </div>
      )}
      {isShowContextMenuButton && !isDeleting && !isRenaming && (
        <div
          className="absolute right-1 z-50 flex"
          onMouseOver={onMouseOverHandler}
          onMouseLeave={onMouseLeaveHandler}
        >
          <ContextMenu
            featureType="prompt"
            onDelete={handleOpenDeleteModal}
            onRename={handleOpenRenameModal}
            onExport={handleExportPrompt}
            prompt={prompt}
          />
        </div>
        // <div
        //   className="absolute right-1 z-10 flex "
        //   ref={wrapperRef}
        //   onClick={handleOnClickPrompt}
        // >
        //   <SidebarActionButton handleClick={handleOnClickContextMenuButton}>
        //     <IconDots size={18} />
        //   </SidebarActionButton>
        //   <div className="relative" ref={contextMenuParentRef}>
        //     {!isDeleting && !isRenaming && isContextMenuOpened && (
        //       <ContextMenu
        //         parentRef={contextMenuParentRef}
        //         onDelete={handleOpenDeleteModal}
        //         onRename={handleOpenRenameModal}
        //         onExport={handleExportPrompt}
        //         featureType="prompt"
        //       />
        //     )}
        //   </div>
        // </div>
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
