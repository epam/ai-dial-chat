import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useMarketplaceBannerVisibility } from '@/src/hooks/useMarketplaceBannerVisibility';
import { useScreenState } from '@/src/hooks/useScreenState';

import { ScreenState } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';

import { AgentsListWrapper } from '../AgentsListWrapper';
import { SuggestedMessage } from '../SuggestedMessage';
import { AgentsListProps } from '../view-props';
import { ApplicationCard } from './ApplicationCard';

import isString from 'lodash-es/isString';
import range from 'lodash-es/range';

const MIN_CARD_WIDTH = 400;
interface RowInfo {
  height: number;
  gap?: number;
}

const DEFAULT_ROW: RowInfo = {
  height: 184,
  gap: 20,
};

const ROWS_INFO: Record<ScreenState, RowInfo> = {
  [ScreenState.SM]: { height: 110, gap: 12 },
  [ScreenState.MD]: { height: 178, gap: 16 },
  [ScreenState.XL]: DEFAULT_ROW,
  [ScreenState.XL3]: DEFAULT_ROW,
  [ScreenState.XL4]: DEFAULT_ROW,
  [ScreenState.XL5]: DEFAULT_ROW,
};

export const AgentsTiles: React.FC<AgentsListProps> = ({
  entities,
  suggestedResults,
  separator,
  onCardClick,
  onPublish,
  onDelete,
  onEdit,
  onBookmarkClick,
  onLogsClick,
}) => {
  const wrapperRefs = useRef<{
    parentRef: React.RefObject<HTMLDivElement>;
    suggestedRowRef: React.RefObject<HTMLSpanElement>;
  }>(null);
  const dataRef = useRef<HTMLDivElement>(null);

  const currentParentRef = wrapperRefs.current?.parentRef.current ?? null;
  const suggestedRowRef = wrapperRefs.current?.suggestedRowRef;
  const [colsCount, setColumnCount] = useState(1);

  const screenState = useScreenState();

  const { height: rowsHeight, gap = 20 } = ROWS_INFO[screenState];
  useEffect(() => {
    const handleResize = () => {
      if (dataRef.current) {
        let count = 1;
        while (
          MIN_CARD_WIDTH * (count + 1) + gap * count <=
          dataRef.current.offsetWidth
        ) {
          count++;
        }
        setColumnCount(count);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);

    if (dataRef.current) {
      resizeObserver.observe(dataRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const allEntities: (DialAIEntityModel | string)[] = useMemo(() => {
    if (!suggestedResults.length) return entities;
    if (!entities.length && suggestedResults.length) return suggestedResults;

    return [
      ...entities,
      ...Array((colsCount - (entities.length % colsCount)) % colsCount).fill(
        null,
      ),
      separator,
      ...Array(colsCount - 1).fill(null),
      ...suggestedResults,
    ];
  }, [suggestedResults, entities, colsCount, separator]);

  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(allEntities.length / colsCount),
    getScrollElement: () => currentParentRef,
    estimateSize: () => rowsHeight,
    overscan: 3,
  });

  useMarketplaceBannerVisibility(currentParentRef);

  useEffect(() => {
    rowVirtualizer.measure();
  }, [screenState, rowVirtualizer]);

  const virtualRows = rowVirtualizer.getVirtualItems();
  const listHeight = rowVirtualizer.getTotalSize();
  const separatorRowId = Math.floor(
    allEntities.findIndex((e) => isString(e)) / colsCount,
  );

  return (
    <>
      <SuggestedMessage entities={entities} />
      <AgentsListWrapper
        separatorRowId={separatorRowId}
        rowsHeight={rowsHeight}
        ref={wrapperRefs}
      >
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

            return (
              <div
                key={virtualRow.key}
                className="absolute left-0 top-0 grid min-w-full"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  gridTemplateColumns: `repeat(${colsCount}, minmax(0, 1fr))`,
                  gap: `${gap}px`,
                }}
                data-qa="agents-row"
              >
                {rowEntities.map((entity) => {
                  if (!entity) {
                    return null;
                  }

                  if (isString(entity)) {
                    return (
                      <span
                        key={entity}
                        style={{
                          height: `${rowsHeight}px`,
                        }}
                        ref={suggestedRowRef}
                      ></span>
                    );
                  }

                  return (
                    <ApplicationCard
                      key={entity.id}
                      entity={entity}
                      onPublish={onPublish}
                      onDelete={onDelete}
                      onClick={onCardClick}
                      onEdit={onEdit}
                      onLogsClick={onLogsClick}
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
      </AgentsListWrapper>
    </>
  );
};
