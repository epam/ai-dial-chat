import { ApplicationLogs } from '../Marketplace/ApplicationLogs';
import { ConfirmAgentDeleteDialog } from './ConfirmAgentDeleteDialog';
import { PublishAgentDialog } from './PublishAgentDialog';

export const AgentDialogs = () => (
  <>
    <ConfirmAgentDeleteDialog />
    <PublishAgentDialog />
    <ApplicationLogs />
  </>
);
