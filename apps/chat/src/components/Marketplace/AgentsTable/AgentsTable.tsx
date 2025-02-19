import { memo, useCallback, useState } from 'react';

import { useScreenState } from '@/src/hooks/useScreenState';

import { ScreenState } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';

import { AgentsTableLeftSideRow } from './AgentsTableLeftSideRow';
import { AgentsTableRightSideRow } from './AgentsTableRightSideRow';
import { HeaderItem } from './HeaderItem';

import { PublishActions } from '@epam/ai-dial-shared';

interface AgentsTableProps {
  entities: DialAIEntityModel[];
  onCardClick: (entity: DialAIEntityModel) => void;
  onPublish?: (entity: DialAIEntityModel, action: PublishActions) => void;
  onDelete?: (entity: DialAIEntityModel) => void;
  onEdit?: (entity: DialAIEntityModel) => void;
  onBookmarkClick?: (entity: DialAIEntityModel) => void;
  onSelectVersion?: (entity: DialAIEntityModel) => void;
  onLogsClick?: (entity: DialAIEntityModel) => void;
  dataQA?: string;
}

const headerItems = [
  { label: 'Version', size: 100 },
  { label: 'Topics', size: 161 },
  { label: 'Owner', size: 130 },
  { label: 'Released', size: 86 },
];

export const AgentsTable: React.FC<AgentsTableProps> = memo(
  ({
    entities,
    onCardClick,
    onPublish,
    onDelete,
    onEdit,
    onBookmarkClick,
    onLogsClick,
    dataQA,
  }) => {
    const screenState = useScreenState();

    const [hoveredRowId, setHoveredRowId] = useState('');

    const handleRowHover = useCallback((hoveredRowId: string) => {
      setHoveredRowId(hoveredRowId);
    }, []);

    const handleRowHoverOver = useCallback(() => {
      setHoveredRowId('');
    }, []);

    return (
      <div data-qa={dataQA} className="flex max-w-full">
        <div className="min-w-[195px] flex-1 divide-y divide-secondary md:min-w-[316px] xl:min-w-[245px]">
          <div className="group flex items-center gap-2 pb-3 pl-3 pr-1 pt-5 font-semibold md:pl-4">
            <HeaderItem
              label={
                screenState === ScreenState.MOBILE
                  ? 'Name'
                  : 'Name and Description'
              }
              size={
                screenState === ScreenState.MOBILE
                  ? 195
                  : screenState === ScreenState.TABLET
                    ? 316
                    : 245
              }
            />
          </div>
          {entities.map((entity) => (
            <AgentsTableLeftSideRow
              key={entity.id}
              entity={entity}
              isHovered={entity.id === hoveredRowId}
              onClick={onCardClick}
              onBookmarkClick={onBookmarkClick}
              onRowHover={handleRowHover}
              onRowHoverOver={handleRowHoverOver}
            />
          ))}
        </div>
        <div className="overflow-auto">
          <div className="inline-flex flex-col divide-y divide-secondary">
            <div className="ms:px-4 flex shrink-0 grow gap-3 pb-3 pl-4 pr-3 pt-5 md:gap-5">
              {headerItems.map((item) => (
                <HeaderItem {...item} key={item.label} />
              ))}
              <div className="hidden flex-none xl:block">
                <div className="invisible flex gap-1">
                  <div className="size-[18px]"></div>
                  <div className="size-[18px]"></div>
                </div>
              </div>
            </div>
            {entities.map((entity) => (
              <AgentsTableRightSideRow
                key={entity.id}
                entity={entity}
                isHovered={entity.id === hoveredRowId}
                onPublish={onPublish}
                onDelete={onDelete}
                onClick={onCardClick}
                onEdit={onEdit}
                onBookmarkClick={onBookmarkClick}
                onRowHover={handleRowHover}
                onRowHoverOver={handleRowHoverOver}
                onLogsClick={onLogsClick}
              />
            ))}
          </div>
        </div>
      </div>
    );
  },
);

AgentsTable.displayName = 'AgentsTable';
