import { TablerIconsProps } from '@tabler/icons-react';
import { FC, MouseEventHandler } from 'react';

import { HighlightColor } from './common';

export interface CustomTriggerMenuRendererProps extends MenuItemRendererProps {
  Renderer: (props: MenuItemRendererProps) => JSX.Element;
}

export interface DisplayMenuItemProps {
  display?: boolean;
  name: string;
  disabled?: boolean;
  Icon?: (props: TablerIconsProps) => JSX.Element;
  dataQa: string;
  onClick?: (props?: any) => void | MouseEventHandler<unknown>;
  CustomTriggerRenderer?: FC<CustomTriggerMenuRendererProps>;
  customTriggerData?: any;
  className?: string;
  childMenuItems?: DisplayMenuItemProps[];
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
  TriggerIcon?: (props: TablerIconsProps) => JSX.Element;
  triggerIconSize?: number;
  triggerIconHighlight?: boolean;
  triggerIconClassName?: string;
  triggerTooltip?: string;
  TriggerCustomRenderer?: JSX.Element;
}
