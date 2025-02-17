import { IconArrowNarrowDown } from '@tabler/icons-react';
import { memo, useCallback, useState } from 'react';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { ScreenState } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { AgentsTableLeftSideRow } from './AgentsTableLeftSideRow';
import { AgentsTableRightSideRow } from './AgentsTableRightSideRow';

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
    const { t } = useTranslation(Translation.Marketplace);

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
          <div className="group flex cursor-pointer items-center gap-2 pb-3 pl-3 pr-1 pt-5 font-semibold md:pl-4">
            {t(
              screenState === ScreenState.MOBILE
                ? 'Name'
                : 'Name and Description',
            )}
            <IconArrowNarrowDown
              className="invisible text-secondary group-hover:visible"
              size={16}
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
              <div className="group flex w-[100px] min-w-[100px] cursor-pointer items-center gap-2 font-semibold">
                {t('Version')}
                <IconArrowNarrowDown
                  className="invisible text-secondary group-hover:visible"
                  size={16}
                />
              </div>
              <div className="group flex w-[161px] min-w-[161px] cursor-pointer items-center gap-2 font-semibold">
                {t('Topics')}
                <IconArrowNarrowDown
                  className="invisible text-secondary group-hover:visible"
                  size={16}
                />
              </div>
              <div className="group flex w-[130px] min-w-[130px] cursor-pointer items-center gap-2 font-semibold">
                {t('Owner')}
                <IconArrowNarrowDown
                  className="invisible text-secondary group-hover:visible"
                  size={16}
                />
              </div>
              <div className="group flex w-[86px] min-w-[86px] cursor-pointer items-center gap-2 font-semibold">
                {t('Released')}
                <IconArrowNarrowDown
                  className="invisible text-secondary group-hover:visible"
                  size={16}
                />
              </div>
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
