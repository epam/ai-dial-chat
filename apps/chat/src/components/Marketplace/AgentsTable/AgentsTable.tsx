import {
  ReactNode,
  forwardRef,
  memo,
  useCallback,
  useRef,
  useState,
} from 'react';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useSyncXScroll } from '@/src/hooks/useSyncXScroll';
import { useTranslation } from '@/src/hooks/useTranslation';

import { ScreenState } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { AgentsTableLeftSideRow } from './AgentsTableLeftSideRow';
import { AgentsTableRightSideRow } from './AgentsTableRightSideRow';
import { HeaderItem } from './HeaderItem';

import { PublishActions } from '@epam/ai-dial-shared';

const headerItems = [
  { label: 'Version', size: 100 },
  { label: 'Topics', size: 161 },
  { label: 'Owner', size: 130 },
  { label: 'Released', size: 86 },
];

const LeftRowContainer: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <div className="min-w-[195px] flex-1 divide-y divide-secondary md:min-w-[316px] xl:min-w-[245px]">
      {children}
    </div>
  );
};

const RightRowContainer = forwardRef<HTMLDivElement, { children: ReactNode }>(
  ({ children }, ref) => {
    return (
      <div ref={ref} className="overflow-x-auto">
        <div className="inline-flex flex-col divide-y divide-secondary">
          {children}
        </div>
      </div>
    );
  },
);
RightRowContainer.displayName = 'RightRowContainer';

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

    const rightColumnHeaderRef = useRef<HTMLDivElement>(null);
    const rightColumnDataRef = useRef<HTMLDivElement>(null);

    useSyncXScroll(rightColumnHeaderRef, rightColumnDataRef);

    const [hoveredRowId, setHoveredRowId] = useState('');

    const handleRowHover = useCallback((hoveredRowId: string) => {
      setHoveredRowId(hoveredRowId);
    }, []);

    const handleRowHoverOver = useCallback(() => {
      setHoveredRowId('');
    }, []);

    return (
      <>
        <div className="flex min-w-full items-center">
          <LeftRowContainer>
            <p className="pb-3 pl-4 pr-3 pt-5 font-semibold md:gap-5 md:pl-4">
              {t(
                screenState === ScreenState.MOBILE
                  ? 'Name'
                  : 'Name and Description',
              )}
            </p>
          </LeftRowContainer>
          <RightRowContainer ref={rightColumnHeaderRef}>
            <div className="flex shrink-0 grow gap-3 pb-3 pl-4 pr-3 pt-5 md:gap-5 md:px-4">
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
          </RightRowContainer>
        </div>
        <div data-qa={dataQA} className="flex min-w-full">
          <LeftRowContainer>
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
          </LeftRowContainer>
          <RightRowContainer ref={rightColumnDataRef}>
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
          </RightRowContainer>
        </div>
      </>
    );
  },
);
AgentsTable.displayName = 'AgentsTable';
