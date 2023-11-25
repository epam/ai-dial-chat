import { MouseEvent, useCallback, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getByHighlightColor } from '@/src/utils/app/folders';

import {
  SidebarMenuItemRendererProps,
  SidebarSettingsMenuProps,
} from '@/src/types/sidebar';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/src/components/Common/Tooltip';

import SidebarSettingsContextMenu from './SidebarContextMenu';

export function SidebarMenuItemRenderer({
  Icon,
  dataQa,
  onClick,
  disabled,
  highlightColor,
}: SidebarMenuItemRendererProps) {
  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    },
    [onClick],
  );
  return (
    <button
      className={classNames(
        'flex cursor-pointer items-center justify-center rounded p-[5px] disabled:cursor-not-allowed',
        getByHighlightColor(
          highlightColor,
          'hover:bg-green/15 hover:text-green',
          'hover:bg-violet/15 hover:text-violet',
        ),
      )}
      onClick={handleClick}
      data-qa={dataQa}
      disabled={disabled}
    >
      <Icon size={24} height={24} width={24} strokeWidth="1.5" />
    </button>
  );
}

export default function SidebarMenu({
  menuItems,
  highlightColor,
  displayMenuItemCount = 5, // calculate in future based on width of container
}: SidebarSettingsMenuProps) {
  const { t } = useTranslation('chatbar');
  const [displayedItems, hiddenItems] = useMemo(() => {
    const allItems = menuItems.filter((menu) => menu.display);
    const displayedItems = allItems.slice(0, displayMenuItemCount);
    const hiddenItems = allItems.slice(displayMenuItemCount);
    return [displayedItems, hiddenItems];
  }, [displayMenuItemCount, menuItems]);

  return (
    <div className="flex items-start gap-2 p-2 text-gray-500">
      {displayedItems.map(({ CustomTriggerRenderer, ...props }) => {
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
            <TooltipContent>{t(props.name)}</TooltipContent>
          </Tooltip>
        );
      })}

      <SidebarSettingsContextMenu
        menuItems={hiddenItems}
        highlightColor={highlightColor}
      />
    </div>
  );
}
