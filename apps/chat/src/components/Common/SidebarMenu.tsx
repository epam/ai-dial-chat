import { useEffect, useMemo, useRef, useState } from 'react';

import classNames from 'classnames';

import { MenuItemRendererProps, MenuProps } from '@/src/types/menu';

import Tooltip from '@/src/components/Common/Tooltip';

import ContextMenu from './ContextMenu';

const ICON_WIDTH = 24;
const ITEM_PADDING = 5;
const ITEMS_GAP_IN_PIXELS = 8;
const ITEM_WIDTH = ITEM_PADDING * 2 + ICON_WIDTH + ITEMS_GAP_IN_PIXELS;
export function SidebarMenuItemRenderer(props: MenuItemRendererProps) {
  const {
    Icon,
    dataQa,
    onClick,
    disabled,
    featureType,
    className,
    childMenuItems,
  } = props;

  const item = (
    <button
      className={classNames(
        'flex cursor-pointer items-center justify-center rounded p-[5px] hover:bg-accent-primary-alpha hover:text-accent-primary disabled:cursor-not-allowed',
        className,
      )}
      onClick={!childMenuItems ? onClick : undefined}
      data-qa={dataQa}
      disabled={disabled}
    >
      {Icon && (
        <Icon
          size={ICON_WIDTH}
          height={ICON_WIDTH}
          width={ICON_WIDTH}
          strokeWidth="1.5"
        />
      )}
    </button>
  );

  if (childMenuItems) {
    return (
      <ContextMenu
        menuItems={childMenuItems}
        featureType={featureType}
        TriggerCustomRenderer={item}
      />
    );
  }
  return item;
}

export default function SidebarMenu({
  menuItems,
  featureType,
  displayMenuItemCount = 5,
  isOpen,
  onOpenChange,
}: MenuProps) {
  const [displayItemsCount, setDisplayItemsCount] =
    useState<number>(displayMenuItemCount);
  const containerRef = useRef<HTMLDivElement>(null);
  const displayedItems = useMemo(
    () => menuItems.filter(({ display = true }) => display),
    [menuItems],
  );
  const [visibleItems, hiddenItems] = useMemo(() => {
    const visibleItems = displayedItems.slice(0, displayItemsCount);
    const hiddenItems = displayedItems.slice(displayItemsCount);
    return [visibleItems, hiddenItems];
  }, [displayedItems, displayItemsCount]);

  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentBoxSize) {
          const itemsContainerWidth = entry.contentBoxSize[0].inlineSize;
          let count = 3;
          while (
            itemsContainerWidth >=
            ITEM_WIDTH * (count + 1) - ITEMS_GAP_IN_PIXELS
          ) {
            count++;
          }

          let enoughPlaceForEllipsis = false;
          if (
            displayedItems.length > count + 1 ||
            itemsContainerWidth >= ITEM_WIDTH * count + 20
          ) {
            count++;
            enoughPlaceForEllipsis = true;
          }
          if (
            displayedItems.length > count ||
            (enoughPlaceForEllipsis && displayedItems.length >= count)
          ) {
            count--;
          }
          setDisplayItemsCount(count);
        }
      }
    });
    const containerElement = containerRef.current;
    containerElement && resizeObserver.observe(containerElement);

    return () => {
      containerElement && resizeObserver.observe(containerElement);
    };
  }, [displayedItems.length]);

  return (
    <div
      ref={containerRef}
      className="flex items-start gap-2 p-2"
      data-qa="bottom-panel"
    >
      {visibleItems.map(({ CustomTriggerRenderer, ...props }) => {
        const Trigger = CustomTriggerRenderer ? (
          <CustomTriggerRenderer
            {...props}
            featureType={featureType}
            Renderer={SidebarMenuItemRenderer}
          />
        ) : (
          <SidebarMenuItemRenderer {...props} featureType={featureType} />
        );

        return (
          <Tooltip
            key={props.name}
            isTriggerClickable
            tooltip={props.name}
            contentClassName={props.className}
          >
            {Trigger}
          </Tooltip>
        );
      })}

      <ContextMenu
        triggerIconClassName="flex min-w-[34px] cursor-pointer items-center"
        menuItems={hiddenItems}
        isOpen={isOpen}
        featureType={featureType}
        onOpenChange={onOpenChange}
      />
    </div>
  );
}
