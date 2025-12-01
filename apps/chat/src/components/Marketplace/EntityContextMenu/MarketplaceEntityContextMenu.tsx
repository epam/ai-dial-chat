import classNames from 'classnames';

import { useAgentMenuItems } from '@/src/hooks/useAgentMenuItems';
import { useToolsetMenuItems } from '@/src/hooks/useToolsetMenuItems';

import { isDialAiEntityModel } from '@/src/utils/app/application';

import { ApplicationContextMenuDisabledActions } from '@/src/types/applications';
import { MarketplaceEntity } from '@/src/types/marketplace';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { DialAIEntityModel } from '@/src/types/models';
import {
  ToolsetContextMenuDisabledActions,
  ToolsetModel,
} from '@/src/types/toolsets';

import { ContextMenu } from '@/src/components/Common/ContextMenu';

import { FeatureType } from '@epam/ai-dial-shared';

interface MarketplaceEntityContextMenuComponentProps {
  featureType: FeatureType;
  menuItems: DisplayMenuItemProps[];
  triggerIconSize: number;
  className: string;
}

function MarketplaceEntityContextMenuComponent(
  props: MarketplaceEntityContextMenuComponentProps,
) {
  return <ContextMenu {...props} triggerIconHighlight />;
}

interface ToolsetContextMenuProps {
  entity: ToolsetModel;
  triggerIconSize: number;
  className: string;
  disabledActions?: ToolsetContextMenuDisabledActions;
  isPreview?: boolean;
}

function ToolsetContextMenu({
  entity,
  disabledActions,
  isPreview,
  ...props
}: ToolsetContextMenuProps) {
  const menuItems = useToolsetMenuItems({ entity, disabledActions, isPreview });

  return (
    <MarketplaceEntityContextMenuComponent
      menuItems={menuItems}
      featureType={FeatureType.Toolset}
      {...props}
    />
  );
}

interface AgentContextMenuProps {
  entity: DialAIEntityModel;
  triggerIconSize: number;
  className: string;
  disabledActions?: ApplicationContextMenuDisabledActions;
  isPreview?: boolean;
}

function AgentContextMenu({
  entity,
  disabledActions,
  isPreview,
  ...props
}: AgentContextMenuProps) {
  const menuItems = useAgentMenuItems({ entity, disabledActions, isPreview });

  return (
    <MarketplaceEntityContextMenuComponent
      menuItems={menuItems}
      featureType={FeatureType.Application}
      {...props}
    />
  );
}

interface Props {
  entity: MarketplaceEntity;
  isPreview?: boolean;
  className?: string;
  disabledActions?:
    | ApplicationContextMenuDisabledActions
    | ToolsetContextMenuDisabledActions;
  triggerIconSize?: number;
}

export function MarketplaceEntityContextMenu({
  entity,
  className,
  triggerIconSize = 18,
  ...props
}: Props) {
  const contextMenuClassName = classNames('m-0', className);

  if (isDialAiEntityModel(entity)) {
    return (
      <AgentContextMenu
        className={contextMenuClassName}
        entity={entity}
        triggerIconSize={triggerIconSize}
        {...props}
      />
    );
  }

  return (
    <ToolsetContextMenu
      className={contextMenuClassName}
      entity={entity}
      triggerIconSize={triggerIconSize}
      {...props}
    />
  );
}
