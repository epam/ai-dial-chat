import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

import { useScreenState } from '@/src/hooks/useScreenState';

import { ScreenState } from '@/src/types/common';

import { MarketplaceActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/marketplace/marketplace.selectors';

import { TableColumnSortKeys } from '@/src/constants/marketplace';

import { HeaderItem } from './HeaderItem';

const headerItems = [
  { label: 'Version', size: 100 },
  { label: 'Topics', size: 161 },
  { label: 'Author', size: 130, sortKey: TableColumnSortKeys.OWNER },
  { label: 'Released', size: 86, sortKey: TableColumnSortKeys.RELEASED },
];

export const AgentsTableHeader = forwardRef<
  {
    leftColumnHeaderRef: React.RefObject<HTMLDivElement>;
    rightColumnHeaderRef: React.RefObject<HTMLDivElement>;
  },
  NonNullable<unknown>
>((_, ref) => {
  const screenState = useScreenState();

  const dispatch = useAppDispatch();

  const leftColumnHeaderRef = useRef<HTMLDivElement>(null);
  const rightColumnHeaderRef = useRef<HTMLDivElement>(null);

  // Using useImperativeHandle to expose internal refs (leftColumnHeaderRef and rightColumnHeaderRef)
  // to the parent component. This allows the parent to control sync header rows with data rows
  useImperativeHandle(ref, () => ({
    leftColumnHeaderRef,
    rightColumnHeaderRef,
  }));

  const tableSort = useAppSelector(MarketplaceSelectors.selectTableSort);

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

  return (
    <div className="flex min-w-full items-center px-0 md:px-5 xl:px-16">
      <div
        ref={leftColumnHeaderRef}
        className="min-w-[195px] flex-1 cursor-pointer items-center pb-3 pl-4 pr-3 pt-5 md:min-w-[316px] md:pl-4 xl:min-w-[245px]"
      >
        <HeaderItem
          label={
            screenState === ScreenState.SM ? 'Name' : 'Name and Description'
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
      <div ref={rightColumnHeaderRef} className="no-scrollbar overflow-x-auto">
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
  );
});
AgentsTableHeader.displayName = 'AgentsTableHeader';
