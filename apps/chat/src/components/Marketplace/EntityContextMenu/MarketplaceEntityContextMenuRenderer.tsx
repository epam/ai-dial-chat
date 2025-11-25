import { isDialAiEntityModel } from '@/src/utils/app/application';

import { ApplicationContextMenuDisabledActions } from '@/src/types/applications';
import { MarketplaceEntity } from '@/src/types/marketplace';
import { ToolsetContextMenuDisabledActions } from '@/src/types/toolsets';

import { AgentContextMenu } from './AgentContextMenu';
import { ToolsetContextMenu } from './ToolsetContextMenu';

interface Props {
  entity: MarketplaceEntity;
  isPreview?: boolean;
  className?: string;
  disabledActions?:
    | ApplicationContextMenuDisabledActions
    | ToolsetContextMenuDisabledActions;
  triggerIconSize?: number;
}

export function MarketplaceEntityContextMenuRenderer({
  entity,
  isPreview,
  className,
  disabledActions,
  triggerIconSize,
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
