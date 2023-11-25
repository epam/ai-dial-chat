import { TablerIconsProps } from '@tabler/icons-react';
import { FC } from 'react';

import { HighlightColor } from './common';

export interface CustomTriggerRendererProps
  extends SidebarMenuItemRendererProps {
  Renderer: (props: SidebarMenuItemRendererProps) => JSX.Element;
}

interface BasicMenuItemProps {
  disabled?: boolean;
  Icon: (props: TablerIconsProps) => JSX.Element;
  dataQa: string;
  onClick: (props?: any) => void;
  CustomTriggerRenderer?: FC<CustomTriggerRendererProps>;
}

interface DisplayMenuItemInfo {
  display: boolean;
  name: string;
}

export type DisplayMenuItemProps = BasicMenuItemProps & DisplayMenuItemInfo;

export type SidebarMenuItemRendererProps = DisplayMenuItemProps & {
  highlightColor: HighlightColor;
};

export interface SidebarSettingsMenuProps {
  menuItems: DisplayMenuItemProps[];
  highlightColor: HighlightColor;
  displayMenuItemCount?: number;
}

export interface SidebarSettingsContextMenuProps
  extends SidebarSettingsMenuProps {
  ContextMenuIcon?: (props: TablerIconsProps) => JSX.Element;
  contextMenuIconSize?: number;
}
