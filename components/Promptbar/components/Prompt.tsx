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
import { MoveToFolderMobileModal } from '@/components/Common/MoveToFolderMobileModal';
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
  const [isSelected, setIsSelected] = useState(false);
  const [isShowMoveToModal, setIsShowMoveToModal] = useState(false);

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
    setIsSelected(false);
  };

  const handleCancelDelete: MouseEventHandler = (e) => {
    e.stopPropagation();
    e.preventDefault();

    setIsDeleting(false);
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

  const handleExportPrompt: MouseEventHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();

    exportPrompt(prompt.id);
  };
  const movePromptToFolder = (folderId: string) => {
    const newPrompt = { ...prompt, folderId: folderId };
    prompt.folderId;
    handleUpdatePrompt(newPrompt);
  };

  useEffect(() => {
    if (isRenaming) {
      setIsDeleting(false);
    } else if (isDeleting) {
      setIsRenaming(false);
    }
  }, [isRenaming, isDeleting]);

  useOutsideAlerter(wrapperRef, setIsSelected);

  return (
    <div
      className={classNames(
        'group relative flex h-[42px] cursor-pointer items-center rounded-[3px] transition-colors duration-200 hover:bg-violet/[15%]',
        isSelected ? 'border-l-2 border-l-violet bg-violet/[15%]' : '',
      )}
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
      {!isDeleting && !isRenaming && (
        <div
          className={classNames(
            'invisible absolute right-0 z-50 flex justify-end md:group-hover:visible',
            isSelected ? 'max-md:visible' : '',
          )}
          ref={wrapperRef}
        >
          <ContextMenu
            featureType="prompt"
            moveToFolder={movePromptToFolder}
            onDelete={handleOpenDeleteModal}
            onRename={handleOpenRenameModal}
            onExport={handleExportPrompt}
            onOpenMoveToModal={() => {
              setIsShowMoveToModal(true);
            }}
            item={prompt}
            highlightColor="violet/[15%]"
          />
        </div>
      )}
      <div className="md:hidden">
        {isShowMoveToModal && (
          <MoveToFolderMobileModal
            featureType="prompt"
            item={prompt}
            moveToFolder={movePromptToFolder}
            onClose={() => {
              setIsShowMoveToModal(false);
            }}
          />
        )}
      </div>
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
