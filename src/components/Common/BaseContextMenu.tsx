import { IconDotsVertical } from '@tabler/icons-react';
import { useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getByHighlightColor } from '@/src/utils/app/folders';

import {
  BaseContextMenuProps,
  BaseMenuItemRendererProps,
} from '@/src/types/menu';

import { Menu, MenuItem } from './DropdownMenu';

function BaseContextMenuItemRenderer({
  name,
  Icon,
  dataQa,
  onClick,
  disabled,
  highlightColor,
  translation,
  className,
}: BaseMenuItemRendererProps) {
  const { t } = useTranslation(translation);
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

export default function BaseContextMenu({
  menuItems,
  highlightColor,
  ContextMenuIcon = IconDotsVertical,
  contextMenuIconSize = 24,
  translation,
  className,
  contextMenuIconHighlight,
}: BaseContextMenuProps) {
  const displayedMenuItems = useMemo(
    () =>
      menuItems.filter((item) => item.display === undefined || item.display),
    [menuItems],
  );

  if (!displayedMenuItems.length) return null;

  return (
    <Menu
      type="contextMenu"
      trigger={
        <div
          className={classNames(
            'flex items-center justify-center rounded text-gray-500',
            contextMenuIconHighlight &&
              getByHighlightColor(
                highlightColor,
                'hover:text-green',
                'hover:text-violet',
              ),
            className || 'p-[5px]',
          )}
        >
          <ContextMenuIcon
            size={contextMenuIconSize}
            width={contextMenuIconSize}
            height={contextMenuIconSize}
            strokeWidth={1.5}
            onClick={(e) => {
              e.stopPropagation();
            }}
          />
        </div>
      }
    >
      {displayedMenuItems.map(({ CustomTriggerRenderer, ...props }) => {
        const Renderer = CustomTriggerRenderer ? (
          <CustomTriggerRenderer
            {...props}
            highlightColor={highlightColor}
            translation={translation}
            Renderer={BaseContextMenuItemRenderer}
          />
        ) : (
          <BaseContextMenuItemRenderer
            {...props}
            translation={translation}
            highlightColor={highlightColor}
          />
        );
        return Renderer;
      })}
    </Menu>
  );
}
