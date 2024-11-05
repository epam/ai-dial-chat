import { Placement } from '@floating-ui/react';
import { TablerIconsProps } from '@tabler/icons-react';
import { FC, MouseEventHandler } from 'react';

import { FeatureType } from './common';

export interface CustomTriggerMenuRendererProps extends MenuItemRendererProps {
  Renderer: (props: MenuItemRendererProps) => JSX.Element;
}

export type onClickMenuItemHandler =
  | MouseEventHandler<unknown>
  | ((props?: unknown) => void);

export interface DisplayMenuItemProps {
  display?: boolean;
  name: string;
  disabled?: boolean;
  Icon?: (props: TablerIconsProps) => JSX.Element;
  iconClassName?: string;
  dataQa: string;
  onClick?: onClickMenuItemHandler;
  CustomTriggerRenderer?: FC<CustomTriggerMenuRendererProps>;
  customTriggerData?: unknown;
  className?: string;
  childMenuItems?: DisplayMenuItemProps[];
  onChildMenuOpenChange?: (isOpen: boolean) => void;
}

export type MenuItemRendererProps = DisplayMenuItemProps & {
  featureType: FeatureType;
};

export interface MenuProps {
  menuItems: DisplayMenuItemProps[];
  featureType: FeatureType;
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
  isLoading?: boolean;
  placement?: Placement;
}
