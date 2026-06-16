import { useVirtualizer } from '@tanstack/react-virtual';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useMarketplaceBannerVisibility } from '@/src/hooks/useMarketplaceBannerVisibility';
import { useResizeObserver } from '@/src/hooks/useResizeObserver';
import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { ScreenState } from '@/src/types/common';
import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import {
  ALL_APPS_HEADER_SENTINEL,
  FEATURED_HEADER_SENTINEL,
  SENTINEL_DATA,
  SUGGESTED_HEADER_SENTINEL,
} from '@/src/constants/marketplace';

import { MarketplaceEntitiesListWrapper } from '../MarketplaceEntitiesListWrapper';
import { SentinelRow } from '../SentinelRow';
import { SuggestedMessage } from '../SuggestedMessage';
import {
  MarketplaceEntitiesListProps,
  MarketplaceEntitiesListWrapperRef,
} from '../view-props';
import { MarketplaceEntityCard } from './MarketplaceEntityCard';

import isString from 'lodash-es/isString';
import range from 'lodash-es/range';

const MIN_CARD_WIDTH = 341;
const MIN_CARD_WIDTH_XL5 = 450;
const DEFAULT_GAP = 20;
const DEFAULT_HEIGHT = 184;

interface RowInfo {
  height: number;
  gap?: number;
  minWidth?: number;
}

const ROWS_INFO: Record<ScreenState, RowInfo> = {
  [ScreenState.SM]: { height: 110, gap: 12 },
  [ScreenState.MD]: { height: 178, gap: 16 },
  [ScreenState.XL]: { height: DEFAULT_HEIGHT },
  [ScreenState.XL3]: { height: DEFAULT_HEIGHT },
  [ScreenState.XL4]: { height: DEFAULT_HEIGHT },
  [ScreenState.XL5]: { height: DEFAULT_HEIGHT, minWidth: MIN_CARD_WIDTH_XL5 },
};

const SECTION_HEADER_HEIGHT: Record<ScreenState, number> = {
  [ScreenState.SM]: 40,
  [ScreenState.MD]: 44,
  [ScreenState.XL]: 52,
  [ScreenState.XL3]: 52,
  [ScreenState.XL4]: 52,
  [ScreenState.XL5]: 52,
};

const FEATURED_HEADER_HEIGHT = 40;

export const MarketplaceEntitiesTiles: React.FC<
  MarketplaceEntitiesListProps<MarketplaceEntity>
> = ({
  entities,
  suggestedResults,
  featuredEntities,
  onCardClick,
  onBookmarkClick,
}) => {
  const { t } = useTranslation(Translation.Marketplace);

  const wrapperRefs = useRef<MarketplaceEntitiesListWrapperRef>(null);
  const dataRef = useRef<HTMLDivElement>(null);

  const currentParentRef = wrapperRefs.current?.parentRef.current ?? null;
  const [colsCount, setColumnCount] = useState(1);

  const screenState = useScreenState();

  const {
    height: rowsHeight,
    gap = DEFAULT_GAP,
    minWidth = MIN_CARD_WIDTH,
  } = ROWS_INFO[screenState];

  const sectionHeaderHeight = SECTION_HEADER_HEIGHT[screenState];

  const handleResize = useCallback(() => {
    if (dataRef.current) {
      if (screenState === ScreenState.SM) {
        setColumnCount(1);
        return;
      }

      let count = 1;

      while (
        minWidth * (count + 1) + gap * count <=
        dataRef.current.offsetWidth
      ) {
        count++;
      }

      setColumnCount(count);
    }
  }, [gap, minWidth, screenState]);

  useResizeObserver(dataRef.current, handleResize);

  const allEntities: (MarketplaceEntity | string | null)[] = useMemo(() => {
    const result = [];

    if (featuredEntities.length) {
      result.push(FEATURED_HEADER_SENTINEL, ...Array(colsCount - 1).fill(null));
      result.push(...featuredEntities);
      result.push(
        ...Array(
          (colsCount - (featuredEntities.length % colsCount)) % colsCount,
        ).fill(null),
      );
    }

    if (
      featuredEntities.length &&
      (entities.length || suggestedResults.length)
    ) {
      result.push(ALL_APPS_HEADER_SENTINEL, ...Array(colsCount - 1).fill(null));
    }

    if (!suggestedResults.length) {
      result.push(...entities);
    } else if (!entities.length) {
      result.push(...suggestedResults);
    } else {
      result.push(...entities);
      result.push(
        ...Array((colsCount - (entities.length % colsCount)) % colsCount).fill(
          null,
        ),
      );
      result.push(
        SUGGESTED_HEADER_SENTINEL,
        ...Array(colsCount - 1).fill(null),
      );
      result.push(...suggestedResults);
    }

    return result;
  }, [featuredEntities, entities, suggestedResults, colsCount]);

  const allEntitiesRef = useRef(allEntities);
  allEntitiesRef.current = allEntities;

  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(allEntities.length / colsCount),
    getScrollElement: () => currentParentRef,
    estimateSize: (index) => {
      const first = allEntitiesRef.current[index * colsCount];

      if (first === FEATURED_HEADER_SENTINEL) {
        return FEATURED_HEADER_HEIGHT;
      }

      if (
        first === ALL_APPS_HEADER_SENTINEL ||
        first === SUGGESTED_HEADER_SENTINEL
      ) {
        return sectionHeaderHeight;
      }

      return rowsHeight;
    },
    getItemKey: (index) =>
      range(colsCount)
        // create one unique key for all items in the row
        .map((i) => {
          const item = allEntitiesRef.current[index * colsCount + i];
          if (!item) return '_';
          if (isString(item)) return item;
          return item.id;
        })
        .join('|'),
    overscan: 3,
  });

  useMarketplaceBannerVisibility(currentParentRef);

  useEffect(() => {
    rowVirtualizer.measure();
  }, [screenState, rowVirtualizer]);

  const virtualRows = rowVirtualizer.getVirtualItems();
  const listHeight = rowVirtualizer.getTotalSize();

  return (
    <>
      <SuggestedMessage shouldRender={!entities.length} />
      <MarketplaceEntitiesListWrapper ref={wrapperRefs}>
        <div
          style={{
            height: `${listHeight}px`,
          }}
          ref={dataRef}
          className="no-scrollbar relative flex w-full shrink"
        >
          {virtualRows.map((virtualRow) => {
            const rowEntities = range(colsCount).map(
              (i) => allEntities[virtualRow.index * colsCount + i],
            );
            const isHeaderRow = isString(rowEntities[0]);

            return (
              <div
                key={virtualRow.key}
                ref={isHeaderRow ? rowVirtualizer.measureElement : undefined}
                data-index={virtualRow.index}
                className="absolute start-0 top-0 grid min-w-full"
                style={{
                  ...(isHeaderRow ? null : { height: `${virtualRow.size}px` }),
                  transform: `translateY(${virtualRow.start}px)`,
                  gridTemplateColumns: `repeat(${colsCount}, minmax(0, 1fr))`,
                  gap: `${gap}px`,
                }}
                data-qa="entities-row"
                aria-colcount={colsCount}
              >
                {rowEntities.map((entity) => {
                  if (!entity) {
                    return null;
                  }

                  if (isString(entity)) {
                    return (
                      <SentinelRow dataQa={SENTINEL_DATA[entity].dataQa}>
                        {t(SENTINEL_DATA[entity].label)}
                      </SentinelRow>
                    );
                  }

                  return (
                    <MarketplaceEntityCard
                      key={entity.id}
                      entity={entity}
                      onClick={onCardClick}
                      onBookmarkClick={onBookmarkClick}
                      dataQA={
                        suggestedResults.includes(entity)
                          ? 'suggested'
                          : 'filtered'
                      }
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </MarketplaceEntitiesListWrapper>
    </>
  );
};
