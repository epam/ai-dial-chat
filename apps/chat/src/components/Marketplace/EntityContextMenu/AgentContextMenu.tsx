import { useAgentMenuItems } from '@/src/hooks/useAgentMenuItems';

import { DialAIEntityModel } from '@/src/types/models';

import { MarketplaceEntityContextMenu } from './MarketplaceEntityContextMenu';

import { FeatureType } from '@epam/ai-dial-shared';

interface AgentContextMenuProps {
  entity: DialAIEntityModel;
  disabledActions?: Partial<{
    copyLink: boolean;
    deploy: boolean;
    edit: boolean;
    share: boolean;
    unshare: boolean;
    publish: boolean;
    unpublish: boolean;
    logs: boolean;
    delete: boolean;
  }>;
  className?: string;
  isPreview?: boolean;
  triggerIconSize?: number;
}

export const AgentContextMenu: React.FC<AgentContextMenuProps> = (props) => (
  <MarketplaceEntityContextMenu
    {...props}
    useMenuItems={useAgentMenuItems}
    featureType={FeatureType.Application}
  />
);
