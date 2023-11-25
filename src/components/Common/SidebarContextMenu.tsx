import { IconDotsVertical } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getByHighlightColor } from '@/src/utils/app/folders';

import {
  SidebarMenuItemRendererProps,
  SidebarSettingsContextMenuProps,
} from '@/src/types/sidebar';

import { Menu, MenuItem } from './DropdownMenu';

function SidebarContextMenuItemRenderer({
  name,
  Icon,
  dataQa,
  onClick,
  disabled,
  highlightColor,
}: SidebarMenuItemRendererProps) {
  const { t } = useTranslation('chatbar');
  return (
    <MenuItem
      className={getByHighlightColor(
        highlightColor,
        'hover:bg-green/15',
        'hover:bg-violet/15',
      )}
      item={
        <div className="flex items-center gap-3">
          <Icon
            className="shrink-0 text-gray-500"
            size={18}
            height={18}
            width={18}
          />
          <span>{t(name)}</span>
        </div>
      }
      onClick={onClick}
      data-qa={dataQa}
      disabled={disabled}
    />
  );
}

export default function SidebarContextMenu({
  menuItems,
  highlightColor,
  ContextMenuIcon = IconDotsVertical,
  contextMenuIconSize = 24,
}: SidebarSettingsContextMenuProps) {
  if (!menuItems.length) return null;

  return (
    <Menu
      type="contextMenu"
      trigger={
        <div
          className={classNames(
            'flex items-center justify-center rounded p-[5px] text-gray-500',
            getByHighlightColor(
              highlightColor,
              'hover:text-green',
              'hover:text-violet',
            ),
          )}
        >
          <ContextMenuIcon
            size={contextMenuIconSize}
            width={contextMenuIconSize}
            height={contextMenuIconSize}
            strokeWidth={1.5}
          />
        </div>
      }
    >
      {menuItems.map(({ CustomTriggerRenderer, ...props }) => {
        const Renderer = CustomTriggerRenderer ? (
          <CustomTriggerRenderer
            {...props}
            highlightColor={highlightColor}
            Renderer={SidebarContextMenuItemRenderer}
          />
        ) : (
          <SidebarContextMenuItemRenderer
            {...props}
            highlightColor={highlightColor}
          />
        );
        return Renderer;
      })}
    </Menu>
  );
}
