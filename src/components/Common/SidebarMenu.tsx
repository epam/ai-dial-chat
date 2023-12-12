import { useEffect, useMemo, useRef, useState } from 'react';

import classNames from 'classnames';

import { getByHighlightColor } from '@/src/utils/app/folders';

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
    highlightColor,
    className,
    childMenuItems,
  } = props;

  const item = (
    <button
      className={classNames(
        'flex cursor-pointer items-center justify-center rounded p-[5px] disabled:cursor-not-allowed',
        getByHighlightColor(
          highlightColor,
          'hover:bg-green/15 hover:text-green',
          'hover:bg-violet/15 hover:text-violet',
          'hover:bg-blue-500/20 hover:text-blue-500',
        ),
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
        highlightColor={highlightColor}
        TriggerCustomRenderer={item}
      />
    );
  }
  return item;
}

export default function SidebarMenu({
  menuItems,
  highlightColor,
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
      className="flex items-start gap-2 p-2 text-gray-500"
    >
      {visibleItems.map(({ CustomTriggerRenderer, ...props }) => {
        const Trigger = CustomTriggerRenderer ? (
          <CustomTriggerRenderer
            {...props}
            highlightColor={highlightColor}
            Renderer={SidebarMenuItemRenderer}
          />
        ) : (
          <SidebarMenuItemRenderer {...props} highlightColor={highlightColor} />
        );

        return (
          <Tooltip key={props.name} isTriggerClickable tooltip={props.name}>
            {Trigger}
          </Tooltip>
        );
      })}

      <ContextMenu
        menuItems={hiddenItems}
        highlightColor={highlightColor}
        className="p-[5px]"
        isOpen={isOpen}
        onOpenChange={onOpenChange}
      />
    </div>
  );
}
