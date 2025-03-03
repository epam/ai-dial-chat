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
  [ScreenState.SM]: { size: 110, cols: 1 },
  [ScreenState.MD]: { size: 178, cols: 2 },
  [ScreenState.XL]: { size: 184, cols: 3 },
  [ScreenState.XL3]: { size: 184, cols: 4 },
  [ScreenState.XL4]: { size: 184, cols: 5 },
  [ScreenState.XL5]: { size: 184, cols: 6 },
};

export const VirtualCardsList: React.FC<AgentsListProps> = ({
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

  const colsCount = ROWS_INFO[screenState].cols;
  const rowsSize = ROWS_INFO[screenState].size;
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
    estimateSize: () => rowsSize,
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
        rowsHeight={rowsSize}
        ref={wrapperRefs}
      >
        <div
          style={{
            height: `${listHeight}px`,
          }}
          ref={dataRef}
          className="no-scrollbar relative flex w-full shrink overflow-y-hidden"
        >
          {virtualRows.map((virtualRow) => {
            const rowEntities = range(colsCount).map(
              (i) => allEntities[virtualRow.index * colsCount + i],
            );

            return (
              <div
                key={virtualRow.key}
                className="absolute left-0 top-0 grid min-w-full grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3 xl:gap-5"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
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
                          height: `${rowsSize}px`,
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
