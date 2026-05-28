import React, { memo, useCallback, useMemo, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';

import { isDialAiEntityModel } from '@/src/utils/app/application';
import { isMyApplication } from '@/src/utils/app/id';
import { isCreatedMarketplaceEntity } from '@/src/utils/app/marketplace';

import { ScreenState } from '@/src/types/common';
import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { AuthSelectors } from '@/src/store/auth/auth.selectors';
import { useAppSelector } from '@/src/store/hooks';

import { stopBubbling } from '@/src/constants/chat';
import { MarketplaceI18nKeys } from '@/src/constants/i18n';
import { NA_VERSION } from '@/src/constants/publication';

import { DateRenderer } from '@/src/components/Common/DateRenderer';
import { Tooltip } from '@/src/components/Common/Tooltip';
import { MarketplaceEntityContextMenu } from '@/src/components/Marketplace/EntityContextMenu/MarketplaceEntityContextMenu';
import { MarketplaceEntityBookmark } from '@/src/components/Marketplace/MarketplaceEntityBookmark';
import { MarketplaceEntityIndicator } from '@/src/components/Marketplace/MarketplaceEntityIndicator';
import { MarketplaceEntityTopic } from '@/src/components/Marketplace/MarketplaceEntityTopic';
import { TopicsList } from '@/src/components/Marketplace/TopicsList';

import { DialLinkButton, ElementSize } from '@epam/ai-dial-ui-kit';

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

    const [open, setOpen] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleDelayShow = useCallback((show: boolean) => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setOpen(show), 100);
    }, []);

    const author = isDialAiEntityModel(entity) ? entity.owner : entity.author;
    const displayedAuthor =
      (isMyApplication(entity) ? userName : author) ??
      t(MarketplaceI18nKeys.UnknownMarketplace);

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
          'relative flex h-[55px] min-w-full cursor-pointer gap-3 pe-3 ps-4 md:h-[115px] md:gap-5 md:p-4',
          isHovered && 'bg-layer-2',
        )}
      >
        <div className="flex w-[114px] min-w-[114px] flex-col justify-center gap-1 px-2.5">
          <MarketplaceEntityIndicator entity={entity} />
          <span className="truncate">
            {entity.version ||
              (isCreatedMarketplaceEntity(entity) ? t(NA_VERSION) : '')}
          </span>
        </div>
        <div className="flex w-[161px] min-w-[161px] flex-col justify-center gap-2 overflow-hidden px-2.5">
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
                  isTriggerClickable
                  isHoverDisabled
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
                  open={open}
                  onOpenChange={setOpen}
                >
                  <DialLinkButton
                    className="min-w-0 border-accent-primary px-1.5 py-1"
                    textClassName="leading-3"
                    size={ElementSize.Small}
                    onClick={(event) => {
                      stopBubbling(event);
                      handleDelayShow(!open);
                    }}
                    label={`+${hiddenTopics.length}`}
                  />
                </Tooltip>
              )}
            </>
          )}
        </div>
        <div className="flex w-[130px] min-w-[130px] items-center px-2.5">
          <p className="truncate">{displayedAuthor}</p>
        </div>
        <div className="flex w-[114px] min-w-[114px] items-center px-2.5">
          <p className="truncate">
            {entity?.createdAt ? (
              <DateRenderer dateValue={entity.createdAt} />
            ) : (
              t(MarketplaceI18nKeys.UnknownMarketplace)
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
