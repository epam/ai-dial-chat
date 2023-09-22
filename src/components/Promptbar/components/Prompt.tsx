import { IconBulb } from '@tabler/icons-react';
import {
  DragEvent,
  MouseEventHandler,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import useOutsideAlerter from '@/src/hooks/useOutsideAlerter';

import { exportPrompt } from '@/src/utils/app/import-export';

import { Prompt } from '@/src/types/prompt';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';

import SidebarActionButton from '@/src/components/Buttons/SidebarActionButton';
import { ContextMenu } from '@/src/components/Common/ContextMenu';
import { MoveToFolderMobileModal } from '@/src/components/Common/MoveToFolderMobileModal';

import CheckIcon from '../../../../public/images/icons/check.svg';
import XmarkIcon from '../../../../public/images/icons/xmark.svg';
import { PromptModal } from './PromptModal';

import classNames from 'classnames';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  prompt: Prompt;
}

export const PromptComponent = ({ prompt }: Props) => {
  const { t } = useTranslation('chat');
  const dispatch = useAppDispatch();

  const folders = useAppSelector(PromptsSelectors.selectFolders);

  const [showModal, setShowModal] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const [isShowMoveToModal, setIsShowMoveToModal] = useState(false);

  const wrapperRef = useRef(null);

  const handleUpdate = useCallback(
    (prompt: Prompt) => {
      dispatch(
        PromptsActions.updatePrompt({ promptId: prompt.id, values: prompt }),
      );
      dispatch(PromptsActions.setSearchTerm({ searchTerm: '' }));
      setIsRenaming(false);
    },
    [dispatch],
  );

  const handleDelete: MouseEventHandler = useCallback(
    (e) => {
      e.stopPropagation();
      e.preventDefault();

      if (isDeleting) {
        dispatch(PromptsActions.deletePrompt({ promptId: prompt.id }));
        dispatch(PromptsActions.setSearchTerm({ searchTerm: '' }));
      }

      setIsDeleting(false);
      setIsSelected(false);
    },
    [dispatch, isDeleting, prompt.id],
  );

  const handleCancelDelete: MouseEventHandler = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();

    setIsDeleting(false);
  }, []);

  const handleOpenDeleteModal: MouseEventHandler = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();

    setIsDeleting(true);
  }, []);

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLButtonElement>, prompt: Prompt) => {
      if (e.dataTransfer) {
        e.dataTransfer.setData('prompt', JSON.stringify(prompt));
      }
    },
    [],
  );

  const handleOpenRenameModal: MouseEventHandler = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();

    setShowModal(true);
    setIsRenaming(true);
  }, []);

  const handleOnClickPrompt: MouseEventHandler = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    setIsSelected(true);
  }, []);

  const handleExportPrompt: MouseEventHandler = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      exportPrompt(prompt.id);
    },
    [prompt.id],
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
          PromptsActions.createFolder({
            name: t('New folder'),
            folderId: localFolderId,
          }),
        );
      }
      dispatch(
        PromptsActions.updatePrompt({
          promptId: prompt.id,
          values: { folderId: localFolderId },
        }),
      );
    },
    [dispatch, prompt.id, t],
  );

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
        'group relative flex h-[42px] cursor-pointer items-center rounded transition-colors duration-200 hover:bg-violet/15',
        isSelected ? 'border-l-2 border-l-violet bg-violet/15' : '',
      )}
      ref={wrapperRef}
      onClick={handleOnClickPrompt}
      data-qa="prompt"
    >
      <button
        className="flex h-full w-full items-center gap-3 px-3 "
        draggable="true"
        onDragStart={(e) => handleDragStart(e, prompt)}
      >
        <IconBulb size={18} className="text-gray-500" />

        <div className="relative max-h-5 flex-1 truncate break-all pr-4 text-left leading-3">
          {prompt.name}
        </div>
      </button>

      {isDeleting && (
        <div className="absolute right-1 z-10 flex">
          <SidebarActionButton handleClick={handleDelete}>
            <CheckIcon
              width={18}
              height={18}
              size={18}
              className="hover:text-violet"
            />
          </SidebarActionButton>

          <SidebarActionButton handleClick={handleCancelDelete}>
            <XmarkIcon
              width={18}
              height={18}
              size={18}
              strokeWidth="2"
              className="hover:text-violet"
            />
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
            folders={folders}
            onMoveToFolder={handleMoveToFolder}
            onDelete={handleOpenDeleteModal}
            onRename={handleOpenRenameModal}
            onExport={handleExportPrompt}
            onOpenMoveToModal={() => {
              setIsShowMoveToModal(true);
            }}
            highlightColor="violet"
          />
        </div>
      )}
      <div className="md:hidden">
        {isShowMoveToModal && (
          <MoveToFolderMobileModal
            folders={folders}
            onMoveToFolder={handleMoveToFolder}
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
