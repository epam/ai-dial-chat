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
        !!childMenuItems && 'text-primary',
        !!childMenuItems && className,
      )}
    >
      {Icon && (
        <Icon
          className="shrink-0 text-secondary"
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
          'text-secondary',
          getByHighlightColor(
            highlightColor,
            'hover:bg-accent-secondary/15',
            'hover:bg-accent-tertiary/15',
            'hover:bg-accent-primary',
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
          'hover:bg-accent-secondary/15',
          'hover:bg-accent-tertiary/15',
          'hover:bg-accent-primary',
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
            'flex w-full items-center justify-center rounded text-secondary',
            triggerIconHighlight &&
              getByHighlightColor(
                highlightColor,
                'hover:text-accent-secondary',
                'hover:text-accent-tertiary',
                'hover:text-accent-primary',
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
        return <Fragment key={props.name}>{Renderer}</Fragment>;
      })}
    </Menu>
  );
}
