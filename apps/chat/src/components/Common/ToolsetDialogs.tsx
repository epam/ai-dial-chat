import { SharingType } from '@/src/types/share';

import { PublishDialog } from '@/src/components/Chat/Publish/PublishDialog';
import { DeleteMarketplaceEntityDialog } from '@/src/components/Marketplace/DeleteMarketplaceEntityDialog';
import { ToolsetLoginDialog } from '@/src/components/Marketplace/ToolsetLoginDialog';

export const ToolsetDialogs = () => (
  <>
    <DeleteMarketplaceEntityDialog />
    <PublishDialog type={SharingType.Toolset} />
    <ToolsetLoginDialog />
  </>
);
