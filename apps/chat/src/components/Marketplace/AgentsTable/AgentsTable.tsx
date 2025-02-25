import { VirtualItem, useVirtualizer } from '@tanstack/react-virtual';
import {
  ReactNode,
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useSyncXScroll } from '@/src/hooks/useSyncXScroll';
import { useTranslation } from '@/src/hooks/useTranslation';

import { ScreenState } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  MarketplaceActions,
  MarketplaceSelectors,
} from '@/src/store/marketplace/marketplace.reducers';

import { TableColumnSortKeys } from '@/src/constants/marketplace';

import { AgentsTableLeftSideRow } from './AgentsTableLeftSideRow';
import { AgentsTableRightSideRow } from './AgentsTableRightSideRow';
import { HeaderItem } from './HeaderItem';

import Magnifier from '@/public/images/icons/search-alt.svg';
import { PublishActions } from '@epam/ai-dial-shared';
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

interface AgentsTableProps {
  entities: DialAIEntityModel[];
  suggestedResults: DialAIEntityModel[];
  separator: string;
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
  { label: 'Author', size: 130, sortKey: TableColumnSortKeys.OWNER },
  { label: 'Released', size: 86, sortKey: TableColumnSortKeys.RELEASED },
];
const ROW_SIZES = {
  [ScreenState.MOBILE]: 55,
  [ScreenState.DESKTOP]: 115,
  [ScreenState.TABLET]: 115,
};
const sortKeyMap: Record<TableColumnSortKeys, keyof DialAIEntityModel> = {
  [TableColumnSortKeys.RELEASED]: 'createdAt',
  [TableColumnSortKeys.NAME]: 'name',
  [TableColumnSortKeys.OWNER]: 'owner',
};

export const AgentsTable: React.FC<AgentsTableProps> = memo(
  ({
    entities,
    suggestedResults,
    separator,
    onCardClick,
    onPublish,
    onDelete,
    onEdit,
    onBookmarkClick,
    onLogsClick,
    dataQA,
  }) => {
    const { t } = useTranslation(Translation.Marketplace);

    const dispatch = useAppDispatch();

    const leftColumnHeaderRef = useRef<HTMLDivElement>(null);
    const leftColumnDataRef = useRef<HTMLDivElement>(null);
    const rightColumnHeaderRef = useRef<HTMLDivElement>(null);
    const rightColumnDataRef = useRef<HTMLDivElement>(null);
    const parentRef = useRef<HTMLDivElement>(null);
    const suggestedHeaderRef = useRef<HTMLDivElement>(null);
    const suggestedRowRef = useRef<HTMLDivElement>(null);

    const tableSort = useAppSelector(MarketplaceSelectors.selectTableSort);

    const [hoveredRowId, setHoveredRowId] = useState('');
    const [leftColumnWidth, setLeftColumnWidth] = useState(0);
    const [rightColumnWidth, setRightColumnWidth] = useState(0);

    const screenState = useScreenState();
    useSyncXScroll(rightColumnHeaderRef, rightColumnDataRef);

    const allEntities = useMemo(() => {
      const sortField = sortKeyMap[tableSort.column] || 'name';
      const sortedEntities = orderBy(entities, [sortField], [tableSort.order]);
      const sortedSuggestedEntities = orderBy(
        suggestedResults,
        [sortField],
        [tableSort.order],
      );

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
      getScrollElement: () => parentRef.current,
      estimateSize: () => ROW_SIZES[screenState],
      overscan: 2,
    });

    useEffect(() => {
      const leftObserver = new ResizeObserver(() => {
        setLeftColumnWidth(leftColumnHeaderRef.current?.offsetWidth ?? 0);
      });

      const rightObserver = new ResizeObserver(() => {
        setRightColumnWidth(rightColumnHeaderRef.current?.offsetWidth ?? 0);
      });

      if (leftColumnHeaderRef.current) {
        leftObserver.observe(leftColumnHeaderRef.current);
      }

      if (rightColumnHeaderRef.current) {
        rightObserver.observe(rightColumnHeaderRef.current);
      }

      return () => {
        leftObserver.disconnect();
        rightObserver.disconnect();
      };
    }, []);

    useEffect(() => {
      rowVirtualizer.measure();
    }, [screenState, rowVirtualizer]);

    const handleRowHover = useCallback((hoveredRowId: string) => {
      setHoveredRowId(hoveredRowId);
    }, []);

    const handleRowHoverOver = useCallback(() => {
      setHoveredRowId('');
    }, []);

    const handleApplySorting = useCallback(
      (column: TableColumnSortKeys) => {
        const isSameColumnClicked = column === tableSort.column;

        dispatch(
          MarketplaceActions.setTableSort({
            column,
            order:
              isSameColumnClicked && tableSort.order === 'asc' ? 'desc' : 'asc',
          }),
        );
      },
      [dispatch, tableSort.column, tableSort.order],
    );

    const virtualRows = rowVirtualizer.getVirtualItems();
    const columnsHeight = rowVirtualizer.getTotalSize();
    const stringRowId = allEntities.findIndex(isString);

    return (
      <>
        {!entities.length && (
          <div
            ref={suggestedHeaderRef}
            className="flex flex-col justify-center px-3"
            data-qa="no-workspace-results-found"
          >
            <div className="flex items-center gap-1">
              <Magnifier
                height={32}
                width={32}
                className="shrink-0 text-secondary"
              />
              <span className="text-sm sm:text-base">
                {t(
                  'No results found in My workspace. Look at suggested results from DIAL Marketplace.',
                )}
              </span>
            </div>
            <span
              className="mb-4 mt-5 text-xl md:mt-6 lg:mt-8"
              data-qa="marketplace-suggestions-label"
            >
              {t('Suggested results from DIAL Marketplace')}
            </span>
          </div>
        )}
        <div className="flex min-w-full items-center">
          <div
            ref={leftColumnHeaderRef}
            className="min-w-[195px] flex-1 cursor-pointer items-center pb-3 pl-4 pr-3 pt-5 md:min-w-[316px] md:pl-4 xl:min-w-[245px]"
          >
            <HeaderItem
              label={
                screenState === ScreenState.MOBILE
                  ? 'Name'
                  : 'Name and Description'
              }
              sortKey={TableColumnSortKeys.NAME}
              sortOrder={
                tableSort.column === TableColumnSortKeys.NAME
                  ? tableSort.order
                  : undefined
              }
              onApplySorting={handleApplySorting}
            />
          </div>
          <div
            ref={rightColumnHeaderRef}
            className="no-scrollbar overflow-x-auto"
          >
            <div className="inline-flex flex-col divide-y divide-secondary">
              <div className="flex shrink-0 grow gap-3 pb-3 pl-4 pr-3 pt-5 md:gap-5 md:px-4">
                {headerItems.map((item) => (
                  <HeaderItem
                    {...item}
                    key={item.label}
                    sortOrder={
                      tableSort.column === item.sortKey
                        ? tableSort.order
                        : undefined
                    }
                    onApplySorting={handleApplySorting}
                  />
                ))}
                <div className="hidden flex-none xl:block">
                  <div className="invisible flex gap-1">
                    <div className="size-[18px]"></div>
                    <div className="size-[18px]"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <section
          ref={parentRef}
          data-qa={dataQA}
          style={{
            maxHeight: `calc(100%-${suggestedHeaderRef.current?.clientHeight ?? 0})px`,
            height: `calc(100%-${suggestedHeaderRef.current?.clientHeight ?? 0})px`,
          }}
          className="relative flex overflow-auto"
        >
          {/* positioned from parentRef to not be reduced by a parent container overflow */}
          {stringRowId !== -1 && (
            <span
              ref={suggestedRowRef}
              className="absolute flex w-screen max-w-full items-center px-3 text-xl"
              style={{
                height: `${ROW_SIZES[screenState]}px`,
                top: `${stringRowId * ROW_SIZES[screenState]}px`,
              }}
              data-qa="marketplace-suggestions-label"
            >
              {t('Suggested results from DIAL Marketplace')}
            </span>
          )}
          <DataRowContainer
            ref={leftColumnDataRef}
            width={leftColumnWidth}
            height={columnsHeight}
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
            height={columnsHeight}
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
                    <span className="!border-t-0"></span>
                  ) : (
                    <AgentsTableRightSideRow
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
                  )}
                </DataRowItem>
              );
            })}
          </DataRowContainer>
        </section>
      </>
    );
  },
);
AgentsTable.displayName = 'AgentsTable';
