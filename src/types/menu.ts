import { TablerIconsProps } from '@tabler/icons-react';
import { FC, MouseEventHandler } from 'react';

import { HighlightColor } from './common';

export interface CustomTriggerRendererProps extends MenuItemRendererProps {
  Renderer: (props: MenuItemRendererProps) => JSX.Element;
}

export interface DisplayMenuItemProps {
  display?: boolean;
  name: string;
  disabled?: boolean;
  Icon?: (props: TablerIconsProps) => JSX.Element;
  dataQa: string;
  onClick?: (props?: any) => void | MouseEventHandler<unknown>;
  CustomTriggerRenderer?: FC<CustomTriggerRendererProps>;
  className?: string;
  menuItems?: DisplayMenuItemProps[];
}

export type MenuItemRendererProps = DisplayMenuItemProps & {
  highlightColor: HighlightColor;
};

export interface MenuProps {
  menuItems: DisplayMenuItemProps[];
  highlightColor: HighlightColor;
  displayMenuItemCount?: number;
  className?: string;
  disabled?: boolean;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

export interface ContextMenuProps extends MenuProps {
  ContextMenuIcon?: (props: TablerIconsProps) => JSX.Element;
  contextMenuIconSize?: number;
  contextMenuTooltip?: string;
  contextMenuIconHighlight?: boolean;
  contextMenuIconClassName?: string;
  CustomMenuRenderer?: JSX.Element;
}
