import { DeleteMarketplaceEntityDialog } from '@/src/components/Marketplace/DeleteMarketplaceEntityDialog';

import { ApplicationLogs } from './ApplicationLogs';
import { PublishAgentDialog } from './PublishAgentDialog';

export const AgentDialogs = () => (
  <>
    <DeleteMarketplaceEntityDialog />
    <PublishAgentDialog />
    <ApplicationLogs />
  </>
);
