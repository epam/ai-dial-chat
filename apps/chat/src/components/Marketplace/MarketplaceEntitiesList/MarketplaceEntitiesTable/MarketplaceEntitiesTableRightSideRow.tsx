import { memo, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';

import { isDialAiEntityModel } from '@/src/utils/app/application';
import { isMyApplication } from '@/src/utils/app/id';

import { ScreenState } from '@/src/types/common';
import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { AuthSelectors } from '@/src/store/auth/auth.selectors';
import { useAppSelector } from '@/src/store/hooks';

import { DateRenderer } from '@/src/components/Common/DateRenderer';
import { Tooltip } from '@/src/components/Common/Tooltip';
import { MarketplaceEntityContextMenu } from '@/src/components/Marketplace/EntityContextMenu/MarketplaceEntityContextMenu';
import { MarketplaceEntityBookmark } from '@/src/components/Marketplace/MarketplaceEntityBookmark';
import { MarketplaceEntityIndicator } from '@/src/components/Marketplace/MarketplaceEntityIndicator';
import { MarketplaceEntityTopic } from '@/src/components/Marketplace/MarketplaceEntityTopic';
import { TopicsList } from '@/src/components/Marketplace/TopicsList';

interface Props<T> {
  entity: T;
  isHovered: boolean;
  onClick: (entity: T) => void;
  onRowHoverOver: () => void;
  onRowHover: (id: string) => void;
  onBookmarkClick?: (entity: T) => void;
}

export const MarketplaceEntitiesTableRightSideRow: React.FC<
  Props<MarketplaceEntity>
> = memo(
  ({
    entity,
    isHovered,
    onClick,
    onRowHover,
    onRowHoverOver,
    onBookmarkClick,
  }) => {
    const { t } = useTranslation(Translation.Marketplace);

    const userName = useAppSelector(AuthSelectors.selectUserName);

    const screenState = useScreenState();

    const author = isDialAiEntityModel(entity) ? entity.owner : entity.author;
    const displayedAuthor =
      (isMyApplication(entity) ? userName : author) ?? t('Unknown');

    const { visibleTopics, hiddenTopics } = useMemo<{
      visibleTopics: string[];
      hiddenTopics: string[];
    }>(() => {
      if (!entity.topics) {
        return { visibleTopics: [], hiddenTopics: [] };
      }

      if (entity.topics?.length <= 3) {
        return { visibleTopics: entity.topics, hiddenTopics: [] };
      }

      return {
        visibleTopics: entity.topics.slice(0, 2),
        hiddenTopics: entity.topics.slice(2),
      };
    }, [entity.topics]);

    return (
      <li
        onClick={() => onClick(entity)}
        onMouseEnter={() => onRowHover(entity.id)}
        onMouseLeave={() => onRowHoverOver()}
        className={classNames(
          'relative flex h-[55px] min-w-full cursor-pointer gap-3 py-3 pl-4 pr-3 md:h-[115px] md:gap-5 md:p-4',
          isHovered && 'bg-layer-2',
        )}
      >
        <div className="flex w-[100px] min-w-[100px] flex-col justify-center gap-1">
          <MarketplaceEntityIndicator entity={entity} />
          <span className="truncate pl-[6px]">{entity.version}</span>
        </div>
        <div className="flex w-[161px] min-w-[161px] flex-col justify-center gap-2 overflow-hidden">
          {screenState === ScreenState.SM ? (
            <TopicsList topics={entity.topics ?? []} />
          ) : (
            <>
              {visibleTopics.map((topic) => (
                <MarketplaceEntityTopic
                  key={topic}
                  topic={topic}
                  className="max-w-full truncate"
                />
              ))}
              {!!hiddenTopics.length && (
                <Tooltip
                  triggerClassName="flex"
                  tooltip={
                    <div className="my-1 flex max-w-48 flex-wrap gap-2">
                      {hiddenTopics.map((topic) => (
                        <MarketplaceEntityTopic
                          key={topic}
                          topic={topic}
                          className="max-w-full truncate"
                        />
                      ))}
                    </div>
                  }
                  placement="top"
                >
                  <span className="flex items-center rounded border border-accent-primary px-1.5 py-1 text-xs leading-3">
                    +{hiddenTopics.length}
                  </span>
                </Tooltip>
              )}
            </>
          )}
        </div>
        <div className="flex w-[130px] min-w-[130px] items-center">
          <p className="truncate">{displayedAuthor}</p>
        </div>
        <div className="flex w-[86px] min-w-[86px] items-center">
          <p className="truncate">
            {entity?.createdAt ? (
              <DateRenderer dateValue={entity.createdAt} />
            ) : (
              t('Unknown')
            )}
          </p>
        </div>
        <div className="hidden flex-none items-center xl:flex">
          <div className="flex gap-1">
            <MarketplaceEntityBookmark
              onBookmarkClick={onBookmarkClick}
              entity={entity}
              allocatePlace
            />
            <MarketplaceEntityContextMenu
              className={isHovered ? 'xl:visible' : 'xl:invisible'}
              entity={entity}
            />
          </div>
        </div>
      </li>
    );
  },
);

MarketplaceEntitiesTableRightSideRow.displayName =
  'MarketplaceEntitiesTableRightSideRow';
