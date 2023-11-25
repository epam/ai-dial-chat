import { TablerIconsProps } from '@tabler/icons-react';
import { FC, MouseEventHandler } from 'react';

import { HighlightColor } from './common';

export interface CustomTriggerRendererProps extends BaseMenuItemRendererProps {
  Renderer: (props: BaseMenuItemRendererProps) => JSX.Element;
}

export interface DisplayMenuItemProps {
  display?: boolean;
  name: string;
  disabled?: boolean;
  Icon: (props: TablerIconsProps) => JSX.Element;
  dataQa: string;
  onClick?: (props?: any) => void | MouseEventHandler<unknown>;
  CustomTriggerRenderer?: FC<CustomTriggerRendererProps>;
  className?: string;
}

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
