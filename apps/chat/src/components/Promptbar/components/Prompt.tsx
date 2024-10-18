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
import {
  getIdWithoutRootPathSegments,
  getPromptRootId,
  isEntityExternal,
  isRootId,
} from '@/src/utils/app/id';
import { hasParentWithFloatingOverlay } from '@/src/utils/app/modals';
import { MoveType, getDragImage } from '@/src/utils/app/move';
import { defaultMyItemsFilters } from '@/src/utils/app/search';
import { translate } from '@/src/utils/app/translation';

import { AdditionalItemData, FeatureType } from '@/src/types/common';
import { MoveToFolderProps } from '@/src/types/folder';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ImportExportActions } from '@/src/store/import-export/importExport.reducers';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';
import {
  PublicationActions,
  PublicationSelectors,
} from '@/src/store/publication/publication.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { ShareActions } from '@/src/store/share/share.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { stopBubbling } from '@/src/constants/chat';
import { DEFAULT_FOLDER_NAME } from '@/src/constants/default-ui-settings';

import ItemContextMenu from '@/src/components/Common/ItemContextMenu';
import { MoveToFolderMobileModal } from '@/src/components/Common/MoveToFolderMobileModal';

import { PublishModal } from '../../Chat/Publish/PublishWizard';
import { ReviewDot } from '../../Chat/Publish/ReviewDot';
import { ConfirmDialog } from '../../Common/ConfirmDialog';
import ShareIcon from '../../Common/ShareIcon';
import Tooltip from '../../Common/Tooltip';
import { PreviewPromptModal } from './PreviewPromptModal';

import { PublishActions } from '@epam/ai-dial-shared';

interface Props {
  item: PromptInfo;
  level?: number;
  additionalItemData?: AdditionalItemData;
}

export const PromptComponent = ({
  item: prompt,
  level,
  additionalItemData,
}: Props) => {
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
  const { selectedPromptId, isSelectedPromptApproveRequiredResource } =
    useAppSelector(PromptsSelectors.selectSelectedPromptId);
  const selectedPublicationUrl = useAppSelector(
    PublicationSelectors.selectSelectedPublicationUrl,
  );
  const allPrompts = useAppSelector(PromptsSelectors.selectPrompts);
  const { showModal, isModalPreviewMode } = useAppSelector(
    PromptsSelectors.selectIsEditModalOpen,
  );
  const resourceToReview = useAppSelector((state) =>
    PublicationSelectors.selectResourceToReviewByReviewAndPublicationUrls(
      state,
      prompt.id,
      additionalItemData?.publicationUrl,
    ),
  );
  const chosenPromptIds = useAppSelector(PromptsSelectors.selectSelectedItems);
  const isSelectMode = useAppSelector(PromptsSelectors.selectIsSelectMode);
  const isPublishingEnabled = useAppSelector((state) =>
    SettingsSelectors.selectIsPublishingEnabled(state, FeatureType.Prompt),
  );

  const isExternal = isEntityExternal(prompt);
  const isApproveRequiredResource = !!additionalItemData?.publicationUrl;
  const isPartOfSelectedPublication =
    !additionalItemData?.publicationUrl ||
    selectedPublicationUrl === additionalItemData?.publicationUrl;
  const isSelected =
    selectedPromptId === prompt.id &&
    isApproveRequiredResource === isSelectedPromptApproveRequiredResource &&
    isPartOfSelectedPublication;

  const isNameInvalid = isEntityNameInvalid(prompt.name);
  const isInvalidPath = hasInvalidNameInPath(prompt.folderId);
  const isNameOrPathInvalid = isNameInvalid || isInvalidPath;

  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isShowMoveToModal, setIsShowMoveToModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [isContextMenu, setIsContextMenu] = useState(false);
  const [isUnshareConfirmOpened, setIsUnshareConfirmOpened] = useState(false);

  const isChosen = useMemo(
    () => chosenPromptIds.includes(prompt.id),
    [chosenPromptIds, prompt.id],
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
    setIsUnpublishing(false);
  }, []);

  const handleOpenUnpublishing: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      setIsUnpublishing(true);
    }, []);

  const handleDelete = useCallback(() => {
    if (isDeleting) {
      if (prompt.sharedWithMe) {
        dispatch(
          ShareActions.discardSharedWithMe({
            resourceIds: [prompt.id],
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
      if (additionalItemData?.publicationUrl) {
        dispatch(
          PublicationActions.selectPublication(
            additionalItemData?.publicationUrl,
          ),
        );
      }
      dispatch(PromptsActions.uploadPrompt({ promptId: prompt.id }));
      dispatch(PromptsActions.setIsEditModalOpen({ isOpen: true, isPreview }));
    },
    [
      additionalItemData?.publicationUrl,
      dispatch,
      isApproveRequiredResource,
      prompt.id,
    ],
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
            t('Prompt with name "{{name}}" already exists in this folder.', {
              ns: 'prompt',
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

  const handleSelect: MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      e.stopPropagation();
      setIsContextMenu(false);
      dispatch(PromptsActions.setChosenPrompts({ ids: [prompt.id] }));
    },
    [dispatch, prompt.id],
  );

  useEffect(() => {
    if (isSelectMode) {
      setIsRenaming(false);
      setIsDeleting(false);
    }
  }, [isSelectMode]);

  const handleToggle = useCallback(() => {
    PromptsActions.setChosenPrompts({ ids: [prompt.id] });
  }, [prompt.id]);

  const iconSize = additionalItemData?.isSidePanelItem ? 24 : 18;
  const strokeWidth = additionalItemData?.isSidePanelItem ? 1.5 : 2;

  return (
    <>
      <button
        className={classNames(
          'group relative flex size-full shrink-0 cursor-pointer items-center rounded border-l-2 pr-3 hover:bg-accent-primary-alpha disabled:cursor-not-allowed',
          !isSelectMode && '[&:not(:disabled)]:hover:pr-9',
          !isSelectMode && isHighlited
            ? 'border-l-accent-primary '
            : 'border-l-transparent',
          isHighlited && 'bg-accent-primary-alpha',
          additionalItemData?.isSidePanelItem ? 'h-[34px]' : 'h-[30px]',
        )}
        onClick={() => {
          if (isSelectMode && !isExternal) {
            setIsDeleting(false);
            setIsRenaming(false);
            dispatch(PromptsActions.setChosenPrompts({ ids: [prompt.id] }));
          }
        }}
        style={{
          paddingLeft: (level && `${level * 30 + 16}px`) || '0.875rem',
        }}
        onContextMenu={handleContextMenuOpen}
        data-qa="prompt"
        disabled={isSelectMode && isExternal}
      >
        <div
          className={classNames('flex size-full items-center gap-2', {
            'pr-6 xl:pr-0':
              !isSelectMode && !isDeleting && !isRenaming && isSelected,
          })}
          draggable={!isExternal && !isNameOrPathInvalid && !isSelectMode}
          onDragStart={(e) => handleDragStart(e, prompt)}
        >
          <div
            className={classNames(
              'relative',
              additionalItemData?.isSidePanelItem
                ? 'size-[24px] items-center justify-center'
                : 'size-[18px]',
              isSelectMode && !isExternal && 'shrink-0 group-hover:flex',
              isSelectMode && isChosen && !isExternal ? 'flex' : 'hidden',
            )}
          >
            <input
              className={classNames(
                'checkbox peer size-[18px] bg-layer-3',
                additionalItemData?.isSidePanelItem && 'mr-0',
              )}
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
              isSelectMode && !isExternal && 'group-hover:hidden',
              isChosen && !isExternal && 'hidden',
            )}
          >
            {resourceToReview && !resourceToReview.reviewed && (
              <ReviewDot
                className={classNames(
                  'group-hover:bg-accent-tertiary-alpha',
                  (selectedPromptId === prompt.id || isContextMenu) &&
                    resourceToReview.publicationUrl ===
                      selectedPublicationUrl &&
                    isPartOfSelectedPublication &&
                    'bg-accent-tertiary-alpha',
                )}
              />
            )}
            <IconBulb
              size={iconSize}
              strokeWidth={strokeWidth}
              className="text-secondary"
            />
          </ShareIcon>

          <div
            className="relative max-h-5 flex-1 truncate whitespace-pre break-all text-left"
            data-qa="entity-name"
          >
            <Tooltip
              tooltip={t(
                getEntityNameError(isNameInvalid, isInvalidPath, isExternal),
              )}
              hideTooltip={!isNameOrPathInvalid}
              triggerClassName={classNames(
                'block max-h-5 flex-1 truncate whitespace-pre break-all text-left',
                (prompt.publicationInfo?.isNotExist || isNameOrPathInvalid) &&
                  'text-secondary',
                !!additionalItemData?.publicationUrl &&
                  prompt.publicationInfo?.action === PublishActions.DELETE &&
                  'text-error',
              )}
            >
              {prompt.name}
            </Tooltip>
          </div>
        </div>
        {!isSelectMode && !isDeleting && !isRenaming && (
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
              onUnpublish={
                additionalItemData?.publicationUrl
                  ? undefined
                  : handleOpenUnpublishing
              }
              onOpenChange={setIsContextMenu}
              onDuplicate={handleDuplicate}
              onView={(e) => handleOpenEditModal(e, true)}
              isOpen={isContextMenu}
              onSelect={handleSelect}
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

      {(isPublishing || isUnpublishing) && isPublishingEnabled && (
        <PublishModal
          entity={prompt}
          type={SharingType.Prompt}
          isOpen={isPublishing || isUnpublishing}
          onClose={handleClosePublishModal}
          publishAction={
            isPublishing ? PublishActions.ADD : PublishActions.DELETE
          }
          defaultPath={
            isUnpublishing && !isRootId(prompt.folderId)
              ? getIdWithoutRootPathSegments(prompt.folderId)
              : undefined
          }
        />
      )}
      <ConfirmDialog
        isOpen={isDeleting}
        heading={t('Confirm deleting prompt')}
        description={`${t('Are you sure that you want to delete a prompt?')}${t(
          prompt.isShared
            ? '\nDeleting will stop sharing and other users will no longer see this prompt.'
            : '',
        )}`}
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
          heading={t('Confirm unsharing: {{promptName}}', {
            promptName: prompt.name,
          })}
          description={
            t('Are you sure that you want to unshare this prompt?') || ''
          }
          confirmLabel={t('Unshare')}
          cancelLabel={t('Cancel')}
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
