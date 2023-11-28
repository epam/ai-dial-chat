import { IconDotsVertical } from '@tabler/icons-react';
import { Fragment, useMemo } from 'react';

import classNames from 'classnames';

import { getByHighlightColor } from '@/src/utils/app/folders';

import { ContextMenuProps, MenuItemRendererProps } from '@/src/types/menu';

import { Menu, MenuItem } from './DropdownMenu';
import { Tooltip, TooltipContent, TooltipTrigger } from './Tooltip';

function ContextMenuItemRenderer({
  name,
  Icon,
  dataQa,
  onClick,
  disabled,
  highlightColor,
  className,
  menuItems,
}: MenuItemRendererProps) {
  const item = (
    <div
      className={classNames(
        'flex w-full items-center gap-3 truncate break-words',
        !!menuItems && 'text-gray-200',
        !!menuItems && className,
      )}
    >
      {Icon && (
        <Icon
          className="shrink-0 text-gray-500"
          size={18}
          height={18}
          width={18}
        />
      )}
      <span className="truncate break-words">{name}</span>
    </div>
  );
  if (menuItems) {
    return (
      <ContextMenu
        menuItems={menuItems}
        highlightColor={highlightColor}
        contextMenuIconClassName={classNames(
          className,
          'text-gray-200',
          getByHighlightColor(
            highlightColor,
            'hover:bg-green/15',
            'hover:bg-violet/15',
            'hover:bg-blue-500/20',
          ),
        )}
        CustomMenuRenderer={item}
      />
    );
  }
  return (
    <MenuItem
      className={classNames(
        getByHighlightColor(
          highlightColor,
          'hover:bg-green/15',
          'hover:bg-violet/15',
          'hover:bg-blue-500/20',
        ),
        className,
      )}
      item={item}
      onClick={onClick}
      data-qa={dataQa}
      disabled={disabled}
    />
  );
}

export default function ContextMenu({
  menuItems,
  highlightColor,
  ContextMenuIcon = IconDotsVertical,
  contextMenuIconSize = 24,
  className,
  contextMenuIconHighlight,
  CustomMenuRenderer,
  contextMenuIconClassName,
  contextMenuTooltip,
  disabled,
  isOpen,
  onOpenChange,
}: ContextMenuProps) {
  const displayedMenuItems = useMemo(
    () => menuItems.filter(({ display = true }) => display),
    [menuItems],
  );

  if (!displayedMenuItems.length) return null;

  const menuContent = CustomMenuRenderer || (
    <ContextMenuIcon
      size={contextMenuIconSize}
      width={contextMenuIconSize}
      height={contextMenuIconSize}
      strokeWidth={1.5}
      onClick={(e) => {
        e.stopPropagation();
      }}
    />
  );

  return (
    <Menu
      className={contextMenuIconClassName}
      disabled={disabled}
      type="contextMenu"
      onOpenChange={onOpenChange}
      isMenuOpen={isOpen}
      trigger={
        <div
          className={classNames(
            'flex w-full items-center justify-center rounded text-gray-500',
            contextMenuIconHighlight &&
              getByHighlightColor(
                highlightColor,
                'hover:text-green',
                'hover:text-violet',
                'hover:text-blue-500',
              ),
            className,
          )}
        >
          {contextMenuTooltip ? (
            <Tooltip isTriggerClickable>
              <TooltipTrigger>{menuContent}</TooltipTrigger>
              <TooltipContent>{contextMenuTooltip}</TooltipContent>
            </Tooltip>
          ) : (
            menuContent
          )}
        </div>
      }
    >
      {displayedMenuItems.map(({ CustomTriggerRenderer, ...props }) => {
        const Renderer = CustomTriggerRenderer ? (
          <CustomTriggerRenderer
            {...props}
            highlightColor={highlightColor}
            Renderer={ContextMenuItemRenderer}
          />
        ) : (
          <ContextMenuItemRenderer {...props} highlightColor={highlightColor} />
        );
        return <Fragment key={props.name}>{Renderer}</Fragment>;
      })}
    </Menu>
  );
}
