import React, { memo } from 'react';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';

import {
  getModelName,
  getModelShortDescription,
} from '@/src/utils/app/application';
import { isMyApplication } from '@/src/utils/app/id';

import { FeatureType, ScreenState } from '@/src/types/common';
import { MarketplaceEntity } from '@/src/types/marketplace';

import { useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/selectors';

import { TableIconSizes } from '@/src/constants/marketplace';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';
import { ShareIcon } from '@/src/components/Common/ShareIcon';
import { MarketplaceEntityBookmark } from '@/src/components/Marketplace/MarketplaceEntityBookmark';

import { DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';

interface Props<T> {
  entity: T;
  isHovered: boolean;
  onClick: (entity: T) => void;
  onRowHoverOver: () => void;
  onRowHover: (id: string) => void;
  onBookmarkClick?: (entity: T) => void;
}

export const MarketplaceEntitiesTableLeftSideRow: React.FC<
  Props<MarketplaceEntity>
> = memo(
  ({
    entity,
    isHovered,
    onClick,
    onRowHoverOver,
    onRowHover,
    onBookmarkClick,
  }) => {
    const locale = useAppSelector(UISelectors.selectLocale);

    const screenState = useScreenState();

    const { iconSize, shareIconSize } = TableIconSizes[screenState];

    return (
      <li
        onClick={() => onClick(entity)}
        onMouseEnter={() => onRowHover(entity.id)}
        onMouseLeave={() => onRowHoverOver()}
        className={classNames(
          'flex h-[55px] cursor-pointer py-3 pe-1 ps-3 md:h-[115px] md:py-4 md:ps-4',
          isHovered && 'bg-layer-2',
        )}
      >
        <div className="flex size-full items-center gap-3 md:gap-4">
          <div className="flex items-center gap-2 md:gap-4">
            {(screenState === ScreenState.MD ||
              screenState === ScreenState.SM) && (
              <MarketplaceEntityBookmark
                entity={entity}
                onBookmarkClick={onBookmarkClick}
                allocatePlace
              />
            )}
            <ShareIcon
              {...entity}
              isHighlighted={false}
              size={shareIconSize}
              featureType={FeatureType.Application}
              iconClassName={isHovered ? 'bg-layer-2 ' : 'bg-layer-1'}
              isMyEntity={isMyApplication(entity)}
            >
              <ModelIcon
                entityId={entity.id}
                entity={entity}
                size={iconSize}
                isTooltipDisabled
              />
            </ShareIcon>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex">
              <DialEllipsisTooltip
                text={getModelName(entity, locale)}
                className="max-w-screen-sm text-base font-semibold leading-5"
              />
            </div>
            <EntityMarkdownDescription className="mt-2 hidden max-w-screen-sm truncate whitespace-normal break-all !text-sm font-light !leading-[18px] text-secondary md:line-clamp-3">
              {getModelShortDescription(entity, locale)}
            </EntityMarkdownDescription>
          </div>
        </div>
      </li>
    );
  },
);

MarketplaceEntitiesTableLeftSideRow.displayName =
  'MarketplaceEntitiesTableLeftSideRow';
