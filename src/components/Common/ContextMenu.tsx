import { IconDotsVertical } from '@tabler/icons-react';
import { Fragment, useMemo } from 'react';

import classNames from 'classnames';

import { getByHighlightColor } from '@/src/utils/app/folders';

import { ContextMenuProps, MenuItemRendererProps } from '@/src/types/menu';

import { Menu, MenuItem } from './DropdownMenu';
import Tooltip from './Tooltip';

function ContextMenuItemRenderer({
  name,
  Icon,
  dataQa,
  onClick,
  disabled,
  highlightColor,
  className,
  childMenuItems,
}: MenuItemRendererProps) {
  const item = (
    <div
      className={classNames(
        'flex w-full items-center gap-3 truncate break-words',
        !!childMenuItems && 'text-gray-800 dark:text-gray-200',
        !!childMenuItems && className,
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
  if (childMenuItems) {
    return (
      <ContextMenu
        menuItems={childMenuItems}
        highlightColor={highlightColor}
        triggerIconClassName={classNames(
          className,
          'text-gray-200',
          getByHighlightColor(
            highlightColor,
            'hover:bg-green/15',
            'hover:bg-violet/15',
            'hover:bg-blue-500/20',
          ),
        )}
        TriggerCustomRenderer={item}
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
  TriggerIcon = IconDotsVertical,
  triggerIconSize = 24,
  className,
  triggerIconHighlight,
  TriggerCustomRenderer,
  triggerIconClassName,
  triggerTooltip,
  disabled,
  isOpen,
  onOpenChange,
}: ContextMenuProps) {
  const displayedMenuItems = useMemo(
    () => menuItems.filter(({ display = true }) => display),
    [menuItems],
  );

  if (!displayedMenuItems.length) return null;

  const menuContent = TriggerCustomRenderer || (
    <TriggerIcon
      size={triggerIconSize}
      width={triggerIconSize}
      height={triggerIconSize}
      strokeWidth={1.5}
      onClick={(e) => {
        e.stopPropagation();
      }}
    />
  );

  return (
    <Menu
      className={triggerIconClassName}
      disabled={disabled}
      type="contextMenu"
      onOpenChange={onOpenChange}
      isMenuOpen={isOpen}
      trigger={
        <div
          className={classNames(
            'flex w-full items-center justify-center rounded text-gray-500',
            triggerIconHighlight &&
              getByHighlightColor(
                highlightColor,
                'hover:text-green',
                'hover:text-violet',
                'hover:text-blue-500',
              ),
            className,
          )}
        >
          {triggerTooltip ? (
            <Tooltip isTriggerClickable tooltip={triggerTooltip}>
              {menuContent}
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
        return <Fragment key={props.dataQa}>{Renderer}</Fragment>;
      })}
    </Menu>
  );
}
