import { IconCheck } from '@tabler/icons-react';
import {
  DragEvent,
  MouseEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import {
  hasInvalidNameInPath,
  isEntityNameInvalid,
  isEntityNameOrPathInvalid,
} from '@/src/utils/app/common';
import { getEntityNameError } from '@/src/utils/app/errors';
import { isEntityIdExternal } from '@/src/utils/app/id';
import { hasParentWithFloatingOverlay } from '@/src/utils/app/modals';
import { MoveType, getDragImage } from '@/src/utils/app/move';

import { AdditionalItemData, FeatureType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import {
  PublicationActions,
  PublicationSelectors,
} from '@/src/store/publication/publication.reducers';

import { ConversationContextMenu } from '@/src/components/Chat/ConversationContextMenu';
import { PlaybackIcon } from '@/src/components/Chat/Playback/PlaybackIcon';
import { ReplayAsIsIcon } from '@/src/components/Chat/ReplayAsIsIcon';
import ShareIcon from '@/src/components/Common/ShareIcon';

import { ReviewDot } from '../Chat/Publish/ReviewDot';
import Tooltip from '../Common/Tooltip';
import { ModelIcon } from './ModelIcon';

import {
  ConversationInfo,
  PublishActions,
  UploadStatus,
} from '@epam/ai-dial-shared';

interface ViewProps {
  conversation: ConversationInfo;
  isHighlighted: boolean;
  isChosen?: boolean;
  isSelectMode?: boolean;
  additionalItemData?: AdditionalItemData;
  isContextMenu: boolean;
}

export function ConversationView({
  conversation,
  isHighlighted,
  isChosen = false,
  isSelectMode,
  additionalItemData,
  isContextMenu,
}: ViewProps) {
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
  const selectedConversationIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
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
        {...conversation}
        isHighlighted={isHighlighted}
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
              (selectedConversationIds.includes(conversation.id) ||
                isContextMenu) &&
                isPartOfSelectedPublication &&
                'bg-accent-secondary-alpha',
            )}
          />
        )}
        {conversation.isReplay && (
          <span className="flex shrink-0">
            <ReplayAsIsIcon size={iconSize} />
          </span>
        )}

        {conversation.isPlayback && (
          <span className="flex shrink-0">
            <PlaybackIcon strokeWidth={strokeWidth} size={iconSize} />
          </span>
        )}

        {!conversation.isReplay && !conversation.isPlayback && (
          <ModelIcon
            size={iconSize}
            entityId={conversation.model.id}
            entity={modelsMap[conversation.model.id]}
          />
        )}
      </ShareIcon>
      <div className="relative max-h-5 flex-1 truncate whitespace-pre break-all text-left">
        <Tooltip
          tooltip={t(
            getEntityNameError(isNameInvalid, isInvalidPath, isExternal),
          )}
          hideTooltip={!isNameOrPathInvalid}
          triggerClassName={classNames(
            'block max-h-5 flex-1 truncate whitespace-pre break-all text-left',
            conversation.publicationInfo?.isNotExist && 'text-secondary',
            !!additionalItemData?.publicationUrl &&
              conversation.publicationInfo?.action === PublishActions.DELETE &&
              'text-error',
          )}
          dataQa="entity-name"
        >
          {conversation.name}
        </Tooltip>
      </div>
    </>
  );
}

interface Props {
  item: ConversationInfo;
  level?: number;
  additionalItemData?: AdditionalItemData;
}

export const ConversationComponent = ({
  item: conversation,
  level,
  additionalItemData,
}: Props) => {
  const dispatch = useAppDispatch();

  const selectedConversationIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );

  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );

  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isContextMenu, setIsContextMenu] = useState(false);

  const isSelected = selectedConversationIds.includes(conversation.id);

  const isSelectMode = useAppSelector(
    ConversationsSelectors.selectIsSelectMode,
  );
  const isConversationsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const chosenConversationIds = useAppSelector(
    ConversationsSelectors.selectSelectedItems,
  );

  const isChosen = useMemo(
    () => chosenConversationIds.includes(conversation.id),
    [chosenConversationIds, conversation.id],
  );

  const selectedPublicationUrl = useAppSelector(
    PublicationSelectors.selectSelectedPublicationUrl,
  );

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

  const handleContextMenuOpen = (e: MouseEvent) => {
    if (hasParentWithFloatingOverlay(e.target as Element)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setIsContextMenu(true);
  };

  const isHighlighted = !isSelectMode
    ? isSelected &&
      (!additionalItemData?.publicationUrl ||
        selectedPublicationUrl === additionalItemData.publicationUrl)
    : isChosen;
  const isNameOrPathInvalid = isEntityNameOrPathInvalid(conversation);

  return (
    <div
      className={classNames(
        'group relative flex items-center rounded border-l-2 pr-3 hover:bg-accent-primary-alpha',
        !isSelectMode && isHighlighted
          ? 'border-l-accent-primary'
          : 'border-l-transparent',
        (isHighlighted || isContextMenu) && 'bg-accent-primary-alpha',
        isNameOrPathInvalid && 'text-secondary',
        additionalItemData?.isSidePanelItem ? 'h-[34px]' : 'h-[30px]',
      )}
      style={{
        paddingLeft: (level && `${level * 30 + 16}px`) || '0.875rem',
      }}
      onContextMenu={handleContextMenuOpen}
      data-qa="conversation"
    >
      <button
        className={classNames(
          'group flex size-full cursor-pointer items-center gap-2 disabled:cursor-not-allowed',
          isSelectMode ? 'pr-0' : '[&:not(:disabled)]:group-hover:pr-6',
        )}
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
            if (!isSelectMode) {
              dispatch(
                PublicationActions.selectPublication(
                  additionalItemData?.publicationUrl ?? null,
                ),
              );
            }
          }
        }}
        disabled={messageIsStreaming || (isSelectMode && isExternal)}
        draggable={
          !isExternal &&
          !isNameOrPathInvalid &&
          !isSelectMode &&
          !isConversationsStreaming
        }
        onDragStart={(e) => handleDragStart(e, conversation)}
        ref={buttonRef}
        data-qa={isSelected ? 'selected' : null}
      >
        <ConversationView
          conversation={conversation}
          isHighlighted={isHighlighted || isContextMenu}
          isChosen={isChosen}
          isSelectMode={isSelectMode}
          additionalItemData={additionalItemData}
          isContextMenu={isContextMenu}
        />
      </button>

      {!isSelectMode && !messageIsStreaming && (
        <div
          className={classNames(
            'absolute right-3 z-50 flex cursor-pointer justify-end group-hover:visible',
            (conversation.status === UploadStatus.LOADED || !isContextMenu) &&
              'invisible',
          )}
        >
          <ConversationContextMenu
            conversation={conversation}
            isOpen={isContextMenu}
            setIsOpen={setIsContextMenu}
            publicationUrl={additionalItemData?.publicationUrl}
          />
        </div>
      )}
    </div>
  );
};
