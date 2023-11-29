import { useMemo } from 'react';

import classNames from 'classnames';

import { getByHighlightColor } from '@/src/utils/app/folders';

import { MenuItemRendererProps, MenuProps } from '@/src/types/menu';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/src/components/Common/Tooltip';

import ContextMenu from './ContextMenu';

export function SidebarMenuItemRenderer(props: MenuItemRendererProps) {
  const {
    Icon,
    dataQa,
    onClick,
    disabled,
    highlightColor,
    className,
    menuItems,
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
      onClick={!menuItems ? onClick : undefined}
      data-qa={dataQa}
      disabled={disabled}
    >
      {Icon && <Icon size={24} height={24} width={24} strokeWidth="1.5" />}
    </button>
  );

  if (menuItems) {
    return (
      <ContextMenu
        menuItems={menuItems}
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
  displayMenuItemCount = 5, // calculate in future based on width of container
  isOpen,
  onOpenChange,
}: MenuProps) {
  const [visibleItems, hiddenItems] = useMemo(() => {
    const displayedItems = menuItems.filter(({ display = true }) => display);
    const visibleItems = displayedItems.slice(0, displayMenuItemCount);
    const hiddenItems = displayedItems.slice(displayMenuItemCount);
    return [visibleItems, hiddenItems];
  }, [displayMenuItemCount, menuItems]);

  return (
    <div className="flex items-start gap-2 p-2 text-gray-500">
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
          <Tooltip key={props.name} isTriggerClickable>
            <TooltipTrigger>{Trigger}</TooltipTrigger>
            <TooltipContent>{props.name}</TooltipContent>
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
