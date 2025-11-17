import React, { memo } from 'react';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getModelShortDescription,
  isDialAiEntityModel,
  isExternalApp,
} from '@/src/utils/app/application';
import { isMyApplication, isMyToolset } from '@/src/utils/app/id';

import { FeatureType } from '@/src/types/common';
import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/selectors';

import {
  CardIconSizes,
  MarketplaceEntitiesTabs,
} from '@/src/constants/marketplace';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';
import { ShareIcon } from '@/src/components/Common/ShareIcon';
import { AgentBookmark } from '@/src/components/Marketplace/AgentBookmark';
import { AgentContextMenu } from '@/src/components/Marketplace/EntityContextMenu/AgentContextMenu';
import { ToolsetContextMenu } from '@/src/components/Marketplace/EntityContextMenu/ToolsetContextMenu';
import { MarketplaceEntityIndicator } from '@/src/components/Marketplace/MarketplaceEntityIndicator';
import { TopicsList } from '@/src/components/Marketplace/TopicsList';

import { PublishActions } from '@epam/ai-dial-shared';

interface CardFooterProps<T> {
  entity: T;
}

const CardFooter = <T extends MarketplaceEntity>({
  entity,
}: CardFooterProps<T>) => {
  return (
    <>
      <EntityMarkdownDescription
        className="mt-3 hidden text-ellipsis text-sm leading-[18px] text-secondary md:line-clamp-2 xl:hidden"
        data-qa="entity-description"
      >
        {getModelShortDescription(entity)}
      </EntityMarkdownDescription>
      <div className="flex flex-col gap-2 pt-3 md:pt-4">
        <div className="w-full">
          {entity.topics && <TopicsList topics={entity.topics} />}
        </div>
      </div>
    </>
  );
};

interface MarketplaceEntityCardProps<T> {
  entity: T;
  onClick: (entity: T) => void;
  onPublish?: (entity: T, action: PublishActions) => void;
  onDelete?: (entity: T) => void;
  onEdit?: (entity: T) => void;
  onBookmarkClick?: (entity: T) => void;
  onLogsClick?: (entity: T) => void;
  isPreview?: boolean;
  dataQA?: string;
}

export const ApplicationCard = memo(
  <T extends MarketplaceEntity>({
    entity,
    onClick,
    onBookmarkClick,
    isPreview = false,
    dataQA,
  }: MarketplaceEntityCardProps<T>) => {
    const { t } = useTranslation(Translation.Marketplace);

    const selectedEntitiesTab = useAppSelector(
      MarketplaceSelectors.selectSelectedEntitiesTab,
    );

    const isAgentsTab = selectedEntitiesTab === MarketplaceEntitiesTabs.AGENTS;

    const screenState = useScreenState();

    const isMyEntity = isAgentsTab
      ? isMyApplication(entity)
      : isMyToolset(entity);
    const { iconSize, shareIconSize } = CardIconSizes[screenState];

    return (
      <div
        onClick={() => onClick(entity)}
        className={classNames(
          'group relative h-[98px] rounded-md bg-layer-2 p-3 shadow-card hover:bg-layer-3 md:h-[162px] md:p-4 xl:h-[164px] xl:p-5',
          !isPreview && 'cursor-pointer',
        )}
        data-qa="agent"
        aria-details={dataQA}
      >
        <div>
          <div className="absolute right-4 top-4 flex gap-1 xl:right-5 xl:top-5">
            {!isPreview && (
              <>
                {isDialAiEntityModel(entity) ? (
                  <AgentContextMenu
                    isPreview={isPreview}
                    className="xl:invisible group-hover:xl:visible"
                    entity={entity}
                  />
                ) : (
                  <ToolsetContextMenu
                    isPreview={isPreview}
                    className="xl:invisible group-hover:xl:visible"
                    entity={entity}
                  />
                )}
                <AgentBookmark
                  onBookmarkClick={onBookmarkClick}
                  entity={entity}
                />
              </>
            )}
          </div>
          <div className="flex items-center gap-4 overflow-hidden">
            <div className="flex shrink-0 items-center justify-center xl:my-[3px]">
              <ShareIcon
                {...entity}
                isHighlighted={false}
                size={shareIconSize}
                featureType={FeatureType.Application}
                iconClassName="bg-layer-2 group-hover:bg-transparent"
                isMyEntity={isMyEntity}
                isExternal={
                  isAgentsTab && isDialAiEntityModel(entity)
                    ? isExternalApp(entity)
                    : false
                }
              >
                <ModelIcon
                  entityId={entity.id}
                  entity={entity}
                  size={iconSize}
                />
              </ShareIcon>
            </div>
            <div className="flex grow flex-col justify-center gap-2 overflow-hidden">
              {entity.version && (
                <div
                  className={classNames(
                    'mr-6 flex items-center gap-1 text-xs leading-[14px] text-secondary',
                    !isMyEntity && '!mr-12',
                  )}
                >
                  {t('Version: ')}
                  <span
                    className="mr-1 max-w-full overflow-hidden truncate whitespace-nowrap"
                    data-qa="version"
                  >
                    {entity.version}
                  </span>

                  <MarketplaceEntityIndicator entity={entity} />
                </div>
              )}
              <div className="flex whitespace-nowrap">
                <div
                  className={classNames(
                    'mr-6 flex shrink truncate text-base font-semibold leading-[20px] text-primary',
                    !isMyEntity && !entity.version && '!mr-12',
                  )}
                >
                  <span className="truncate" data-qa="entity-name">
                    {entity.name}
                  </span>
                </div>
              </div>
              <div data-qa="entity-description" className="hidden xl:block">
                <EntityMarkdownDescription className="text-ellipsis text-sm leading-[18px] text-secondary xl:!line-clamp-2">
                  {getModelShortDescription(entity)}
                </EntityMarkdownDescription>
              </div>
            </div>
          </div>
        </div>
        <CardFooter entity={entity} />
      </div>
    );
  },
);
ApplicationCard.displayName = 'ApplicationCard';
