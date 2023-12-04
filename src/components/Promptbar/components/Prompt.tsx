import { useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { IconBulb, IconCheck, IconX } from '@tabler/icons-react';
import {
  DragEvent,
  MouseEvent,
  MouseEventHandler,
  useCallback,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { FeatureType, HighlightColor } from '@/src/types/common';
import { Feature } from '@/src/types/features';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { stopBubbling } from '@/src/constants/chat';

import SidebarActionButton from '@/src/components/Buttons/SidebarActionButton';
import ItemContextMenu from '@/src/components/Common/ItemContextMenu';
import { MoveToFolderMobileModal } from '@/src/components/Common/MoveToFolderMobileModal';

import ShareModal, { SharingType } from '../../Chat/ShareModal';
import ShareIcon from '../../Common/ShareIcon';
import { PromptModal } from './PromptModal';

import { v4 as uuidv4 } from 'uuid';

interface Props {
  item: Prompt;
  level?: number;
}

export interface PromptMoveToFolderProps {
  folderId?: string;
  isNewFolder?: boolean;
}

export const PromptComponent = ({ item: prompt, level }: Props) => {
  const { t } = useTranslation(Translation.Chat);
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
  const [isContextMenu, setIsContextMenu] = useState(false);
  const { id: promptId } = prompt;

  const { refs, context } = useFloating({
    open: isContextMenu,
    onOpenChange: setIsContextMenu,
  });

  const dismiss = useDismiss(context);
  const { getFloatingProps } = useInteractions([dismiss]);

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
            //TODO: for development purpose - emulate immediate sharing with yourself
            sharedWithMe: true,
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
    (e: DragEvent<HTMLDivElement>, prompt: Prompt) => {
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
    ({ folderId, isNewFolder }: PromptMoveToFolderProps) => {
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
      setIsContextMenu(false);
    },
    [dispatch, prompt.id, t],
  );

  const handleClose = useCallback(() => {
    dispatch(PromptsActions.setIsEditModalOpen({ isOpen: false }));
    dispatch(PromptsActions.setSelectedPrompt({ promptId: undefined }));
    setIsRenaming(false);
  }, [dispatch]);

  const handleContextMenuOpen = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsContextMenu(true);
  };
  const isHighlited =
    isDeleting || isRenaming || (showModal && isSelected) || isContextMenu;
  return (
    <>
      <div
        className={classNames(
          'group relative flex h-[30px] shrink-0 cursor-pointer items-center rounded border-l-2 pr-3 transition-colors duration-200 hover:bg-violet/15',
          isHighlited ? 'border-l-violet bg-violet/15' : 'border-l-transparent',
        )}
        style={{
          paddingLeft: (level && `${0.875 + level * 1.5}rem`) || '0.875rem',
        }}
        onContextMenu={handleContextMenuOpen}
        data-qa="prompt"
      >
        <div
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
          <ShareIcon
            {...prompt}
            isHighlited={isHighlited}
            highlightColor={HighlightColor.Violet}
          >
            <IconBulb size={18} className="text-gray-500" />
          </ShareIcon>

          <div
            className={classNames(
              'relative max-h-5 flex-1 truncate break-all text-left',
            )}
          >
            {prompt.name}
          </div>
        </div>

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
            ref={refs.setFloating}
            {...getFloatingProps()}
            className={classNames(
              'absolute right-3 z-50 flex justify-end group-hover:visible',
              isSelected ? 'visible' : 'invisible',
            )}
            onClick={stopBubbling}
          >
            <ItemContextMenu
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
              onOpenChange={setIsContextMenu}
              isOpen={isContextMenu}
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
