import { memo, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { useApplicationMenuActions } from '@/src/hooks/useApplicationActions';
import { useScreenState } from '@/src/hooks/useScreenState';

import { FeatureType, ScreenState } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import ContextMenu from '@/src/components/Common/ContextMenu';
import { DateRenderer } from '@/src/components/Common/DateRenderer';
import Tooltip from '@/src/components/Common/Tooltip';

import { AgentBookmark } from '../../AgentBookmark';
import { ApplicationTopic } from '../../ApplicationTopic';
import { TopicsList } from '../../TopicsList';

interface Props {
  entity: DialAIEntityModel;
  isHovered: boolean;
  onClick: (entity: DialAIEntityModel) => void;
  onRowHoverOver: () => void;
  onRowHover: (id: string) => void;
  onBookmarkClick?: (entity: DialAIEntityModel) => void;
}

export const AgentsTableRightSideRow: React.FC<Props> = memo(
  ({
    entity,
    isHovered,
    onClick,
    onRowHover,
    onRowHoverOver,
    onBookmarkClick,
  }) => {
    const { t } = useTranslation(Translation.Marketplace);

    const screenState = useScreenState();

    const { menuItems } = useApplicationMenuActions({ entity });

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
        <div className="flex w-[100px] min-w-[100px] items-center">
          <p className="truncate">{entity.version}</p>
        </div>
        <div className="flex w-[161px] min-w-[161px] flex-col justify-center gap-2 overflow-hidden">
          {screenState === ScreenState.SM ? (
            <TopicsList topics={entity.topics ?? []} />
          ) : (
            <>
              {visibleTopics.map((topic) => (
                <ApplicationTopic key={topic} topic={topic} />
              ))}
              {!!hiddenTopics.length && (
                <Tooltip
                  triggerClassName="flex"
                  tooltip={
                    <div className="my-1 flex max-w-48 flex-wrap gap-2">
                      {hiddenTopics.map((topic) => (
                        <ApplicationTopic key={topic} topic={topic} />
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
          <p className="truncate">{entity.owner ?? t('Unknown')}</p>
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
            <AgentBookmark onBookmarkClick={onBookmarkClick} entity={entity} />
            <ContextMenu
              menuItems={menuItems}
              featureType={FeatureType.Application}
              triggerIconHighlight
              triggerIconSize={18}
              className={classNames(
                'm-0',
                isHovered ? 'xl:visible' : 'xl:invisible',
              )}
            />
          </div>
        </div>
      </li>
    );
  },
);

AgentsTableRightSideRow.displayName = 'AgentsTableRightSideRow';
