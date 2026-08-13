import { useVirtualizer } from '@tanstack/react-virtual';
import React, {
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

import { compareLocalizedNames } from '@/src/utils/app/marketplace-localization';

import { ScreenState } from '@/src/types/common';
import { MarketplaceEntity } from '@/src/types/marketplace';
import { DialAIEntityModel } from '@/src/types/models';
import { ToolsetModel } from '@/src/types/toolsets';

import { useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors, UISelectors } from '@/src/store/selectors';

import {
  ALL_APPS_HEADER_SENTINEL,
  FEATURED_HEADER_SENTINEL,
  MarketplaceEntitiesTabs,
  SUGGESTED_HEADER_SENTINEL,
  TableColumnSortKeys,
} from '@/src/constants/marketplace';

import { MarketplaceEntitiesListWrapper } from '@/src/components/Marketplace/MarketplaceEntitiesList/MarketplaceEntitiesListWrapper';
import { MarketplaceEntitiesTableHeader } from '@/src/components/Marketplace/MarketplaceEntitiesList/MarketplaceEntitiesTable/MarketplaceEntitiesTableHeader';
import { SuggestedMessage } from '@/src/components/Marketplace/MarketplaceEntitiesList/SuggestedMessage';
import {
  MarketplaceEntitiesListProps,
  MarketplaceEntitiesListWrapperRef,
} from '@/src/components/Marketplace/MarketplaceEntitiesList/view-props';

import { VirtualRowsRenderer } from './VirtualRowsRenderer';

import isString from 'lodash-es/isString';
import orderBy from 'lodash-es/orderBy';

const ROW_SIZES = {
  [ScreenState.SM]: 55,
  [ScreenState.MD]: 114,
  [ScreenState.XL]: 114,
  [ScreenState.XL3]: 114,
  [ScreenState.XL4]: 114,
  [ScreenState.XL5]: 114,
};

const SECTION_HEADER_ROW_SIZE: Record<ScreenState, number> = {
  [ScreenState.SM]: 52,
  [ScreenState.MD]: 56,
  [ScreenState.XL]: 64,
  [ScreenState.XL3]: 64,
  [ScreenState.XL4]: 64,
  [ScreenState.XL5]: 64,
};

const FEATURED_HEADER_ROW_SIZE = 48;

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

interface DataRowContainerProps {
  children: ReactNode;
  width: number;
  height: number;
  className?: string;
}

const DataRowContainer = forwardRef<HTMLDivElement, DataRowContainerProps>(
  ({ children, width, height, className }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          height: `${height}px`,
          width: `${width}px`,
        }}
        className={classNames(
          'no-scrollbar relative flex w-full shrink divide-y divide-secondary overflow-x-auto overflow-y-hidden',
          className,
        )}
      >
        {children}
      </div>
    );
  },
);
DataRowContainer.displayName = 'DataRowContainer';

export const MarketplaceEntitiesTable: React.FC<
  MarketplaceEntitiesListProps<MarketplaceEntity>
> = ({
  entities,
  suggestedResults,
  featuredEntities,
  onCardClick,
  onBookmarkClick,
}) => {
  const wrapperRefs = useRef<MarketplaceEntitiesListWrapperRef>(null);
  const headerRefs = useRef<{
    leftColumnHeaderRef: React.RefObject<HTMLDivElement>;
    rightColumnHeaderRef: React.RefObject<HTMLDivElement>;
  }>(null);
  const leftColumnDataRef = useRef<HTMLDivElement>(null);
  const rightColumnDataRef = useRef<HTMLDivElement>(null);

  const currentParentRef = wrapperRefs.current?.parentRef.current ?? null;

  const tableSort = useAppSelector(MarketplaceSelectors.selectTableSort);
  const locale = useAppSelector(UISelectors.selectLocale);

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
      if (sortField === 'name') {
        return [...items].sort((a, b) => {
          const result = compareLocalizedNames(locale, a.name, b.name);
          return tableSort.order === 'desc' ? -result : result;
        });
      }

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

    const sortField = (
      isAgentsTab ? agentsSortField : toolsetsSortField
    ) as keyof MarketplaceEntity;
    const sortedEntities = sortEntities(entities, sortField);
    const sortedSuggestedEntities = sortEntities(suggestedResults, sortField);

    const result: (MarketplaceEntity | string)[] = [];

    if (featuredEntities.length) {
      const sortedFeaturedEntities = sortEntities(featuredEntities, sortField);
      result.push(FEATURED_HEADER_SENTINEL, ...sortedFeaturedEntities);
    }

    if (
      featuredEntities.length &&
      (entities.length || suggestedResults.length)
    ) {
      result.push(ALL_APPS_HEADER_SENTINEL);
    }

    if (!suggestedResults.length) {
      result.push(...sortedEntities);
    } else if (!entities.length) {
      result.push(...sortedSuggestedEntities);
    } else {
      result.push(
        ...sortedEntities,
        SUGGESTED_HEADER_SENTINEL,
        ...sortedSuggestedEntities,
      );
    }

    return result;
  }, [
    entities,
    featuredEntities,
    isAgentsTab,
    locale,
    suggestedResults,
    tableSort.column,
    tableSort.order,
  ]);

  const allEntitiesRef = useRef(allEntities);
  allEntitiesRef.current = allEntities;

  const rowVirtualizer = useVirtualizer({
    count: allEntities.length,
    getScrollElement: () => currentParentRef,
    estimateSize: (index) => {
      const entity = allEntitiesRef.current[index];

      if (entity === FEATURED_HEADER_SENTINEL) {
        return FEATURED_HEADER_ROW_SIZE;
      }

      if (
        entity === ALL_APPS_HEADER_SENTINEL ||
        entity === SUGGESTED_HEADER_SENTINEL
      ) {
        return SECTION_HEADER_ROW_SIZE[screenState];
      }

      return ROW_SIZES[screenState];
    },
    getItemKey: (index) => {
      const entity = allEntitiesRef.current[index];
      if (!entity) return `_${index}`;
      if (isString(entity)) return entity;
      return entity.id;
    },
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
  const sentinelWidth = leftColumnWidth + rightColumnWidth;
  const virtualRowsProps = useMemo(
    () => ({
      virtualRows,
      allEntities,
      suggestedResults,
      measureElement: rowVirtualizer.measureElement,
      sentinelWidth,
      rowProps: {
        hoveredRowId,
        onClick: onCardClick,
        onBookmarkClick,
        onRowHover: handleRowHover,
        onRowHoverOver: handleRowHoverOver,
      },
    }),
    [
      virtualRows,
      allEntities,
      suggestedResults,
      rowVirtualizer.measureElement,
      sentinelWidth,
      hoveredRowId,
      onCardClick,
      onBookmarkClick,
      handleRowHover,
      handleRowHoverOver,
    ],
  );

  return (
    <>
      <SuggestedMessage shouldRender={!entities.length} className="md:ms-3" />
      <MarketplaceEntitiesTableHeader ref={headerRefs} />
      <MarketplaceEntitiesListWrapper
        ref={wrapperRefs}
        className={screenState === ScreenState.SM ? '!px-0' : ''}
      >
        <DataRowContainer
          ref={leftColumnDataRef}
          width={leftColumnWidth}
          height={listHeight}
          className="!overflow-visible"
        >
          <VirtualRowsRenderer {...virtualRowsProps} isLeftSide />
        </DataRowContainer>
        <DataRowContainer
          ref={rightColumnDataRef}
          width={rightColumnWidth}
          height={listHeight}
        >
          <VirtualRowsRenderer {...virtualRowsProps} />
        </DataRowContainer>
      </MarketplaceEntitiesListWrapper>
    </>
  );
};
