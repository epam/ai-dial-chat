import { DragEvent, memo, useCallback, useMemo, useRef, useState } from 'react';

import { useRouter } from 'next/router';

import classNames from 'classnames';

import { useContextMenuTrigger } from '@/src/hooks/useContextMenuTrigger';
import { useScreenState } from '@/src/hooks/useScreenState';
import { useScrollToEntity } from '@/src/hooks/useScrollToEntity';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  hasInvalidNameInPath,
  isEntityNameInvalid,
  isEntityNameOrPathInvalid,
} from '@/src/utils/app/common';
import {
  isPlaybackConversation,
  isReplayConversation,
} from '@/src/utils/app/conversation';
import { translateConversationDisplayName } from '@/src/utils/app/translateConversationDisplayName';
import { getEntityNameError } from '@/src/utils/app/errors';
import { isEntityIdExternal } from '@/src/utils/app/id';
import { hasParentWithFloatingOverlay } from '@/src/utils/app/modals';
import { MoveType, getDragImage } from '@/src/utils/app/move';

import {
  AdditionalItemData,
  FeatureType,
  ScreenState,
} from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { ConversationsActions, PublicationActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  ModelsSelectors,
  PublicationSelectors,
} from '@/src/store/selectors';

import { ConversationContextMenu } from '@/src/components/Chat/ConversationContextMenu';
import { PlaybackIcon } from '@/src/components/Chat/Playback/PlaybackIcon';
import { ReviewDot } from '@/src/components/Chat/Publish/ReviewDot';
import { ReplayAsIsIcon } from '@/src/components/Chat/ReplayAsIsIcon';
import { Checkbox } from '@/src/components/Common/Checkbox';
import { ShareIcon } from '@/src/components/Common/ShareIcon';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { ModelIcon } from './ModelIcon';

import {
  ConversationInfo,
  PublishActions,
  UploadStatus,
} from '@epam/ai-dial-shared';
import { DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';

interface ViewProps {
  conversation: ConversationInfo;
  isHighlighted: boolean;
  isSelected: boolean;
  isChosen?: boolean;
  isSelectMode?: boolean;
  additionalItemData?: AdditionalItemData;
  isContextMenu: boolean;
  isDraggingOver?: boolean;
}

function ConversationView({
  conversation,
  isHighlighted,
  isSelected,
  isChosen = false,
  isSelectMode,
  additionalItemData,
  isContextMenu,
  isDraggingOver,
}: ViewProps) {
  const router = useRouter();
  const { t } = useTranslation(Translation.Chat);

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const selectedPublicationUrl = useAppSelector(
    PublicationSelectors.selectSelectedPublicationUrl,
  );
  const resourceToReview = useAppSelector((state) =>
    PublicationSelectors.selectResourceToReviewByReviewAndPublicationUrls(
      state,
      conversation.id,
      additionalItemData?.publicationUrl,
    ),
  );

  const handleToggle = useCallback(() => {
    ConversationsActions.setChosenConversations({
      ids: [conversation.id],
    });
  }, [conversation.id]);

  const isNameInvalid = isEntityNameInvalid(conversation.name);
  const isInvalidPath = hasInvalidNameInPath(conversation.folderId);
  const isNameOrPathInvalid = isNameInvalid || isInvalidPath;
  const isPartOfSelectedPublication =
    !additionalItemData?.publicationUrl ||
    selectedPublicationUrl === additionalItemData?.publicationUrl;

  const iconSize = additionalItemData?.isSidePanelItem ? 24 : 18;
  const strokeWidth = additionalItemData?.isSidePanelItem ? 1.5 : 2;
  const isExternal = isEntityIdExternal(conversation);
  const isReplay = isReplayConversation(conversation);
  const isPlayback = isPlaybackConversation(conversation);
  const displayName = useMemo(
    () =>
      translateConversationDisplayName(conversation.name, router.locale, t),
    [conversation.name, router.locale, t],
  );

  return (
    <>
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
        <Checkbox
          className={additionalItemData?.isSidePanelItem && 'mr-0'}
          checked={isChosen}
          onChange={handleToggle}
        />
      </div>
      <ShareIcon
        {...conversation}
        isHighlighted={isHighlighted}
        isDraggingOver={isDraggingOver}
        featureType={FeatureType.Chat}
        containerClassName={classNames(
          isSelectMode && !isExternal && 'group-hover:hidden',
          isChosen && !isExternal && 'hidden',
        )}
      >
        {resourceToReview && !resourceToReview.reviewed && (
          <ReviewDot
            className={classNames(
              'group-hover:bg-accent-secondary-alpha',
              (isSelected || isContextMenu) &&
                isPartOfSelectedPublication &&
                'bg-accent-secondary-alpha',
            )}
          />
        )}
        {isReplay && (
          <span className="flex shrink-0">
            <ReplayAsIsIcon size={iconSize} />
          </span>
        )}

        {isPlayback && (
          <span className="flex shrink-0">
            <PlaybackIcon strokeWidth={strokeWidth} size={iconSize} />
          </span>
        )}

        {!isReplay && !isPlayback && (
          <ModelIcon
            size={iconSize}
            entityId={conversation.model.id}
            entity={modelsMap[conversation.model.id]}
          />
        )}
      </ShareIcon>
      <div className="relative max-h-5 flex-1 select-none truncate whitespace-pre break-all text-start">
        <Tooltip
          tooltip={t(
            getEntityNameError(isNameInvalid, isInvalidPath, isExternal),
          )}
          hideTooltip={!isNameOrPathInvalid}
          triggerClassName={classNames(
            'block max-h-5 min-w-0 flex-1 text-start',
            conversation.publicationInfo?.isNotExist && 'text-secondary',
            !!additionalItemData?.publicationUrl &&
              conversation.publicationInfo?.action === PublishActions.DELETE &&
              'text-error',
          )}
          dataQa="entity-name"
        >
          <DialEllipsisTooltip text={displayName} id="entity-name-value" />
        </Tooltip>
      </div>
    </>
  );
}

interface Props {
  item: ConversationInfo;
  level?: number;
  additionalItemData?: AdditionalItemData;
  isDraggingOver?: boolean;
}

export const ConversationComponent = memo(
  ({
    item: conversation,
    level,
    additionalItemData,
    isDraggingOver,
  }: Props) => {
    const dispatch = useAppDispatch();

    const isSelected = useAppSelector((state) =>
      ConversationsSelectors.selectSelectedConversationsIds(state).includes(
        conversation.id,
      ),
    );
    const isSelectMode = useAppSelector(
      ConversationsSelectors.selectIsSelectMode,
    );
    const isConversationsStreaming = useAppSelector(
      ConversationsSelectors.selectIsConversationsStreaming,
    );
    const isChosen = useAppSelector((state) =>
      ConversationsSelectors.selectSelectedItems(state).includes(
        conversation.id,
      ),
    );
    const selectedPublicationUrl = useAppSelector(
      PublicationSelectors.selectSelectedPublicationUrl,
    );

    const [isContextMenu, setIsContextMenu] = useState(false);

    const screenState = useScreenState();
    const isMobileOrTablet =
      screenState === ScreenState.SM || screenState === ScreenState.MD;

    const shouldShowPadding = isMobileOrTablet
      ? isContextMenu && conversation.status !== UploadStatus.LOADED
      : isContextMenu;

    const conversationRef = useRef<HTMLDivElement>(null);

    const handleContextMenuOpen = useCallback((e: MouseEvent | TouchEvent) => {
      if (hasParentWithFloatingOverlay(e.target as Element)) {
        return;
      }
      setIsContextMenu(true);
    }, []);

    useScrollToEntity({
      entityId: conversation.id,
      elementRef: conversationRef,
    });

    useContextMenuTrigger(handleContextMenuOpen, conversationRef);

    const isExternal = isEntityIdExternal(conversation);

    const handleDragStart = useCallback(
      (e: DragEvent<HTMLButtonElement>, conversation: ConversationInfo) => {
        if (
          e.dataTransfer &&
          !isExternal &&
          !isSelectMode &&
          !isConversationsStreaming
        ) {
          e.dataTransfer.setDragImage(getDragImage(), 0, 0);
          e.dataTransfer.setData(
            MoveType.Conversation,
            JSON.stringify(conversation),
          );
        }
      },
      [isConversationsStreaming, isExternal, isSelectMode],
    );

    const isPublishedItemSelected = !!additionalItemData?.publicationUrl;
    const isPublicationUrlEqual =
      selectedPublicationUrl === additionalItemData?.publicationUrl;
    const isHighlighted = !isSelectMode
      ? (isSelected && !isPublishedItemSelected && !selectedPublicationUrl) ||
        (isSelected && isPublicationUrlEqual)
      : isChosen;
    const isNameOrPathInvalid = isEntityNameOrPathInvalid(conversation);

    return (
      <div
        className={classNames(
          'group relative flex items-center rounded border-s-2 hover:bg-accent-primary-alpha',
          !isSelectMode && isHighlighted
            ? 'border-s-accent-primary'
            : 'border-s-transparent',
          (isHighlighted || isContextMenu) && 'bg-accent-primary-alpha',
          isNameOrPathInvalid && 'text-secondary',
          additionalItemData?.isSidePanelItem ? 'h-[34px]' : 'h-[30px]',
        )}
        ref={conversationRef}
        data-qa="conversation"
      >
        <button
          className={classNames(
            'group flex size-full items-center gap-2 pe-3 disabled:cursor-not-allowed',
            !isSelectMode && '[&:not(:disabled)]:group-hover:pe-9',
            shouldShowPadding && 'pe-9',
          )}
          style={{
            paddingInlineStart: (level && `${level * 30 + 16}px`) || '0.875rem',
          }}
          disabled={isConversationsStreaming || (isSelectMode && isExternal)}
          draggable={
            !isExternal &&
            !isNameOrPathInvalid &&
            !isSelectMode &&
            !isConversationsStreaming
          }
          onClick={() => {
            if (!isSelectMode || !isExternal) {
              dispatch(
                !isSelectMode
                  ? ConversationsActions.selectConversations({
                      conversationIds: [conversation.id],
                    })
                  : ConversationsActions.setChosenConversations({
                      ids: [conversation.id],
                    }),
              );
              if (
                !isSelectMode &&
                (additionalItemData?.publicationUrl || selectedPublicationUrl)
              ) {
                dispatch(
                  PublicationActions.selectPublication(
                    additionalItemData?.publicationUrl ?? null,
                  ),
                );
              }
            }
          }}
          onDragStart={(e) => handleDragStart(e, conversation)}
          data-qa={isSelected ? 'selected-entity' : undefined}
        >
          <ConversationView
            conversation={conversation}
            isHighlighted={isHighlighted || isContextMenu}
            isSelected={isSelected}
            isChosen={isChosen}
            isSelectMode={isSelectMode}
            additionalItemData={additionalItemData}
            isContextMenu={isContextMenu}
            isDraggingOver={isDraggingOver}
          />
        </button>

        {!isSelectMode && !isConversationsStreaming && (
          <div
            className={classNames(
              'invisible absolute end-0 z-50 flex cursor-pointer justify-end group-hover:visible',
              isContextMenu &&
                (isMobileOrTablet
                  ? conversation.status !== UploadStatus.LOADED && 'visible'
                  : 'visible'),
            )}
          >
            <ConversationContextMenu
              conversation={conversation}
              isOpen={isContextMenu}
              setIsOpen={setIsContextMenu}
              publicationUrl={additionalItemData?.publicationUrl}
              className="p-2"
            />
          </div>
        )}
      </div>
    );
  },
);
ConversationComponent.displayName = 'ConversationComponent';
