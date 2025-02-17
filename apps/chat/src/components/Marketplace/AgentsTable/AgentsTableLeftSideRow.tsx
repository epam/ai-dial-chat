import { IconBookmark, IconBookmarkFilled } from '@tabler/icons-react';
import { memo } from 'react';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';

import { getModelShortDescription } from '@/src/utils/app/application';

import { ScreenState } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { ModelIcon } from '../../Chatbar/ModelIcon';
import { EntityMarkdownDescription } from '../../Common/MarkdownDescription';

interface Props {
  entity: DialAIEntityModel;
  isHovered: boolean;
  onClick: (entity: DialAIEntityModel) => void;
  onRowHoverOver: () => void;
  onRowHover: (id: string) => void;
  onBookmarkClick?: (entity: DialAIEntityModel) => void;
}

export const AgentsTableLeftSideRow: React.FC<Props> = memo(
  ({
    entity,
    isHovered,
    onClick,
    onRowHover,
    onRowHoverOver,
    onBookmarkClick,
  }) => {
    const screenState = useScreenState();

    const installedModelIds = useAppSelector(
      ModelsSelectors.selectInstalledModelIds,
    );

    const Bookmark = installedModelIds.has(entity.reference)
      ? IconBookmarkFilled
      : IconBookmark;

    return (
      <li
        onClick={() => onClick(entity)}
        onMouseEnter={() => onRowHover(entity.id)}
        onMouseLeave={() => onRowHoverOver()}
        className={classNames(
          'flex h-[55px] cursor-pointer py-3 pl-3 pr-1 md:h-[115px] md:py-4 md:pl-4',
          isHovered && 'bg-layer-2',
        )}
      >
        <div className="flex h-full items-center gap-3 md:gap-4">
          <div className="flex items-center gap-2 md:gap-4">
            <Bookmark
              onClick={(e) => {
                e.stopPropagation();
                onBookmarkClick?.(entity);
              }}
              className="block shrink-0 rounded text-secondary hover:text-accent-primary xl:hidden"
              size={18}
            />
            <ModelIcon
              entityId={entity.id}
              entity={entity}
              size={screenState === ScreenState.MOBILE ? 30 : 60}
            />
          </div>
          <div>
            <div className="line-clamp-1 max-w-screen-sm text-base font-semibold leading-5">
              {entity.name}
            </div>
            <EntityMarkdownDescription className="mt-2 hidden max-w-screen-sm truncate whitespace-normal break-all !text-sm font-light !leading-[18px] text-secondary md:line-clamp-3">
              {getModelShortDescription(entity)}
            </EntityMarkdownDescription>
          </div>
        </div>
      </li>
    );
  },
);

AgentsTableLeftSideRow.displayName = 'AgentsTableLeftSideRow';
