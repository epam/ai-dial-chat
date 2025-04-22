import { useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { IconBulb, IconCheck } from '@tabler/icons-react';
import {
  DragEvent,
  MouseEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import classNames from 'classnames';

import { useContextMenuTrigger } from '@/src/hooks/useContextMenuTrigger';
import { usePromptActions } from '@/src/hooks/usePromptActions';
import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  hasInvalidNameInPath,
  isEntityNameInvalid,
} from '@/src/utils/app/common';
import { getEntityNameError } from '@/src/utils/app/errors';
import { isEntityIdExternal } from '@/src/utils/app/id';
import { hasParentWithFloatingOverlay } from '@/src/utils/app/modals';
import { MoveType, getDragImage } from '@/src/utils/app/move';
import { defaultMyItemsFilters } from '@/src/utils/app/search';

import {
  AdditionalItemData,
  FeatureType,
  ScreenState,
} from '@/src/types/common';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';
import {
  PublicationActions,
  PublicationSelectors,
} from '@/src/store/publication/publication.reducers';

import { stopBubbling } from '@/src/constants/chat';

import { ReviewDot } from '@/src/components/Chat/Publish/ReviewDot';
import ItemContextMenu from '@/src/components/Common/ItemContextMenu';
import ShareIcon from '@/src/components/Common/ShareIcon';
import Tooltip from '@/src/components/Common/Tooltip';

import { PromptDialogs } from './PromptDialogs';

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

  const filteredFoldersSelector = useMemo(
    () =>
      PromptsSelectors.selectFilteredFolders(defaultMyItemsFilters, '', true),
    [],
  );

  const folders = useAppSelector(filteredFoldersSelector);
  const { selectedPromptId, isSelectedPromptApproveRequiredResource } =
    useAppSelector(PromptsSelectors.selectSelectedPromptId);
  const selectedPublicationUrl = useAppSelector(
    PublicationSelectors.selectSelectedPublicationUrl,
  );
  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );
  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const showModal = useAppSelector(PromptsSelectors.selectIsPromptModalOpen);
  const resourceToReview = useAppSelector((state) =>
    PublicationSelectors.selectResourceToReviewByReviewAndPublicationUrls(
      state,
      prompt.id,
      additionalItemData?.publicationUrl,
    ),
  );
  const chosenPromptIds = useAppSelector(PromptsSelectors.selectSelectedItems);
  const isSelectMode = useAppSelector(PromptsSelectors.selectIsSelectMode);
  const isConversationBlocksInput = useAppSelector(
    ConversationsSelectors.selectIsSelectedConversationBlocksInput,
  );
  const selectedPublication = useAppSelector(
    PublicationSelectors.selectSelectedPublication,
  );

  const isExternal = isEntityIdExternal(prompt);
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
  const [isOpened, setIsOpened] = useState(false);
  const [isMoveTo, setIsMoveTo] = useState(false);
  const [publishPromptAction, setPublishPromptAction] =
    useState<PublishActions>();
  const [isContextMenu, setIsContextMenu] = useState(false);

  const promptRef = useRef<HTMLButtonElement>(null);

  const handleContextMenuOpen = useCallback((e: MouseEvent | TouchEvent) => {
    if (hasParentWithFloatingOverlay(e.target as Element)) {
      return;
    }
    setIsContextMenu(true);
  }, []);

  useContextMenuTrigger(handleContextMenuOpen, promptRef);

  const screenState = useScreenState();

  const {
    handleExport,
    handleMoveToFolder,
    handleDuplicate,
    handleInfo,
    handleShare,
    handleUse,
  } = usePromptActions(prompt);

  const isChosen = useMemo(
    () => chosenPromptIds.includes(prompt.id),
    [chosenPromptIds, prompt.id],
  );
  const isModelsInstalled = selectedConversations.every((conv) =>
    installedModelIds.has(conv.model.id),
  );

  const { refs, context } = useFloating({
    open: isContextMenu,
    onOpenChange: setIsContextMenu,
  });

  const dismiss = useDismiss(context);
  const { getFloatingProps } = useInteractions([dismiss]);

  useEffect(() => {
    if (!showModal) {
      setIsOpened(false);
    }
  }, [showModal]);

  const handleOpenPublishing = useCallback(() => {
    setPublishPromptAction(PublishActions.ADD);
  }, []);

  const handleOpenUnpublishing = useCallback(() => {
    setPublishPromptAction(PublishActions.DELETE);
  }, []);

  const handleOpenDeleteModal: MouseEventHandler = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();

    setIsOpened(false);
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

  const handleOpenViewModal = useCallback(
    (e: React.MouseEvent<unknown, globalThis.MouseEvent>, isEdit?: boolean) => {
      e.stopPropagation();
      e.preventDefault();
      setIsOpened(true);

      dispatch(
        PromptsActions.selectPrompt({
          promptId: prompt.id,
          selectInEditMode: isEdit,
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
    },
    [
      additionalItemData?.publicationUrl,
      dispatch,
      isApproveRequiredResource,
      prompt.id,
    ],
  );

  const handleOpenEditModal = useCallback(
    (e: React.MouseEvent<unknown, globalThis.MouseEvent>) => {
      handleOpenViewModal(e, true);
    },
    [handleOpenViewModal],
  );

  const handleOpenMoveToModal = useCallback(() => {
    setIsMoveTo(true);
  }, []);

  const isHighlighted = !isSelectMode
    ? isDeleting || isOpened || (showModal && isSelected) || isContextMenu
    : isChosen;

  const handleSelect: MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      e.stopPropagation();
      setIsContextMenu(false);
      dispatch(PromptsActions.setChosenPrompts({ ids: [prompt.id] }));
    },
    [dispatch, prompt.id],
  );

  const disableUsePrompt =
    isConversationBlocksInput || !isModelsInstalled || !!selectedPublication;

  const handleCloseDialogs = useCallback(() => {
    setIsDeleting(false);
    setPublishPromptAction(undefined);
    setIsMoveTo(false);
  }, []);

  useEffect(() => {
    if (isSelectMode) {
      setIsOpened(false);
      setIsDeleting(false);
    }
  }, [isSelectMode]);

  useEffect(() => {
    if (screenState !== ScreenState.SM) {
      setIsMoveTo(false);
    }
  }, [screenState]);

  const handleToggle = useCallback(() => {
    PromptsActions.setChosenPrompts({ ids: [prompt.id] });
  }, [prompt.id]);

  const moveToModalModel = useMemo(
    () => ({
      isOpen: isMoveTo,
      isMobileOnly: true,
    }),
    [isMoveTo],
  );

  const iconSize = additionalItemData?.isSidePanelItem ? 24 : 18;
  const strokeWidth = additionalItemData?.isSidePanelItem ? 1.5 : 2;

  return (
    <>
      <button
        className={classNames(
          'group relative flex size-full shrink-0 items-center rounded border-l-2 pr-3 hover:bg-accent-primary-alpha disabled:cursor-not-allowed',
          !isSelectMode && '[&:not(:disabled)]:hover:pr-9',
          isContextMenu && 'pr-9',
          !isSelectMode && isHighlighted
            ? 'border-l-accent-primary '
            : 'border-l-transparent',
          isHighlighted && 'bg-accent-primary-alpha',
          additionalItemData?.isSidePanelItem ? 'h-[34px]' : 'h-[30px]',
        )}
        onClick={() => {
          if (!isSelectMode) {
            dispatch(PromptsActions.selectPrompt({ promptId: prompt.id }));
          }

          if (isSelectMode && !isExternal) {
            setIsDeleting(false);
            setIsOpened(false);
            dispatch(PromptsActions.setChosenPrompts({ ids: [prompt.id] }));
          }
        }}
        style={{
          paddingLeft: (level && `${level * 30 + 16}px`) || '0.875rem',
        }}
        ref={promptRef}
        data-qa="prompt"
        disabled={isSelectMode && isExternal}
      >
        <div
          className={classNames('flex size-full items-center gap-2', {
            'pr-6 xl:pr-0':
              !isSelectMode && !isDeleting && !isOpened && isSelected,
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
            isHighlighted={isHighlighted}
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
            className="relative max-h-5 flex-1 select-none truncate whitespace-pre break-all text-left"
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
        {!isSelectMode && !isDeleting && !isOpened && (
          <div
            ref={refs.setFloating}
            {...getFloatingProps()}
            className={classNames(
              'absolute right-0 z-50 flex justify-end group-hover:visible',
              isSelected || isContextMenu ? 'visible' : 'invisible',
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
              onExport={handleExport}
              onOpenMoveToModal={handleOpenMoveToModal}
              onShare={handleShare}
              onPublish={handleOpenPublishing}
              onUnpublish={
                additionalItemData?.publicationUrl
                  ? undefined
                  : handleOpenUnpublishing
              }
              onOpenChange={setIsContextMenu}
              onDuplicate={handleDuplicate}
              onView={handleOpenViewModal}
              isOpen={isContextMenu}
              onSelect={handleSelect}
              disableUse={disableUsePrompt}
              onUse={handleUse}
              onShowInfo={handleInfo}
              className="p-2"
            />
          </div>
        )}
      </button>
      <PromptDialogs
        moveTo={moveToModalModel}
        prompt={prompt}
        isDeleteDialog={isDeleting}
        publishPromptAction={publishPromptAction}
        onCloseModals={handleCloseDialogs}
      />
    </>
  );
};
