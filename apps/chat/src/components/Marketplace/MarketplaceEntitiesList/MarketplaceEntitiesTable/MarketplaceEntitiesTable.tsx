import { VirtualItem, useVirtualizer } from '@tanstack/react-virtual';
import {
  ReactNode,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import classNames from 'classnames';

import { useMarketplaceBannerVisibility } from '@/src/hooks/useMarketplaceBannerVisibility';
import { useResizeObserver } from '@/src/hooks/useResizeObserver';
import { useScreenState } from '@/src/hooks/useScreenState';
import { useSyncXScroll } from '@/src/hooks/useSyncXScroll';

import { ScreenState } from '@/src/types/common';
import { MarketplaceEntity } from '@/src/types/marketplace';
import { DialAIEntityModel } from '@/src/types/models';
import { ToolsetModel } from '@/src/types/toolsets';

import { useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/selectors';

import {
  MarketplaceEntitiesTabs,
  TableColumnSortKeys,
} from '@/src/constants/marketplace';

import { MarketplaceEntitiesListWrapper } from '@/src/components/Marketplace/MarketplaceEntitiesList/MarketplaceEntitiesListWrapper';
import { MarketplaceEntitiesTableHeader } from '@/src/components/Marketplace/MarketplaceEntitiesList/MarketplaceEntitiesTable/MarketplaceEntitiesTableHeader';
import { SuggestedMessage } from '@/src/components/Marketplace/MarketplaceEntitiesList/SuggestedMessage';
import { MarketplaceEntitiesListProps } from '@/src/components/Marketplace/MarketplaceEntitiesList/view-props';

import { MarketplaceEntitiesTableLeftSideRow } from './MarketplaceEntitiesTableLeftSideRow';
import { MarketplaceEntitiesTableRightSideRow } from './MarketplaceEntitiesTableRightSideRow';

import isString from 'lodash-es/isString';
import orderBy from 'lodash-es/orderBy';

interface DataRowContainerProps {
  children: ReactNode;
  width: number;
  height: number;
}

const DataRowContainer = forwardRef<HTMLDivElement, DataRowContainerProps>(
  ({ children, width, height }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          height: `${height}px`,
          width: `${width}px`,
        }}
        className="no-scrollbar relative flex w-full shrink divide-y divide-secondary overflow-x-auto overflow-y-hidden"
      >
        {children}
      </div>
    );
  },
);
DataRowContainer.displayName = 'DataRowContainer';

interface DataRowItemProps {
  suggestedResults: MarketplaceEntity[];
  entity: MarketplaceEntity | string;
  virtualRow: VirtualItem;
  children: ReactNode;
}

const DataRowItem: React.FC<DataRowItemProps> = ({
  entity,
  suggestedResults,
  virtualRow,
  children,
}) => {
  return (
    <div
      className={classNames(
        suggestedResults.length &&
          !isString(entity) &&
          entity.id === suggestedResults[0].id &&
          '!border-t-0',
        isString(entity) && 'flex items-center !border-t-0',
        'absolute left-0 top-0 min-w-full',
      )}
      style={{
        height: `${virtualRow.size}px`,
        transform: `translateY(${virtualRow.start}px)`,
      }}
    >
      {children}
    </div>
  );
};

const ROW_SIZES = {
  [ScreenState.SM]: 55,
  [ScreenState.MD]: 115,
  [ScreenState.XL]: 115,
  [ScreenState.XL3]: 115,
  [ScreenState.XL4]: 115,
  [ScreenState.XL5]: 115,
};

const SORT_KEY_MAP = {
  [TableColumnSortKeys.RELEASED]: 'createdAt',
  [TableColumnSortKeys.NAME]: 'name',
};

type AgentsSortKeyMap = Record<TableColumnSortKeys, keyof DialAIEntityModel>;
const AGENTS_SORT_KEY_MAP: AgentsSortKeyMap = {
  ...(SORT_KEY_MAP as AgentsSortKeyMap),
  [TableColumnSortKeys.OWNER]: 'owner',
};

type ToolsetsSortKeyMap = Record<TableColumnSortKeys, keyof ToolsetModel>;
const TOOLSETS_SORT_KEY_MAP: ToolsetsSortKeyMap = {
  ...(SORT_KEY_MAP as ToolsetsSortKeyMap),
  [TableColumnSortKeys.OWNER]: 'author',
};

export const MarketplaceEntitiesTable: React.FC<
  MarketplaceEntitiesListProps<MarketplaceEntity>
> = ({
  entities,
  suggestedResults,
  separator,
  onCardClick,
  onBookmarkClick,
}) => {
  const wrapperRefs = useRef<{
    parentRef: React.RefObject<HTMLDivElement>;
    suggestedRowRef: React.RefObject<HTMLSpanElement>;
  }>(null);
  const headerRefs = useRef<{
    leftColumnHeaderRef: React.RefObject<HTMLDivElement>;
    rightColumnHeaderRef: React.RefObject<HTMLDivElement>;
  }>(null);
  const leftColumnDataRef = useRef<HTMLDivElement>(null);
  const rightColumnDataRef = useRef<HTMLDivElement>(null);

  const currentParentRef = wrapperRefs.current?.parentRef.current ?? null;
  const suggestedRowRef = wrapperRefs.current?.suggestedRowRef;

  const tableSort = useAppSelector(MarketplaceSelectors.selectTableSort);

  const selectedEntitiesTab = useAppSelector(
    MarketplaceSelectors.selectSelectedEntitiesTab,
  );

  const isAgentsTab = selectedEntitiesTab === MarketplaceEntitiesTabs.AGENTS;

  const [hoveredRowId, setHoveredRowId] = useState('');
  const [leftColumnWidth, setLeftColumnWidth] = useState(0);
  const [rightColumnWidth, setRightColumnWidth] = useState(0);

  const screenState = useScreenState();
  useSyncXScroll(
    headerRefs.current ? headerRefs.current.rightColumnHeaderRef : null,
    rightColumnDataRef,
  );

  const allEntities = useMemo(() => {
    const agentsSortField =
      AGENTS_SORT_KEY_MAP[tableSort.column] ||
      SORT_KEY_MAP[TableColumnSortKeys.NAME];

    const toolsetsSortField =
      TOOLSETS_SORT_KEY_MAP[tableSort.column] ||
      SORT_KEY_MAP[TableColumnSortKeys.NAME];

    const sortEntities = <T extends MarketplaceEntity>(
      items: T[],
      sortField: keyof T,
    ) => {
      return orderBy(
        items,
        [
          (item) => {
            const value = item[sortField];
            return isString(value) ? value.toLowerCase() : value;
          },
        ],
        [tableSort.order],
      );
    };
    const sortedEntities = isAgentsTab
      ? sortEntities<DialAIEntityModel>(
          entities as DialAIEntityModel[],
          agentsSortField,
        )
      : sortEntities<ToolsetModel>(
          entities as ToolsetModel[],
          toolsetsSortField,
        );
    const sortedSuggestedEntities = isAgentsTab
      ? sortEntities<DialAIEntityModel>(
          suggestedResults as DialAIEntityModel[],
          agentsSortField,
        )
      : sortEntities<ToolsetModel>(
          suggestedResults as ToolsetModel[],
          toolsetsSortField,
        );

    if (!suggestedResults.length) return sortedEntities;
    if (!entities.length && suggestedResults.length)
      return sortedSuggestedEntities;

    return [...sortedEntities, separator, ...sortedSuggestedEntities];
  }, [
    entities,
    isAgentsTab,
    separator,
    suggestedResults,
    tableSort.column,
    tableSort.order,
  ]);

  const rowVirtualizer = useVirtualizer({
    count: allEntities.length,
    getScrollElement: () => currentParentRef,
    estimateSize: () => ROW_SIZES[screenState],
    overscan: screenState === ScreenState.SM ? 9 : 3,
  });

  useMarketplaceBannerVisibility(currentParentRef);

  const { leftColumnHeaderRef, rightColumnHeaderRef } =
    headerRefs.current ?? {};
  const handleLeftResize = useCallback(() => {
    setLeftColumnWidth(leftColumnHeaderRef?.current?.offsetWidth ?? 0);
  }, [leftColumnHeaderRef]);
  const handleRightResize = useCallback(() => {
    setRightColumnWidth(rightColumnHeaderRef?.current?.offsetWidth ?? 0);
  }, [rightColumnHeaderRef]);

  useResizeObserver(leftColumnHeaderRef?.current ?? null, handleLeftResize);
  useResizeObserver(rightColumnHeaderRef?.current ?? null, handleRightResize);

  useEffect(() => {
    rowVirtualizer.measure();
  }, [screenState, rowVirtualizer]);

  const handleRowHover = useCallback((hoveredRowId: string) => {
    setHoveredRowId(hoveredRowId);
  }, []);

  const handleRowHoverOver = useCallback(() => {
    setHoveredRowId('');
  }, []);

  const virtualRows = rowVirtualizer.getVirtualItems();
  const listHeight = rowVirtualizer.getTotalSize();
  const separatorRowId = allEntities.findIndex(isString);

  return (
    <>
      <SuggestedMessage shouldRender={!entities.length} className="md:ml-3" />
      <MarketplaceEntitiesTableHeader ref={headerRefs} />
      <MarketplaceEntitiesListWrapper
        separatorRowId={separatorRowId}
        rowsHeight={ROW_SIZES[screenState]}
        ref={wrapperRefs}
        className={screenState === ScreenState.SM ? '!px-0' : ''}
      >
        <DataRowContainer
          ref={leftColumnDataRef}
          width={leftColumnWidth}
          height={listHeight}
        >
          {virtualRows.map((virtualRow) => {
            const entity = allEntities[virtualRow.index];

            return (
              <DataRowItem
                key={virtualRow.key}
                suggestedResults={suggestedResults}
                entity={entity}
                virtualRow={virtualRow}
              >
                {isString(entity) ? (
                  <span ref={suggestedRowRef}></span>
                ) : (
                  <MarketplaceEntitiesTableLeftSideRow
                    entity={entity}
                    isHovered={entity.id === hoveredRowId}
                    onClick={onCardClick}
                    onBookmarkClick={onBookmarkClick}
                    onRowHover={handleRowHover}
                    onRowHoverOver={handleRowHoverOver}
                  />
                )}
              </DataRowItem>
            );
          })}
        </DataRowContainer>
        <DataRowContainer
          ref={rightColumnDataRef}
          width={rightColumnWidth}
          height={listHeight}
        >
          {virtualRows.map((virtualRow) => {
            const entity = allEntities[virtualRow.index];

            return (
              <DataRowItem
                key={virtualRow.key}
                suggestedResults={suggestedResults}
                entity={entity}
                virtualRow={virtualRow}
              >
                {isString(entity) ? (
                  <span></span>
                ) : (
                  <MarketplaceEntitiesTableRightSideRow
                    entity={entity}
                    isHovered={entity.id === hoveredRowId}
                    onClick={onCardClick}
                    onBookmarkClick={onBookmarkClick}
                    onRowHover={handleRowHover}
                    onRowHoverOver={handleRowHoverOver}
                  />
                )}
              </DataRowItem>
            );
          })}
        </DataRowContainer>
      </MarketplaceEntitiesListWrapper>
    </>
  );
};
