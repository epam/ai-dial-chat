import { memo } from 'react';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';

import { getModelShortDescription } from '@/src/utils/app/application';

import { FeatureType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';

import { TableIconSizes } from '@/src/constants/marketplace';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';
import ShareIcon from '@/src/components/Common/ShareIcon';

import { AgentBookmark } from '../AgentBookmark';
import { FunctionStatusIndicator } from '../FunctionStatusIndicator';

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
    onRowHoverOver,
    onRowHover,
    onBookmarkClick,
  }) => {
    const screenState = useScreenState();

    const { iconSize, shareIconSize } = TableIconSizes[screenState];

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
            <AgentBookmark entity={entity} onBookmarkClick={onBookmarkClick} />
            <ShareIcon
              {...entity}
              isHighlighted={false}
              size={shareIconSize}
              featureType={FeatureType.Application}
              iconClassName={classNames(
                '!rounded-[4px] !stroke-[0.6]',
                isHovered ? 'bg-layer-2 ' : 'bg-layer-1',
              )}
              iconWrapperClassName="!rounded-[4px]"
            >
              <ModelIcon entityId={entity.id} entity={entity} size={iconSize} />
            </ShareIcon>
          </div>
          <div>
            <div className="flex">
              <div className="line-clamp-1 max-w-screen-sm text-base font-semibold leading-5">
                {entity.name}
              </div>
              <FunctionStatusIndicator entity={entity} />
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
