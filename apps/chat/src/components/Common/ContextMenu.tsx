import { IconDotsVertical } from '@tabler/icons-react';
import { Fragment, useMemo } from 'react';

import classNames from 'classnames';

import { FeatureType } from '@/src/types/common';
import { ContextMenuProps, MenuItemRendererProps } from '@/src/types/menu';

import { Spinner } from '@/src/components/Common/Spinner';

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
  onChildMenuOpenChange,
}: MenuItemRendererProps) {
  const item = (
    <div
      className={classNames(
        'flex w-full items-center gap-3 truncate break-words',
        !!childMenuItems && !disabled && 'text-primary-bg-light',
        !!childMenuItems && className,
      )}
    >
      {Icon && <Icon className="shrink-0" size={18} height={18} width={18} />}
      <span className="truncate break-words">{name}</span>
    </div>
  );
  if (childMenuItems && !disabled) {
    return (
      <ContextMenu
        menuItems={childMenuItems}
        featureType={featureType}
        triggerIconClassName={classNames(
          className,
          'text-secondary-bg-dark',
          'hover:bg-accent-primary-alpha',
        )}
        TriggerCustomRenderer={item}
        onOpenChange={onChildMenuOpenChange}
      />
    );
  }
  return (
    <MenuItem
      className={classNames(
        disabled ? 'text-secondary-bg-dark' : 'hover:bg-accent-primary-alpha',
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
  isLoading,
  placement,
  listClassNames,
}: ContextMenuProps) {
  const displayedMenuItems = useMemo(
    () => menuItems.filter(({ display = true }) => !!display),
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

  if (isLoading && isOpen) return <Spinner size={18} />;

  return (
    <Menu
      placement={placement}
      className={triggerIconClassName}
      listClassName={listClassNames}
      disabled={disabled}
      type="contextMenu"
      onOpenChange={onOpenChange}
      isMenuOpen={isOpen}
      trigger={
        <div
          data-qa="menu-trigger"
          className={classNames(
            'menu-trigger flex w-full items-center justify-center rounded text-quaternary-bg-light',
            triggerIconHighlight && 'hover:text-primary-bg-light',
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
      {!isLoading &&
        displayedMenuItems.map(({ CustomTriggerRenderer, ...props }) => {
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
