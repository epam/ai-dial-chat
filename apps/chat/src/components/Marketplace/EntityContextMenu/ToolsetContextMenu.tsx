import { useToolsetMenuItems } from '@/src/hooks/useToolsetMenuItems';

import { ToolsetModel } from '@/src/types/toolsets';

import { MarketplaceEntityContextMenu } from './MarketplaceEntityContextMenu';

import { FeatureType } from '@epam/ai-dial-shared';

interface ToolsetContextMenuProps {
  entity: ToolsetModel;
  disabledActions?: Partial<{
    copyLink: boolean;
    edit: boolean;
    share: boolean;
    unshare: boolean;
    publish: boolean;
    unpublish: boolean;
    delete: boolean;
    login: boolean;
  }>;
  className?: string;
  isPreview?: boolean;
  triggerIconSize?: number;
}

export const ToolsetContextMenu: React.FC<ToolsetContextMenuProps> = (
  props,
) => (
  <MarketplaceEntityContextMenu
    {...props}
    useMenuItems={useToolsetMenuItems}
    featureType={FeatureType.Toolset}
  />
);
