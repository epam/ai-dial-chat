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
import { useScreenState } from '@/src/hooks/useScreenState';
import { useSyncXScroll } from '@/src/hooks/useSyncXScroll';

import { ScreenState } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/marketplace/marketplace.selectors';

import { TableColumnSortKeys } from '@/src/constants/marketplace';

import { AgentsListWrapper } from '../AgentsListWrapper';
import { SuggestedMessage } from '../SuggestedMessage';
import { AgentsListProps } from '../view-props';
import { AgentsTableHeader } from './AgentsTableHeader';
import { AgentsTableLeftSideRow } from './AgentsTableLeftSideRow';
import { AgentsTableRightSideRow } from './AgentsTableRightSideRow';

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
  suggestedResults: DialAIEntityModel[];
  entity: DialAIEntityModel | string;
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
const SORT_KEY_MAP: Record<TableColumnSortKeys, keyof DialAIEntityModel> = {
  [TableColumnSortKeys.RELEASED]: 'createdAt',
  [TableColumnSortKeys.NAME]: 'name',
  [TableColumnSortKeys.OWNER]: 'owner',
};

export const AgentsTable: React.FC<AgentsListProps> = ({
  entities,
  suggestedResults,
  separator,
  onCardClick,
  onBookmarkClick,
}) => {
  const dispatch = useAppDispatch();

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

  const [hoveredRowId, setHoveredRowId] = useState('');
  const [leftColumnWidth, setLeftColumnWidth] = useState(0);
  const [rightColumnWidth, setRightColumnWidth] = useState(0);

  const screenState = useScreenState();
  useSyncXScroll(
    headerRefs.current ? headerRefs.current.rightColumnHeaderRef : null,
    rightColumnDataRef,
  );

  const allEntities = useMemo(() => {
    const sortField =
      SORT_KEY_MAP[tableSort.column] || SORT_KEY_MAP[TableColumnSortKeys.NAME];

    const sortEntities = (items: DialAIEntityModel[]) => {
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
    const sortedEntities = sortEntities(entities);
    const sortedSuggestedEntities = sortEntities(suggestedResults);

    if (!suggestedResults.length) return sortedEntities;
    if (!entities.length && suggestedResults.length)
      return sortedSuggestedEntities;

    return [...sortedEntities, separator, ...sortedSuggestedEntities];
  }, [
    entities,
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

  useEffect(() => {
    const headerCurrentRefs = headerRefs.current ? headerRefs.current : null;
    let leftObserver: ResizeObserver | undefined,
      rightObserver: ResizeObserver | undefined;

    if (headerCurrentRefs) {
      const { leftColumnHeaderRef, rightColumnHeaderRef } = headerCurrentRefs;
      const leftObserver = new ResizeObserver(() => {
        setLeftColumnWidth(leftColumnHeaderRef.current?.offsetWidth ?? 0);
      });

      if (leftColumnHeaderRef.current) {
        leftObserver.observe(leftColumnHeaderRef.current);
      }

      const rightObserver = new ResizeObserver(() => {
        setRightColumnWidth(rightColumnHeaderRef.current?.offsetWidth ?? 0);
      });

      if (rightColumnHeaderRef.current) {
        rightObserver.observe(rightColumnHeaderRef.current);
      }
    }

    return () => {
      leftObserver?.disconnect();
      rightObserver?.disconnect();
    };
  }, [dispatch]);

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
      <SuggestedMessage entities={entities} />
      <AgentsTableHeader ref={headerRefs} />
      <AgentsListWrapper
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
                  <AgentsTableLeftSideRow
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
                  <AgentsTableRightSideRow
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
      </AgentsListWrapper>
    </>
  );
};
