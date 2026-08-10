import React, { memo } from 'react';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getModelName,
  getModelShortDescription,
  isDialAiEntityModel,
  isExternalApp,
} from '@/src/utils/app/application';
import { isMyApplication, isMyToolset } from '@/src/utils/app/id';
import { isCreatedMarketplaceEntity } from '@/src/utils/app/marketplace';

import { FeatureType } from '@/src/types/common';
import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors, UISelectors } from '@/src/store/selectors';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';
import {
  CardIconSizes,
  MarketplaceEntitiesTabs,
} from '@/src/constants/marketplace';
import { NA_VERSION } from '@/src/constants/publication';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';
import { ShareIcon } from '@/src/components/Common/ShareIcon';
import { MarketplaceEntityContextMenu } from '@/src/components/Marketplace/EntityContextMenu/MarketplaceEntityContextMenu';
import { MarketplaceEntityBookmark } from '@/src/components/Marketplace/MarketplaceEntityBookmark';
import { MarketplaceEntityIndicator } from '@/src/components/Marketplace/MarketplaceEntityIndicator';
import { TopicsList } from '@/src/components/Marketplace/TopicsList';

import { PublishActions } from '@epam/ai-dial-shared';
import { DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';

interface CardFooterProps<T> {
  entity: T;
}

const CardFooter = <T extends MarketplaceEntity>({
  entity,
}: CardFooterProps<T>) => {
  const locale = useAppSelector(UISelectors.selectLocale);

  return (
    <>
      <EntityMarkdownDescription
        className="mt-3 hidden text-ellipsis text-sm leading-[18px] text-secondary md:line-clamp-2 xl:hidden"
        data-qa="entity-description"
      >
        {getModelShortDescription(entity, locale)}
      </EntityMarkdownDescription>
      <div className="flex flex-col gap-2 pt-3 xl:pt-4">
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

export const MarketplaceEntityCard = memo(
  <T extends MarketplaceEntity>({
    entity,
    onClick,
    onBookmarkClick,
    isPreview = false,
    dataQA,
  }: MarketplaceEntityCardProps<T>) => {
    const { t } = useTranslation(Translation.Marketplace);

    const locale = useAppSelector(UISelectors.selectLocale);
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
          'group relative flex h-[98px] flex-col rounded-md bg-layer-2 p-3 shadow-card hover:bg-layer-3 md:h-[162px] md:p-4 xl:h-[164px] xl:p-5',
          !isPreview && 'cursor-pointer',
        )}
        data-qa="entity"
        aria-details={dataQA}
      >
        <div>
          <div className="absolute end-4 top-4 flex gap-1 xl:end-5 xl:top-5">
            {!isPreview && (
              <>
                <MarketplaceEntityContextMenu
                  isPreview={isPreview}
                  className="xl:invisible group-hover:xl:visible"
                  entity={entity}
                />
                <MarketplaceEntityBookmark
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
                containerClassName="flex"
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
                  isTooltipDisabled
                />
              </ShareIcon>
            </div>
            <div className="flex grow flex-col justify-center gap-2 overflow-hidden">
              <div
                className={classNames(
                  'me-10 flex items-center gap-1 text-xs leading-[14px] text-secondary',
                )}
              >
                {(isCreatedMarketplaceEntity(entity) || entity.version) && (
                  <>
                    {t(MarketplaceI18nKeys.VersionPrefixMarketplace)}
                    <span className="me-1 truncate" data-qa="version">
                      {entity.version || t(NA_VERSION)}
                    </span>
                  </>
                )}

                <MarketplaceEntityIndicator entity={entity} />
              </div>
              <div
                className={classNames(
                  'flex whitespace-nowrap',
                  !isMyEntity && !entity.version && '!me-12',
                )}
              >
                <div
                  className={classNames(
                    'me-6 flex w-full shrink text-base font-semibold leading-[20px] text-primary',
                  )}
                >
                  <DialEllipsisTooltip
                    text={getModelName(entity, locale)}
                    id="entity-name"
                  />
                </div>
              </div>
              <div data-qa="entity-description" className="hidden xl:block">
                <EntityMarkdownDescription className="text-ellipsis text-sm leading-[18px] text-secondary xl:!line-clamp-2">
                  {getModelShortDescription(entity, locale)}
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
MarketplaceEntityCard.displayName = 'MarketplaceEntityCard';
