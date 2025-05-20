import { ApplicationLogs } from './ApplicationLogs';
import { ConfirmAgentDeleteDialog } from './ConfirmAgentDeleteDialog';
import { PublishAgentDialog } from './PublishAgentDialog';

export const AgentDialogs = () => (
  <>
    <ConfirmAgentDeleteDialog />
    <PublishAgentDialog />
    <ApplicationLogs />
  </>
);
