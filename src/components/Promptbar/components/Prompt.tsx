import { IconBulb, IconCheck, IconUserShare, IconX } from '@tabler/icons-react';
import {
  DragEvent,
  MouseEventHandler,
  useCallback,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { FeatureType, HighlightColor } from '@/src/types/common';
import { Feature } from '@/src/types/features';
import { Prompt } from '@/src/types/prompt';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { stopBubbling } from '@/src/constants/chat';

import SidebarActionButton from '@/src/components/Buttons/SidebarActionButton';
import { ContextMenu } from '@/src/components/Common/ContextMenu';
import { MoveToFolderMobileModal } from '@/src/components/Common/MoveToFolderMobileModal';

import ShareModal, { SharingType } from '../../Chat/ShareModal';
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
  const isSelected = selectedPromptId === prompt.id;
  const showModal = useAppSelector(PromptsSelectors.selectIsEditModalOpen);

  const isSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.PromptsSharing),
  );

  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  const [isShowMoveToModal, setIsShowMoveToModal] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const { id: promptId, isShared } = prompt;
  const showSharedIcon = isSharingEnabled && isShared && !isDeleting;

  const wrapperRef = useRef(null);

  const handleCloseShareModal = useCallback(() => {
    setIsSharing(false);
  }, []);

  const handleShared = useCallback(
    (_newShareId: string) => {
      //TODO: send newShareId to API to store {id, createdDate}
      dispatch(
        PromptsActions.updatePrompt({
          promptId,
          values: {
            isShared: true,
          },
        }),
      );
    },
    [dispatch, promptId],
  );

  const handleOpenSharing: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      setIsSharing(true);
    }, []);

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

    setIsRenaming(false);
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
      setIsDeleting(false);
      setIsRenaming(true);
      dispatch(PromptsActions.setSelectedPrompt({ promptId: prompt.id }));
      dispatch(PromptsActions.setIsEditModalOpen({ isOpen: true }));
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
    dispatch(PromptsActions.setSelectedPrompt({ promptId: undefined }));
    setIsRenaming(false);
  }, [dispatch]);

  return (
    <>
      <div
        className={classNames(
          'group relative flex h-[30px] shrink-0 cursor-pointer items-center rounded border-l-2 pr-3 transition-colors duration-200 hover:bg-violet/15',
          isDeleting || isRenaming || (showModal && isSelected)
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
          className={classNames(
            'flex h-full w-full items-center gap-2',
            isDeleting ? 'pr-12' : 'group-hover:pr-6',
            {
              'pr-6 xl:pr-0': !isDeleting && !isRenaming && isSelected,
            },
          )}
          draggable="true"
          onDragStart={(e) => handleDragStart(e, prompt)}
        >
          <IconBulb size={18} className="text-gray-500" />

          <div
            className={classNames(
              'relative max-h-5 flex-1 truncate break-all text-left',
            )}
          >
            {prompt.name}
          </div>
          {showSharedIcon && (
            <span className="flex shrink-0 text-gray-500">
              <IconUserShare size={14} />
            </span>
          )}
        </button>

        {isDeleting && (
          <div className="absolute right-1 z-10 flex">
            <SidebarActionButton handleClick={handleDelete}>
              <IconCheck size={18} className="hover:text-violet" />
            </SidebarActionButton>

            <SidebarActionButton handleClick={handleCancelDelete}>
              <IconX size={18} strokeWidth="2" className="hover:text-violet" />
            </SidebarActionButton>
          </div>
        )}
        {!isDeleting && !isRenaming && (
          <div
            className={classNames(
              'absolute right-3 z-50 flex justify-end xl:invisible xl:group-hover:visible',
              isSelected ? 'visible' : 'invisible',
            )}
            ref={wrapperRef}
            onClick={stopBubbling}
          >
            <ContextMenu
              featureType={FeatureType.Prompt}
              folders={folders}
              onMoveToFolder={handleMoveToFolder}
              onDelete={handleOpenDeleteModal}
              onRename={handleOpenEditModal}
              onExport={handleExportPrompt}
              onOpenMoveToModal={() => {
                setIsShowMoveToModal(true);
              }}
              highlightColor={HighlightColor.Violet}
              onOpenShareModal={
                isSharingEnabled ? handleOpenSharing : undefined
              }
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

        {isSelected && showModal && (
          <PromptModal
            prompt={prompt}
            isOpen
            onClose={handleClose}
            onUpdatePrompt={handleUpdate}
          />
        )}
      </div>
      {isSharing && (
        <ShareModal
          entity={prompt}
          type={SharingType.Prompt}
          isOpen
          onClose={handleCloseShareModal}
          onShare={handleShared}
        />
      )}
    </>
  );
};
