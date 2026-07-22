import React, {
  ReactNode,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import classNames from 'classnames';

import { hasDragEventEntityData } from '@/src/utils/app/move';

import { FeatureType } from '@/src/types/common';

import { UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/selectors';

import {
  DEFAULT_SIDEBAR_DISPLAY_ITEM_COUNT,
  SIDEBAR_DISPLAY_ITEM_INCREMENT,
} from '@/src/constants/sidebars';

import { NoData } from '@/src/components/Common/NoData';
import { NoResultsFound } from '@/src/components/Common/NoResultsFound';
import { Spinner } from '@/src/components/Common/Spinner';

import { FolderInterface } from '@epam/ai-dial-shared';

interface Props<T> {
  filteredItems: T[];
  filteredFolders: FolderInterface[];
  hasAnyFilteredResults?: boolean;
  featureType: FeatureType.Chat | FeatureType.Prompt;
  searchTerm: string;
  itemComponent: ReactNode | ((isDraggingOver: boolean) => ReactNode);
  folderComponent: React.ReactNode;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  allowDrop: (e: React.DragEvent<HTMLDivElement>) => void;
}

const SENTINEL_HEIGHT = 160;

const SidebarFlatListView = forwardRef(function SidebarFlatListView<T>(
  {
    hasScrolledOnce,
    filteredItems,
    filteredFolders,
    hasAnyFilteredResults,
    featureType,
    searchTerm,
    itemComponent,
    onDrop,
    allowDrop,
  }: Props<T> & { hasScrolledOnce: boolean },
  scrollableSidebarRef: React.ForwardedRef<HTMLDivElement>,
) {
  const dispatch = useAppDispatch();

  const visibleSidebarItemsCount = useAppSelector((state) =>
    UISelectors.selectVisibleSidebarItems(state, featureType),
  );

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isSpinnerVisible, setIsSpinnerVisible] = useState(false);
  const [isSentinelVisible, setIsSentinelVisible] = useState(true);

  const dragDropElement = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasScrolledOnce) {
      setIsSpinnerVisible(true);
    }
  }, [hasScrolledOnce]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !filteredItems.length) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!hasScrolledOnce) {
            return;
          }

          if (
            visibleSidebarItemsCount >= filteredItems.length ||
            (scrollableSidebarRef &&
              'current' in scrollableSidebarRef &&
              (scrollableSidebarRef.current?.scrollHeight ?? 0) <=
                (scrollableSidebarRef.current?.clientHeight ?? 0) +
                  SENTINEL_HEIGHT)
          ) {
            setIsSpinnerVisible(false);
            return;
          }

          dispatch(
            UIActions.setVisibleSidebarItems({
              featureType,
              visibleItems:
                visibleSidebarItemsCount + SIDEBAR_DISPLAY_ITEM_INCREMENT,
            }),
          );

          setIsSpinnerVisible(true);
          setIsSentinelVisible(false);
        }
      },
      { root: null, threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    dispatch,
    featureType,
    visibleSidebarItemsCount,
    filteredItems.length,
    hasScrolledOnce,
    scrollableSidebarRef,
  ]);

  useEffect(() => {
    if (!isSentinelVisible) {
      setIsSentinelVisible(true);
    }
  }, [isSentinelVisible]);

  const highlightDrop = useCallback(
    (e: React.DragEvent) => {
      if (
        hasDragEventEntityData(e, featureType) &&
        (dragDropElement.current?.contains(e.target as Node) ||
          dragDropElement.current === e.target)
      ) {
        setIsDraggingOver(true);
      }
    },
    [featureType],
  );

  const removeHighlight = useCallback((e: React.DragEvent) => {
    if (
      (e.target === dragDropElement.current ||
        dragDropElement.current?.contains(e.target as Node)) &&
      !dragDropElement.current?.contains(e.relatedTarget as Node)
    ) {
      setIsDraggingOver(false);
    }
  }, []);

  const hasResults =
    hasAnyFilteredResults ??
    (filteredItems.length > 0 || filteredFolders.length > 0);

  if (filteredItems.length > 0 || filteredFolders.length > 0) {
    return (
      <div
        ref={dragDropElement}
        className={classNames(
          'relative min-h-min min-w-[42px] grow',
          isDraggingOver && 'bg-accent-primary-alpha',
        )}
        onDrop={(e) => {
          setIsDraggingOver(false);
          onDrop(e);
        }}
        onDragOver={allowDrop}
        onDragEnter={highlightDrop}
        onDragLeave={removeHighlight}
        data-qa="draggable-area"
      >
        {typeof itemComponent === 'function'
          ? itemComponent(isDraggingOver)
          : itemComponent}

        <div
          style={{
            height: `${SENTINEL_HEIGHT}px`,
          }}
          className={classNames(
            'absolute bottom-0 w-1',
            !isSentinelVisible && 'hidden',
          )}
          ref={sentinelRef}
        />
        {visibleSidebarItemsCount < filteredItems.length &&
          isSpinnerVisible && (
            <div className="flex items-center justify-center pb-4">
              <Spinner />
            </div>
          )}
      </div>
    );
  }

  if (hasResults) {
    return null;
  }

  return (
    <div className="flex grow place-content-center">
      {searchTerm.length ? <NoResultsFound /> : <NoData />}
    </div>
  );
});

export function SidebarSections<T>({
  filteredItems,
  filteredFolders,
  hasAnyFilteredResults,
  featureType,
  searchTerm,
  itemComponent,
  folderComponent,
  onDrop,
  allowDrop,
}: Props<T>) {
  const dispatch = useAppDispatch();

  const scrollableSidebarRef = useRef<HTMLDivElement>(null);

  const [hasScrolledOnce, setHasScrolledOnce] = useState(false);

  const resetVisibleItems = useCallback(() => {
    dispatch(
      UIActions.setVisibleSidebarItems({
        featureType,
        visibleItems: DEFAULT_SIDEBAR_DISPLAY_ITEM_COUNT,
      }),
    );
  }, [dispatch, featureType]);

  useEffect(() => {
    resetVisibleItems();

    scrollableSidebarRef.current?.scrollTo({
      top: 0,
      behavior: 'instant',
    });
  }, [resetVisibleItems, searchTerm]);

  useEffect(() => {
    return () => {
      resetVisibleItems();
    };
  }, [resetVisibleItems]);

  const handleScroll = useCallback(() => {
    if (!hasScrolledOnce) {
      setHasScrolledOnce(true);
    }
  }, [hasScrolledOnce]);

  return (
    <div
      ref={scrollableSidebarRef}
      onScroll={handleScroll}
      className="flex grow flex-col gap-px divide-y divide-tertiary overflow-y-auto"
    >
      {folderComponent}

      <SidebarFlatListView
        ref={scrollableSidebarRef}
        hasScrolledOnce={hasScrolledOnce}
        filteredItems={filteredItems}
        filteredFolders={filteredFolders}
        hasAnyFilteredResults={hasAnyFilteredResults}
        featureType={featureType}
        searchTerm={searchTerm}
        itemComponent={itemComponent}
        folderComponent={folderComponent}
        onDrop={onDrop}
        allowDrop={allowDrop}
      />
    </div>
  );
}
