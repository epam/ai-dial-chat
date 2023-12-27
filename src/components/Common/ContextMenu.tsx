import { IconDotsVertical } from '@tabler/icons-react';
import { Fragment, useMemo } from 'react';

import classNames from 'classnames';

import { FeatureType } from '@/src/types/common';
import { ContextMenuProps, MenuItemRendererProps } from '@/src/types/menu';

import { Menu, MenuItem } from './DropdownMenu';
import Tooltip from './Tooltip';

function ContextMenuItemRenderer({
  featureType,
  name,
  Icon,
  dataQa,
  onClick,
  disabled,
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
        featureType={featureType}
        triggerIconClassName={classNames(
          className,
          'text-secondary',
          'hover:bg-accent-primary-alpha',
        )}
        TriggerCustomRenderer={item}
      />
    );
  }
  return (
    <MenuItem
      className={classNames('hover:bg-accent-primary-alpha', className)}
      item={item}
      onClick={onClick}
      data-qa={dataQa}
      disabled={disabled}
    />
  );
}

export default function ContextMenu({
  menuItems,
  featureType,
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
      className={classNames(triggerIconClassName)}
      listClassName={classNames(
        featureType &&
          (featureType === FeatureType.Chat
            ? 'context-menu-chat'
            : 'context-menu-prompt'),
      )}
      disabled={disabled}
      type="contextMenu"
      onOpenChange={onOpenChange}
      isMenuOpen={isOpen}
      trigger={
        <div
          className={classNames(
            'flex w-full items-center justify-center rounded text-secondary',
            triggerIconHighlight && 'hover:text-accent-primary',
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
            Renderer={ContextMenuItemRenderer}
            featureType={featureType}
          />
        ) : (
          <ContextMenuItemRenderer {...props} featureType={featureType} />
        );
        return <Fragment key={props.dataQa}>{Renderer}</Fragment>;
      })}
    </Menu>
  );
}
