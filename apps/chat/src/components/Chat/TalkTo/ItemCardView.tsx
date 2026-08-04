import React, { useCallback, useMemo } from 'react';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getModelShortDescription,
  isDialAiEntityModel,
  isExternalApp,
} from '@/src/utils/app/application';
import {
  isOldConversationReplay,
  isPlaybackConversation,
} from '@/src/utils/app/conversation';
import { isMyApplication } from '@/src/utils/app/id';
import {
  getGroupMarketplaceEntityKey,
  isCreatedMarketplaceEntity,
} from '@/src/utils/app/marketplace';
import { isToolsetEntityModel } from '@/src/utils/app/toolsets';
import { PseudoModel, isPseudoModel } from '@/src/utils/server/api';

import { Conversation } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import {
  ModelsSelectors,
  ToolsetSelectors,
  UISelectors,
} from '@/src/store/selectors';

import { REPLAY_AS_IS_MODEL } from '@/src/constants/chat';
import { MarketplaceI18nKeys } from '@/src/constants/i18n';
import { CardIconSizes } from '@/src/constants/marketplace';

import { ModelVersionSelect } from '@/src/components/Chat/ModelVersionSelect';
import { PlaybackIcon } from '@/src/components/Chat/Playback/PlaybackIcon';
import { ReplayAsIsIcon } from '@/src/components/Chat/ReplayAsIsIcon';
import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';
import { ShareIcon } from '@/src/components/Common/ShareIcon';
import { Tooltip } from '@/src/components/Common/Tooltip';
import { MarketplaceEntityContextMenu } from '@/src/components/Marketplace/EntityContextMenu/MarketplaceEntityContextMenu';
import { MarketplaceEntityIndicator } from '@/src/components/Marketplace/MarketplaceEntityIndicator';
import { TopicsList } from '@/src/components/Marketplace/TopicsList';

import { DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';

export type DisabledActions = Record<string, boolean>;

interface ItemCardViewProps<T extends MarketplaceEntity> {
  entity: T;
  isSelected: boolean;
  onClick: (entity: T) => void;
  conversation?: Conversation;
  disabled?: boolean;
  hasError?: boolean;
  isUnavailableModel?: boolean;
  hasContextMenu?: boolean;
  className?: string;
  tooltip?: string;
  selectedBaseIdsSet?: Set<string>;
  overrideDisabledActions?: Partial<DisabledActions>;
}

const agentDisabledActions = {
  copyLink: true,
  unpublish: true,
  connect: true,
};

const toolsetDisabledActions = {
  copyLink: true,
  edit: true,
  share: true,
  unshare: true,
  publish: true,
  unpublish: true,
  delete: true,
  connect: true,
};

export const ItemCardView = <T extends MarketplaceEntity>({
  entity,
  isSelected,
  onClick,
  conversation,
  disabled,
  hasError,
  isUnavailableModel,
  hasContextMenu = true,
  className,
  selectedBaseIdsSet,
  overrideDisabledActions,
  tooltip,
}: ItemCardViewProps<T>) => {
  const { t } = useTranslation(Translation.Marketplace);

  const locale = useAppSelector(UISelectors.selectLocale);
  const allModels = useAppSelector(ModelsSelectors.selectModels);
  const allToolsets = useAppSelector(ToolsetSelectors.selectToolsets);

  const isMyEntity = isMyApplication(entity);

  const screenState = useScreenState();

  const { iconSize, shareIconSize } = CardIconSizes[screenState];

  const disabledActions = useMemo(() => {
    const baseActions = isDialAiEntityModel(entity)
      ? agentDisabledActions
      : toolsetDisabledActions;

    return {
      ...baseActions,
      ...overrideDisabledActions,
    };
  }, [entity, overrideDisabledActions]);

  const versionsToSelect = useMemo(() => {
    const sourceList = isDialAiEntityModel(entity)
      ? allModels
      : isToolsetEntityModel(entity)
        ? allToolsets
        : [];

    if (!isCreatedMarketplaceEntity(entity) && !entity.version) {
      return [];
    }

    return sourceList.filter(
      (item: MarketplaceEntity) =>
        getGroupMarketplaceEntityKey(entity) ===
        getGroupMarketplaceEntityKey(item),
    );
  }, [allModels, allToolsets, entity]);

  const handleSelectVersion = useCallback(
    (model: MarketplaceEntity) => {
      onClick?.(model as T);
    },
    [onClick],
  );

  const isOldReplay =
    conversation &&
    entity.id === REPLAY_AS_IS_MODEL &&
    isOldConversationReplay(conversation.replay);

  const cardContent = (
    <div
      onClick={() => {
        if (!disabled) {
          onClick(entity);
        }
      }}
      className={classNames(
        'group relative flex flex-col rounded-md border bg-layer-2 p-[11px] md:p-[15px] xl:p-[19px]',
        isSelected && !isUnavailableModel && 'border-accent-primary',
        !isSelected && 'border-primary',
        hasError && 'border-error',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-layer-3',
        isOldReplay && 'pb-2',
        tooltip && 'size-full',
        className,
      )}
      aria-selected={isSelected}
      data-qa="entity"
    >
      {hasContextMenu && (
        <div className="absolute right-4 top-4 flex cursor-pointer gap-1 xl:right-5 xl:top-5">
          <MarketplaceEntityContextMenu
            className="xl:invisible group-hover:xl:visible"
            entity={entity}
            disabledActions={disabledActions}
          />
        </div>
      )}
      <div className="flex items-center gap-4 overflow-hidden">
        <div className="flex shrink-0 items-center justify-center xl:my-[3px]">
          {entity.reference === PseudoModel.Playback && (
            <span
              className="shrink-0 rounded-full bg-model-icon"
              style={{
                height: `${iconSize}px`,
                width: `${iconSize}px`,
              }}
            >
              <PlaybackIcon size={iconSize} />
            </span>
          )}
          {entity.reference === REPLAY_AS_IS_MODEL && (
            <ReplayAsIsIcon size={iconSize} />
          )}
          {!isPseudoModel(entity.reference) &&
            entity.reference !== REPLAY_AS_IS_MODEL && (
              <ShareIcon
                {...entity}
                isHighlighted={false}
                size={shareIconSize}
                featureType={FeatureType.Application}
                iconClassName="bg-layer-3 group-hover:bg-transparent"
                isMyEntity={isMyEntity}
                isExternal={
                  isDialAiEntityModel(entity) && isExternalApp(entity)
                }
              >
                <ModelIcon
                  isTooltipDisabled
                  entityId={entity.id}
                  entity={entity}
                  size={iconSize}
                />
              </ShareIcon>
            )}
        </div>
        <div className="flex grow flex-col justify-center gap-1 overflow-hidden leading-4 md:gap-2">
          <div className="flex items-center gap-2">
            {!!versionsToSelect.length && (
              <div className="flex items-center truncate">
                <p className="mr-1 text-xs text-secondary">
                  {t(MarketplaceI18nKeys.Version)}:{' '}
                </p>
                <ModelVersionSelect
                  readonly={
                    conversation && isPlaybackConversation(conversation)
                  }
                  className="h-max truncate text-xs"
                  triggerClassName="text-xs"
                  selectedBaseIdsSet={selectedBaseIdsSet}
                  entities={versionsToSelect}
                  onSelect={handleSelectVersion}
                  currentEntity={entity}
                />
              </div>
            )}

            <MarketplaceEntityIndicator entity={entity} />
          </div>
          <div className="flex whitespace-nowrap">
            <div
              className={classNames(
                'shrink truncate text-base font-semibold leading-[19px] text-primary',
                !isMyEntity && !entity.version && 'mr-6',
                isUnavailableModel ? 'text-secondary' : 'text-primary',
              )}
            >
              <DialEllipsisTooltip text={entity.name} id="entity-name" />
            </div>
          </div>
          <EntityMarkdownDescription
            className={classNames(
              'hidden text-ellipsis text-sm leading-4',
              isUnavailableModel ? 'text-error' : 'text-secondary',
              entity.id !== REPLAY_AS_IS_MODEL
                ? 'xl:!line-clamp-2'
                : 'xl:block',
            )}
          >
            {getModelShortDescription(entity, locale)}
          </EntityMarkdownDescription>
        </div>
      </div>
      <EntityMarkdownDescription
        className={classNames(
          'mt-3 hidden text-ellipsis text-sm leading-4 md:line-clamp-2 xl:hidden',
          isUnavailableModel ? 'text-error' : 'text-secondary',
        )}
      >
        {getModelShortDescription(entity, locale)}
      </EntityMarkdownDescription>
      <div className="mt-auto">
        <div
          className={classNames(
            'mt-3 flex grow gap-2 overflow-hidden',
            isOldReplay ? 'mt-1.5 md:mt-1 xl:mt-2' : 'xl:mt-4',
          )}
        >
          {isOldReplay && (
            <span className="text-xs leading-[15px] text-error">
              {t(MarketplaceI18nKeys.OldReplayWarning)}
            </span>
          )}
          {entity.topics && <TopicsList topics={entity.topics} />}
        </div>
      </div>
    </div>
  );

  return tooltip ? (
    <Tooltip tooltip={tooltip}>{cardContent}</Tooltip>
  ) : (
    cardContent
  );
};
