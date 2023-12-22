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
        'flex cursor-pointer items-center justify-center rounded p-[5px] disabled:cursor-not-allowed',
        'hover:bg-accent-primary-alpha hover:text-accent-primary',
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
  const [visibleItems, hiddenItems] = useMemo(() => {
    const displayedItems = menuItems.filter(({ display = true }) => display);
    const visibleItems = displayedItems.slice(0, displayItemsCount);
    const hiddenItems = displayedItems.slice(displayItemsCount);
    return [visibleItems, hiddenItems];
  }, [menuItems, displayItemsCount]);

  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentBoxSize) {
          const itemsContainerWidth = entry.contentBoxSize[0].inlineSize;

          setDisplayItemsCount(itemsContainerWidth / ITEM_WIDTH);
        }
      }
    });
    const containerElement = containerRef.current;
    containerElement && resizeObserver.observe(containerElement);

    return () => {
      containerElement && resizeObserver.observe(containerElement);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex items-start gap-2 p-2 text-secondary"
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
          <Tooltip key={props.name} isTriggerClickable tooltip={props.name}>
            {Trigger}
          </Tooltip>
        );
      })}

      <ContextMenu
        menuItems={hiddenItems}
        isOpen={isOpen}
        featureType={featureType}
        onOpenChange={onOpenChange}
      />
    </div>
  );
}
