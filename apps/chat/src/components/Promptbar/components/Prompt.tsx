import { useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { IconBulb, IconCheck } from '@tabler/icons-react';
import {
  DragEvent,
  MouseEvent,
  MouseEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import {
  hasInvalidNameInPath,
  isEntityNameInvalid,
  isEntityNameOnSameLevelUnique,
} from '@/src/utils/app/common';
import { getEntityNameError } from '@/src/utils/app/errors';
import { constructPath } from '@/src/utils/app/file';
import { getNextDefaultName } from '@/src/utils/app/folders';
import { getPromptRootId } from '@/src/utils/app/id';
import { hasParentWithFloatingOverlay } from '@/src/utils/app/modals';
import { MoveType, getDragImage } from '@/src/utils/app/move';
import { defaultMyItemsFilters } from '@/src/utils/app/search';
import { isEntityOrParentsExternal } from '@/src/utils/app/share';
import { translate } from '@/src/utils/app/translation';

import { FeatureType } from '@/src/types/common';
import { MoveToFolderProps } from '@/src/types/folder';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ImportExportActions } from '@/src/store/import-export/importExport.reducers';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';
import { PublicationSelectors } from '@/src/store/publication/publication.reducers';
import { ShareActions } from '@/src/store/share/share.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { stopBubbling } from '@/src/constants/chat';
import { DEFAULT_FOLDER_NAME } from '@/src/constants/default-ui-settings';

import ItemContextMenu from '@/src/components/Common/ItemContextMenu';
import { MoveToFolderMobileModal } from '@/src/components/Common/MoveToFolderMobileModal';

import { PublishModal } from '../../Chat/Publish/PublishWizard';
import { UnpublishModal } from '../../Chat/Publish/UnpublishModal';
import { ConfirmDialog } from '../../Common/ConfirmDialog';
import ShareIcon from '../../Common/ShareIcon';
import Tooltip from '../../Common/Tooltip';
import { PreviewPromptModal } from './PreviewPromptModal';

interface Props {
  item: PromptInfo;
  level?: number;
  additionalItemData?: Record<string, unknown>;
}

export const PromptComponent = ({
  item: prompt,
  level,
  additionalItemData,
}: Props) => {
  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.PromptBar);

  const folders = useAppSelector((state) =>
    PromptsSelectors.selectFilteredFolders(
      state,
      defaultMyItemsFilters,
      '',
      true,
    ),
  );
  const { selectedPromptId, isSelectedPromptApproveRequiredResource } =
    useAppSelector(PromptsSelectors.selectSelectedPromptId);
  const selectedConversationsIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );
  const isApproveRequiredResource =
    !!additionalItemData?.isApproveRequiredResource;
  const isSelected =
    selectedPromptId === prompt.id &&
    isApproveRequiredResource === isSelectedPromptApproveRequiredResource;

  const isExternal = useAppSelector((state) =>
    isEntityOrParentsExternal(state, prompt, FeatureType.Prompt),
  );
  const isNameInvalid = isEntityNameInvalid(prompt.name);
  const isInvalidPath = hasInvalidNameInPath(prompt.folderId);
  const isNameOrPathInvalid = isNameInvalid || isInvalidPath;
  const allPrompts = useAppSelector(PromptsSelectors.selectPrompts);
  const { showModal, isModalPreviewMode } = useAppSelector(
    PromptsSelectors.selectIsEditModalOpen,
  );
  const resourceToReview = useAppSelector((state) =>
    PublicationSelectors.selectResourceToReviewByReviewUrl(state, prompt.id),
  );

  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isShowMoveToModal, setIsShowMoveToModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [isContextMenu, setIsContextMenu] = useState(false);
  const [isUnshareConfirmOpened, setIsUnshareConfirmOpened] = useState(false);
  const chosenPromptIds = useAppSelector(
    PromptsSelectors.selectChosenPromptIds,
  );
  const isSelectMode = useAppSelector(PromptsSelectors.selectIsSelectMode);
  const chosenFolderIds = useAppSelector(
    PromptsSelectors.selectChosenFolderIds,
  );
  const isChosen = useMemo(
    () =>
      chosenPromptIds.includes(prompt.id) ||
      chosenFolderIds.some((folderId) => prompt.id.startsWith(folderId)),
    [chosenPromptIds, chosenFolderIds, prompt.id],
  );

  const { refs, context } = useFloating({
    open: isContextMenu,
    onOpenChange: setIsContextMenu,
  });

  const dismiss = useDismiss(context);
  const { getFloatingProps } = useInteractions([dismiss]);

  useEffect(() => {
    if (!showModal) {
      setIsRenaming(false);
    }
  }, [showModal]);

  const handleOpenSharing: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      dispatch(
        ShareActions.share({
          featureType: FeatureType.Prompt,
          resourceId: prompt.id,
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

  const handleDelete = useCallback(() => {
    if (isDeleting) {
      if (prompt.sharedWithMe) {
        dispatch(
          ShareActions.discardSharedWithMe({
            resourceId: prompt.id,
            featureType: FeatureType.Prompt,
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
      if (e.dataTransfer && !isExternal && !isSelectMode) {
        e.dataTransfer.setDragImage(getDragImage(), 0, 0);
        e.dataTransfer.setData(MoveType.Prompt, JSON.stringify(prompt));
      }
    },
    [isExternal, isSelectMode],
  );

  const handleOpenEditModal = useCallback(
    (e: MouseEvent<unknown, globalThis.MouseEvent>, isPreview = false) => {
      e.stopPropagation();
      e.preventDefault();
      setIsRenaming(true);
      dispatch(
        PromptsActions.setSelectedPrompt({
          promptId: prompt.id,
          isApproveRequiredResource,
        }),
      );
      dispatch(PromptsActions.uploadPrompt({ promptId: prompt.id }));
      dispatch(PromptsActions.setIsEditModalOpen({ isOpen: true, isPreview }));
    },
    [dispatch, isApproveRequiredResource, prompt.id],
  );

  const handleExportPrompt = useCallback(
    (e?: unknown) => {
      const typedEvent = e as MouseEvent;
      typedEvent.preventDefault();
      typedEvent.stopPropagation();

      dispatch(
        ImportExportActions.exportPrompt({
          id: prompt.id,
        }),
      );
    },
    [dispatch, prompt.id],
  );

  const handleMoveToFolder = useCallback(
    ({ folderId, isNewFolder }: MoveToFolderProps) => {
      const promptRootId = getPromptRootId();
      const folderPath = (
        isNewFolder
          ? getNextDefaultName(
              translate(DEFAULT_FOLDER_NAME),
              folders.filter((f) => f.folderId === promptRootId), // only my root prompt folders
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
          UIActions.showErrorToast(
            t('promptbar.error.prompt_with_name_already_exists_in_folder', {
              name: prompt.name,
            }),
          ),
        );

        return;
      }

      if (isNewFolder) {
        dispatch(
          PromptsActions.createFolder({
            name: folderPath,
            parentId: getPromptRootId(),
          }),
        );
      }
      dispatch(
        PromptsActions.updatePrompt({
          id: prompt.id,
          values: {
            folderId: isNewFolder
              ? constructPath(getPromptRootId(), folderPath)
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
  }, [dispatch]);

  const handleContextMenuOpen = (e: MouseEvent) => {
    if (hasParentWithFloatingOverlay(e.target as Element)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setIsContextMenu(true);
  };
  const isHighlited = !isSelectMode
    ? isDeleting || isRenaming || (showModal && isSelected) || isContextMenu
    : isChosen;

  const handleDuplicate: MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      e.stopPropagation();
      setIsContextMenu(false);
      dispatch(PromptsActions.duplicatePrompt(prompt));
    },
    [dispatch, prompt],
  );

  // const handleSelect: MouseEventHandler<HTMLButtonElement> = useCallback(
  //   (e) => {
  //     e.stopPropagation();
  //     setIsContextMenu(false);
  //     dispatch(
  //       PromptsActions.setChosenPrompt({ promptId: prompt.id, isChosen }),
  //     );
  //   },
  //   [dispatch, isChosen, prompt.id],
  // );

  useEffect(() => {
    if (isSelectMode) {
      setIsRenaming(false);
      setIsDeleting(false);
    }
  }, [isSelectMode]);

  const handleToggle = useCallback(() => {
    PromptsActions.setChosenPrompt({ promptId: prompt.id, isChosen });
  }, [isChosen, prompt.id]);

  const onPromptClick = () => {
    if (selectedConversationsIds.length) {
      dispatch(PromptsActions.setSelectedPrompt({ promptId: prompt.id }));
      dispatch(PromptsActions.setIsPromptContentCopying(true));

      dispatch(
        PromptsActions.uploadPrompt({
          promptId: prompt.id,
        }),
      );
    }
  };

  return (
    <>
      <button
        className={classNames(
          'group/prompt-item relative flex size-full h-[30px] shrink-0 cursor-pointer items-center rounded border-l-2 pr-3 transition-colors duration-200 hover:bg-accent-primary-alpha',
          isHighlited
            ? 'border-l-accent-primary bg-accent-primary-alpha'
            : 'border-l-transparent',
          isSelected ? 'hover:pr-3' : 'hover:pr-9',
        )}
        onClick={() => {
          if (isSelectMode && !isExternal) {
            setIsDeleting(false);
            setIsRenaming(false);
            dispatch(
              PromptsActions.setChosenPrompt({ promptId: prompt.id, isChosen }),
            );
          }
        }}
        style={{
          paddingLeft: (level && `${0.875 + level * 1.5}rem`) || '0.875rem',
        }}
        onContextMenu={handleContextMenuOpen}
        data-qa="prompt"
        disabled={isSelectMode && isExternal}
      >
        <div
          className={classNames('flex size-full items-center gap-2', {
            'pr-6': !isSelectMode && !isDeleting && !isRenaming && isSelected,
          })}
          draggable={!isExternal && !isNameOrPathInvalid && !isSelectMode}
          onDragStart={(e) => handleDragStart(e, prompt)}
        >
          <div
            className={classNames(
              'relative size-[18px]',
              isSelectMode &&
                !isExternal &&
                'shrink-0 group-hover/prompt-item:flex',
              isSelectMode && isChosen && !isExternal ? 'flex' : 'hidden',
            )}
          >
            <input
              className="checkbox peer size-[18px] bg-layer-3"
              type="checkbox"
              checked={isChosen}
              onChange={handleToggle}
              data-qa={isChosen ? 'checked' : 'unchecked'}
            />
            <IconCheck
              size={18}
              className="pointer-events-none invisible absolute text-accent-primary peer-checked:visible"
            />
          </div>
          <ShareIcon
            {...prompt}
            isHighlighted={isHighlited}
            featureType={FeatureType.Prompt}
            containerClassName={classNames(
              isSelectMode && !isExternal && 'group-hover/prompt-item:hidden',
              isChosen && !isExternal && 'hidden',
            )}
          >
            <IconBulb size={18} />
          </ShareIcon>

          <div className="relative max-h-5 flex-1 truncate whitespace-pre break-all text-left">
            <Tooltip
              tooltip={t(
                getEntityNameError(isNameInvalid, isInvalidPath, isExternal),
              )}
              hideTooltip={!isNameOrPathInvalid}
              triggerClassName={classNames(
                'block max-h-5 flex-1 truncate whitespace-pre break-all text-left',
                isNameOrPathInvalid && 'text-secondary-bg-dark',
              )}
            >
              <span
                style={{ display: 'inline-block', width: 'calc(100% - 20px)' }}
                onClick={onPromptClick}
              >
                {prompt.name}
              </span>
            </Tooltip>
          </div>
        </div>
        {!isSelectMode && !isDeleting && !isRenaming && (
          <div
            ref={refs.setFloating}
            {...getFloatingProps()}
            className={classNames(
              'invisible absolute right-3 z-50 flex justify-end group-hover/prompt-item:visible',
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
              onUnpublish={
                additionalItemData?.isApproveRequiredResource
                  ? undefined
                  : handleOpenUnpublishing
              }
              onOpenChange={setIsContextMenu}
              onDuplicate={handleDuplicate}
              onView={undefined}
              isOpen={isContextMenu}
              onSelect={undefined}
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
        {showModal && isSelected && isModalPreviewMode && (
          <PreviewPromptModal
            prompt={prompt}
            isOpen
            isPublicationPreview={!!resourceToReview}
            onClose={handleClose}
            onDuplicate={
              !resourceToReview
                ? (e) => {
                    handleDuplicate(e);
                    handleClose();
                  }
                : undefined
            }
            onDelete={!resourceToReview ? () => setIsDeleting(true) : undefined}
          />
        )}
      </button>

      {isPublishing && (
        <PublishModal
          entity={prompt}
          entities={[prompt]}
          type={SharingType.Prompt}
          isOpen
          onClose={handleClosePublishModal}
        />
      )}
      {isUnpublishing && (
        <UnpublishModal
          subtitle={t('promptbar.prompt_not_be_visible.label')}
          type={SharingType.Prompt}
          entity={prompt}
          entities={[prompt]}
          isOpen
          onClose={handleCloseUnpublishModal}
        />
      )}
      <ConfirmDialog
        isOpen={isDeleting}
        heading={t('promptbar.dialog.confirm_deleting_prompt.header')}
        description={`${t('promptbar.dialog.confirm_deleting_prompt.description')}${t(
          prompt.isShared
            ? 'promptbar.dialog.confirm_deleting_prompt.extra_description'
            : '',
        )}`}
        confirmLabel={t(
          'promptbar.dialog.confirm_deleting_prompt.button.delete',
        )}
        cancelLabel={t(
          'promptbar.dialog.confirm_deleting_prompt.button.cancel',
        )}
        onClose={(result) => {
          setIsDeleting(false);
          if (result) handleDelete();
        }}
      />
      {isUnshareConfirmOpened && (
        <ConfirmDialog
          isOpen={isUnshareConfirmOpened}
          heading={t('promptbar.dialog.confirm_unsharing_prompt.header', {
            promptName: prompt.name,
          })}
          description={
            t('promptbar.dialog.confirm_unsharing_prompt.description') || ''
          }
          confirmLabel={t(
            'promptbar.dialog.confirm_unsharing_prompt.button.unshare',
          )}
          cancelLabel={t(
            'promptbar.dialog.confirm_unsharing_prompt.button.cancel',
          )}
          onClose={(result) => {
            setIsUnshareConfirmOpened(false);
            if (result) {
              dispatch(
                ShareActions.revokeAccess({
                  resourceId: prompt.id,
                  featureType: FeatureType.Prompt,
                }),
              );
            }
          }}
        />
      )}
    </>
  );
};
