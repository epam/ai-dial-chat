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

import classNames from 'classnames';

import { Prompt } from '@/src/types/prompt';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';

import { stopBubbling } from '@/src/constants/chat';

import SidebarActionButton from '@/src/components/Buttons/SidebarActionButton';
import { ContextMenu } from '@/src/components/Common/ContextMenu';
import { MoveToFolderMobileModal } from '@/src/components/Common/MoveToFolderMobileModal';

import CheckIcon from '../../../../public/images/icons/check.svg';
import XmarkIcon from '../../../../public/images/icons/xmark.svg';
import { PromptModal } from './PromptModal';

import { v4 as uuidv4 } from 'uuid';

interface Props {
  item: Prompt;
  level?: number;
}

export const PromptComponent = ({ item: prompt, level }: Props) => {
  const { t } = useTranslation('chat');
  const dispatch = useAppDispatch();

  const folders = useAppSelector(PromptsSelectors.selectFolders);
  const selectedPromptId = useAppSelector(
    PromptsSelectors.selectSelectedPromptId,
  );
  const showModal = useAppSelector(PromptsSelectors.selectIsEditModalOpen);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
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
        dispatch(PromptsActions.deletePrompts({ promptIds: [prompt.id] }));
        dispatch(PromptsActions.setSearchTerm({ searchTerm: '' }));
      }

      setIsDeleting(false);
      dispatch(PromptsActions.setSelectedPrompt({ promptId: undefined }));
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

  const handleOpenEditModal: MouseEventHandler = useCallback(
    (e) => {
      e.stopPropagation();
      e.preventDefault();
      dispatch(PromptsActions.setSelectedPrompt({ promptId: prompt.id }));
      dispatch(PromptsActions.setIsEditModalOpen({ isOpen: true }));
      setIsRenaming(true);
    },
    [dispatch, prompt.id],
  );

  const handleExportPrompt: MouseEventHandler = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      dispatch(
        PromptsActions.exportPrompt({
          promptId: prompt.id,
        }),
      );
    },
    [dispatch, prompt.id],
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

  const handleClose = useCallback(() => {
    dispatch(PromptsActions.setIsEditModalOpen({ isOpen: false }));
    setIsRenaming(false);
  }, [dispatch]);

  useEffect(() => {
    if (isRenaming) {
      setIsDeleting(false);
    } else if (isDeleting) {
      setIsRenaming(false);
    }
  }, [isRenaming, isDeleting]);

  return (
    <div
      className={classNames(
        'group relative flex h-[30px] shrink-0 cursor-pointer items-center rounded border-l-2 pr-3 transition-colors duration-200 hover:bg-violet/15',
        selectedPromptId === prompt.id
          ? 'border-l-violet bg-violet/15'
          : 'border-l-transparent',
      )}
      style={{
        paddingLeft: (level && `${0.875 + level * 1.5}rem`) || '0.875rem',
      }}
      ref={wrapperRef}
      onClick={handleOpenEditModal}
      data-qa="prompt"
    >
      <button
        className="flex h-full w-full items-center gap-2"
        draggable="true"
        onDragStart={(e) => handleDragStart(e, prompt)}
      >
        <IconBulb size={18} className="text-gray-500" />

        <div className={classNames(isDeleting ? 'mr-12': 'pr-4',
          "relative max-h-5 flex-1 truncate break-all text-left")}>
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
            'absolute right-3 z-50 flex justify-end xl:invisible xl:group-hover:visible',
            selectedPromptId === prompt.id ? 'visible' : 'invisible',
          )}
          ref={wrapperRef}
          onClick={stopBubbling}
        >
          <ContextMenu
            featureType="prompt"
            folders={folders}
            onMoveToFolder={handleMoveToFolder}
            onDelete={handleOpenDeleteModal}
            onRename={handleOpenEditModal}
            onExport={handleExportPrompt}
            onOpenMoveToModal={() => {
              setIsShowMoveToModal(true);
            }}
            highlightColor="violet"
          />
        </div>
      )}
      <div className="md:hidden" onClick={stopBubbling}>
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

      {selectedPromptId === prompt.id && showModal && (
        <PromptModal
          prompt={prompt}
          isOpen={selectedPromptId === prompt.id && showModal}
          onClose={handleClose}
          onUpdatePrompt={handleUpdate}
        />
      )}
    </div>
  );
};
