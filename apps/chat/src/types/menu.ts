import { Placement } from '@floating-ui/react';
import { Icon } from '@tabler/icons-react';
import { FC, JSX, MouseEventHandler, ReactNode } from 'react';

import { ApplicationType } from './applications';
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
  additionalNameNode?: ReactNode;
  disabled?: boolean;
  Icon?: Icon;
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
  useStandardColor?: boolean;
};

export interface MenuProps {
  menuItems: DisplayMenuItemProps[];
  featureType: FeatureType;
  displayMenuItemCount?: number;
  className?: string;
  disabled?: boolean;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  useStandardColor?: boolean;
}

export interface ContextMenuProps extends MenuProps {
  TriggerIcon?: Icon;
  triggerIconSize?: number;
  triggerIconHighlight?: boolean;
  triggerIconClassName?: string;
  hideTriggerIcon?: boolean;
  triggerTooltip?: string;
  TriggerCustomRenderer?: JSX.Element;
  isLoading?: boolean;
  placement?: Placement;
  onTriggerClick?: onClickMenuItemHandler;
}

export interface AddMarketplaceEntityMenuItem {
  type: ApplicationType | string;
  name: string;
  dataQa: string;
  display: boolean;
}
