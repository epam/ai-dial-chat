import { useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { IconBulb } from '@tabler/icons-react';
import {
  DragEvent,
  MouseEvent,
  MouseEventHandler,
  useCallback,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { isEntityNameOnSameLevelUnique } from '@/src/utils/app/common';
import { constructPath } from '@/src/utils/app/file';
import { getNextDefaultName } from '@/src/utils/app/folders';
import { getRootId, isRootId } from '@/src/utils/app/id';
import { hasParentWithFloatingOverlay } from '@/src/utils/app/modals';
import { MoveType, getDragImage } from '@/src/utils/app/move';
import { defaultMyItemsFilters } from '@/src/utils/app/search';
import { isEntityOrParentsExternal } from '@/src/utils/app/share';
import { translate } from '@/src/utils/app/translation';
import { ApiKeys } from '@/src/utils/server/api';

import {
  BackendDataNodeType,
  BackendResourceType,
  FeatureType,
} from '@/src/types/common';
import { MoveToFolderProps } from '@/src/types/folder';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';
import { ShareActions } from '@/src/store/share/share.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { stopBubbling } from '@/src/constants/chat';
import { DEFAULT_FOLDER_NAME } from '@/src/constants/default-settings';

import ItemContextMenu from '@/src/components/Common/ItemContextMenu';
import { MoveToFolderMobileModal } from '@/src/components/Common/MoveToFolderMobileModal';
import { PreviewPromptModal } from '@/src/components/Promptbar/components/PreviewPromptModal';

import PublishModal from '../../Chat/Publish/PublishWizard';
import UnpublishModal from '../../Chat/UnpublishModal';
import { ConfirmDialog } from '../../Common/ConfirmDialog';
import ShareIcon from '../../Common/ShareIcon';
import { PromptModal } from './PromptModal';

interface Props {
  item: PromptInfo;
  level?: number;
}

export const PromptComponent = ({ item: prompt, level }: Props) => {
  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Chat);

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
  const { showModal, isModalPreviewMode } = useAppSelector(
    PromptsSelectors.selectIsEditModalOpen,
  );
  const isExternal = useAppSelector((state) =>
    isEntityOrParentsExternal(state, prompt, FeatureType.Prompt),
  );
  const allPrompts = useAppSelector(PromptsSelectors.selectPrompts);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isShowMoveToModal, setIsShowMoveToModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [isContextMenu, setIsContextMenu] = useState(false);
  const [isUnshareConfirmOpened, setIsUnshareConfirmOpened] = useState(false);

  const { refs, context } = useFloating({
    open: isContextMenu,
    onOpenChange: setIsContextMenu,
  });

  const dismiss = useDismiss(context);
  const { getFloatingProps } = useInteractions([dismiss]);

  const handleOpenSharing: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      dispatch(
        ShareActions.share({
          resourceType: BackendResourceType.PROMPT,
          resourceId: prompt.id,
          nodeType: BackendDataNodeType.ITEM,
        }),
      );
    }, [dispatch, prompt.id]);
  const handleOpenUnsharing: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      setIsUnshareConfirmOpened(true);
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
        PromptsActions.updatePrompt({
          id: prompt.id,
          values: {
            name: prompt.name,
            description: prompt.description,
            content: prompt.content,
            isShared: prompt.isShared,
          },
        }),
      );
      dispatch(PromptsActions.resetSearch());
      setIsRenaming(false);
    },
    [dispatch],
  );

  const handleDelete = useCallback(() => {
    if (isDeleting) {
      if (prompt.sharedWithMe) {
        dispatch(
          ShareActions.discardSharedWithMe({
            resourceId: prompt.id,
            nodeType: BackendDataNodeType.ITEM,
            resourceType: BackendResourceType.PROMPT,
          }),
        );
      } else {
        dispatch(PromptsActions.deletePrompt({ prompt }));
      }
      dispatch(PromptsActions.resetSearch());
    }

    setIsDeleting(false);
    dispatch(PromptsActions.setSelectedPrompt({ promptId: undefined }));
  }, [dispatch, isDeleting, prompt]);

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

  const handleOpenEditModal = useCallback(
    (e: MouseEvent<unknown, globalThis.MouseEvent>, isPreview = false) => {
      e.stopPropagation();
      e.preventDefault();
      setIsDeleting(false);
      setIsRenaming(true);
      dispatch(PromptsActions.setSelectedPrompt({ promptId: prompt.id }));
      dispatch(PromptsActions.uploadPrompt({ promptId: prompt.id }));
      dispatch(PromptsActions.setIsEditModalOpen({ isOpen: true, isPreview }));
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
          id: prompt.id,
        }),
      );
    },
    [dispatch, prompt.id],
  );

  const handleMoveToFolder = useCallback(
    ({ folderId, isNewFolder }: MoveToFolderProps) => {
      const folderPath = (
        isNewFolder
          ? getNextDefaultName(
              translate(DEFAULT_FOLDER_NAME),
              folders.filter((f) => isRootId(f.folderId)),
            )
          : folderId
      ) as string;

      if (
        !isEntityNameOnSameLevelUnique(
          prompt.name,
          { ...prompt, folderId: folderPath },
          allPrompts,
        )
      ) {
        dispatch(
          UIActions.showToast({
            message: t(
              'Prompt with name "{{name}}" already exists in this folder.',
              {
                ns: 'prompt',
                name: prompt.name,
              },
            ),
            type: 'error',
          }),
        );

        return;
      }

      if (isNewFolder) {
        dispatch(
          PromptsActions.createFolder({
            name: folderPath,
            parentId: getRootId({ apiKey: ApiKeys.Prompts }),
          }),
        );
      }
      dispatch(
        PromptsActions.updatePrompt({
          id: prompt.id,
          values: {
            folderId: isNewFolder
              ? constructPath(
                  getRootId({ apiKey: ApiKeys.Prompts }),
                  folderPath,
                )
              : folderPath,
          },
        }),
      );
      setIsContextMenu(false);
    },
    [allPrompts, dispatch, folders, prompt, t],
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
      dispatch(PromptsActions.duplicatePrompt(prompt));
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
            'flex size-full items-center gap-2',
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
              onUnshare={handleOpenUnsharing}
              onPublish={handleOpenPublishing}
              onPublishUpdate={handleOpenPublishing}
              onUnpublish={handleOpenUnpublishing}
              onOpenChange={setIsContextMenu}
              onDuplicate={handleDuplicate}
              onView={(e) => handleOpenEditModal(e, true)}
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

        {showModal &&
          isSelected &&
          (isModalPreviewMode ? (
            <PreviewPromptModal
              isOpen
              onDuplicate={(e) => {
                handleDuplicate(e);
                handleClose();
              }}
              onClose={handleClose}
              onUnshare={handleOpenUnsharing}
            />
          ) : (
            <PromptModal
              isOpen
              onClose={handleClose}
              onUpdatePrompt={handleUpdate}
            />
          ))}
      </div>

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
      <ConfirmDialog
        isOpen={isDeleting}
        heading={t('Confirm deleting prompt')}
        description={`${t('Are you sure that you want to remove a prompt?')}${
          prompt.isShared
            ? t(
                ' Removing will stop sharing and other users will no longer see this prompt.',
              )
            : ''
        }`}
        confirmLabel={t('Delete')}
        cancelLabel={t('Cancel')}
        onClose={(result) => {
          setIsDeleting(false);
          if (result) handleDelete();
        }}
      />
      {isUnshareConfirmOpened && (
        <ConfirmDialog
          isOpen={isUnshareConfirmOpened}
          heading={t('Confirm revoking access to {{promptName}}', {
            promptName: prompt.name,
          })}
          description={
            t('Are you sure that you want to revoke access to this prompt?') ||
            ''
          }
          confirmLabel={t('Revoke access')}
          cancelLabel={t('Cancel')}
          onClose={(result) => {
            setIsUnshareConfirmOpened(false);
            if (result) {
              dispatch(
                ShareActions.revokeAccess({
                  resourceId: prompt.id,
                  nodeType: BackendDataNodeType.ITEM,
                  resourceType: BackendResourceType.PROMPT,
                }),
              );
            }
          }}
        />
      )}
    </>
  );
};
