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
  className?: string;
}

function MarketplaceEntityContextMenuComponent({
  className,
  ...props
}: MarketplaceEntityContextMenuComponentProps) {
  return (
    <ContextMenu
      {...props}
      triggerIconHighlight
      className={classNames('m-0', className)}
    />
  );
}

interface ToolsetContextMenuProps {
  entity: ToolsetModel;
  triggerIconSize: number;
  disabledActions?: ToolsetContextMenuDisabledActions;
  className?: string;
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
  disabledActions?: ApplicationContextMenuDisabledActions;
  className?: string;
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
  isPreview,
  className,
  disabledActions,
  triggerIconSize = 18,
}: Props) {
  if (isDialAiEntityModel(entity)) {
    return (
      <AgentContextMenu
        isPreview={isPreview}
        className={className}
        entity={entity}
        disabledActions={disabledActions}
        triggerIconSize={triggerIconSize}
      />
    );
  }

  return (
    <ToolsetContextMenu
      isPreview={isPreview}
      className={className}
      entity={entity}
      disabledActions={disabledActions}
      triggerIconSize={triggerIconSize}
    />
  );
}
