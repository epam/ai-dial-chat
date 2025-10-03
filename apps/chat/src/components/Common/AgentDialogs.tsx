import { SharingType } from '@/src/types/share';

import { PublishDialog } from '@/src/components/Chat/Publish/PublishDialog';
import { DeleteMarketplaceEntityDialog } from '@/src/components/Marketplace/DeleteMarketplaceEntityDialog';

import { ApplicationLogs } from './ApplicationLogs';

export const AgentDialogs = () => (
  <>
    <DeleteMarketplaceEntityDialog />
    <PublishDialog type={SharingType.Application} />
    <ApplicationLogs />
  </>
);
