import { TablerIconsProps } from '@tabler/icons-react';
import { FC, MouseEventHandler } from 'react';

import { HighlightColor } from './common';

export interface CustomTriggerRendererProps extends BaseMenuItemRendererProps {
  Renderer: (props: BaseMenuItemRendererProps) => JSX.Element;
}

interface BasicMenuItemProps {
  disabled?: boolean;
  Icon: (props: TablerIconsProps) => JSX.Element;
  dataQa: string;
  onClick?: (props?: any) => void | MouseEventHandler<unknown>;
  CustomTriggerRenderer?: FC<CustomTriggerRendererProps>;
}

interface DisplayMenuItemInfo {
  display: boolean;
  name: string;
}

export type DisplayMenuItemProps = BasicMenuItemProps & DisplayMenuItemInfo;

export type BaseMenuItemRendererProps = DisplayMenuItemProps & {
  highlightColor: HighlightColor;
  translation: string;
};

export interface BaseMenuProps {
  menuItems: DisplayMenuItemProps[];
  highlightColor: HighlightColor;
  displayMenuItemCount?: number;
  translation: string;
  className?: string;
}

export interface BaseContextMenuProps extends BaseMenuProps {
  ContextMenuIcon?: (props: TablerIconsProps) => JSX.Element;
  contextMenuIconSize?: number;
  contextMenuIconHighlight?: boolean;
}
