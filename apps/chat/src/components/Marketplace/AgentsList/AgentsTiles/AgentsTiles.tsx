import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef } from 'react';

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

const ROWS_INFO = {
  [ScreenState.SM]: { height: 110, cols: 1 },
  [ScreenState.MD]: { height: 178, cols: 2 },
  [ScreenState.XL]: { height: 184, cols: 3 },
  [ScreenState.XL3]: { height: 184, cols: 4 },
  [ScreenState.XL4]: { height: 184, cols: 5 },
  [ScreenState.XL5]: { height: 184, cols: 6 },
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

  const screenState = useScreenState();

  const { cols: colsCount, height: rowsHeight } = ROWS_INFO[screenState];
  const allEntities: (DialAIEntityModel | string)[] = useMemo(() => {
    if (!suggestedResults.length) return entities;
    if (!entities.length && suggestedResults.length) return suggestedResults;

    return [
      ...entities,
      ...Array((colsCount - (entities.length % colsCount)) % colsCount).fill(
        null,
      ),
      separator,
      ...Array(ROWS_INFO[screenState].cols - 1).fill(null),
      ...suggestedResults,
    ];
  }, [suggestedResults, entities, colsCount, separator, screenState]);

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
                className="absolute left-0 top-0 grid min-w-full gap-3 md:gap-4 xl:gap-5"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  gridTemplateColumns: `repeat(${colsCount}, minmax(0, 1fr))`,
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
