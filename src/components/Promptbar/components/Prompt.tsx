import { useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { IconBulb, IconCheck, IconX } from '@tabler/icons-react';
import {
  DragEvent,
  MouseEvent,
  MouseEventHandler,
  useCallback,
  useState,
} from 'react';

import classNames from 'classnames';

import { hasParentWithFloatingOverlay } from '@/src/utils/app/modals';
import { MoveType, getDragImage } from '@/src/utils/app/move';
import { defaultMyItemsFilters } from '@/src/utils/app/search';
import { isEntityOrParentsExternal } from '@/src/utils/app/share';

import { FeatureType } from '@/src/types/common';
import { Prompt } from '@/src/types/prompt';
import { SharingType } from '@/src/types/share';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';

import { stopBubbling } from '@/src/constants/chat';

import SidebarActionButton from '@/src/components/Buttons/SidebarActionButton';
import ItemContextMenu from '@/src/components/Common/ItemContextMenu';
import { MoveToFolderMobileModal } from '@/src/components/Common/MoveToFolderMobileModal';

import PublishModal from '../../Chat/Publish/PublishWizard';
import ShareModal from '../../Chat/ShareModal';
import UnpublishModal from '../../Chat/UnpublishModal';
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
  const dispatch = useAppDispatch();

  const folders = useAppSelector((state) =>
    PromptsSelectors.selectFilteredFolders(
      state,
      defaultMyItemsFilters,
      '',
      true,
    ),
  );
  const selectedPromptId = useAppSelector(
    PromptsSelectors.selectSelectedPromptId,
  );
  const isSelected = selectedPromptId === prompt.id;
  const showModal = useAppSelector(PromptsSelectors.selectIsEditModalOpen);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  const [isShowMoveToModal, setIsShowMoveToModal] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [isContextMenu, setIsContextMenu] = useState(false);
  const isExternal = useAppSelector((state) =>
    isEntityOrParentsExternal(state, prompt, FeatureType.Prompt),
  );

  const { refs, context } = useFloating({
    open: isContextMenu,
    onOpenChange: setIsContextMenu,
  });

  const dismiss = useDismiss(context);
  const { getFloatingProps } = useInteractions([dismiss]);

  const handleCloseShareModal = useCallback(() => {
    setIsSharing(false);
  }, []);

  const handleOpenSharing: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      setIsSharing(true);
    }, []);

  const handleOpenPublishing: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      setIsPublishing(true);
    }, []);

  const handleClosePublishModal = useCallback(() => {
    setIsPublishing(false);
  }, []);

  const handleOpenUnpublishing: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      setIsUnpublishing(true);
    }, []);

  const handleCloseUnpublishModal = useCallback(() => {
    setIsUnpublishing(false);
  }, []);

  const handleUpdate = useCallback(
    (prompt: Prompt) => {
      dispatch(
        PromptsActions.updatePrompt({ promptId: prompt.id, values: prompt }),
      );
      dispatch(PromptsActions.resetSearch());
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
        dispatch(PromptsActions.resetSearch());
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
      if (e.dataTransfer && !isExternal) {
        e.dataTransfer.setDragImage(getDragImage(), 0, 0);
        e.dataTransfer.setData(MoveType.Prompt, JSON.stringify(prompt));
      }
    },
    [isExternal],
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

  const handleExportPrompt = useCallback(
    (e?: unknown) => {
      const typedEvent = e as MouseEvent;
      typedEvent.preventDefault();
      typedEvent.stopPropagation();

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
    [dispatch, prompt.id],
  );

  const handleClose = useCallback(() => {
    dispatch(PromptsActions.setIsEditModalOpen({ isOpen: false }));
    dispatch(PromptsActions.setSelectedPrompt({ promptId: undefined }));
    setIsRenaming(false);
  }, [dispatch]);

  const handleContextMenuOpen = (e: MouseEvent) => {
    if (hasParentWithFloatingOverlay(e.target as Element)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setIsContextMenu(true);
  };
  const isHighlited =
    isDeleting || isRenaming || (showModal && isSelected) || isContextMenu;

  const handleDuplicate: MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      e.stopPropagation();
      setIsContextMenu(false);
      dispatch(
        PromptsActions.duplicatePrompt({
          prompt,
        }),
      );
    },
    [dispatch, prompt],
  );

  return (
    <>
      <div
        className={classNames(
          'group relative flex h-[30px] shrink-0 cursor-pointer items-center rounded border-l-2 pr-3 transition-colors duration-200 hover:bg-accent-primary-alpha',
          isHighlited
            ? 'border-l-accent-primary bg-accent-primary-alpha'
            : 'border-l-transparent',
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
          draggable={!isExternal}
          onDragStart={(e) => handleDragStart(e, prompt)}
        >
          <ShareIcon
            {...prompt}
            isHighlighted={isHighlited}
            featureType={FeatureType.Prompt}
          >
            <IconBulb size={18} className="text-secondary" />
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
              <IconCheck size={18} className="hover:text-accent-primary" />
            </SidebarActionButton>

            <SidebarActionButton handleClick={handleCancelDelete}>
              <IconX
                size={18}
                strokeWidth="2"
                className="hover:text-accent-primary"
              />
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
              entity={prompt}
              featureType={FeatureType.Prompt}
              folders={folders}
              onMoveToFolder={handleMoveToFolder}
              onDelete={handleOpenDeleteModal}
              onRename={handleOpenEditModal}
              onExport={handleExportPrompt}
              onOpenMoveToModal={() => {
                setIsShowMoveToModal(true);
              }}
              onShare={handleOpenSharing}
              onPublish={handleOpenPublishing}
              onPublishUpdate={handleOpenPublishing}
              onUnpublish={handleOpenUnpublishing}
              onOpenChange={setIsContextMenu}
              onDuplicate={handleDuplicate}
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
        />
      )}

      {isPublishing && (
        <PublishModal
          entity={prompt}
          type={SharingType.Prompt}
          isOpen
          onClose={handleClosePublishModal}
        />
      )}
      {isUnpublishing && (
        <UnpublishModal
          entity={prompt}
          type={SharingType.Prompt}
          isOpen
          onClose={handleCloseUnpublishModal}
        />
      )}
    </>
  );
};
