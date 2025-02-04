import { ReplaceConfirmationModal } from '../Common/ReplaceConfirmationModal/ReplaceConfirmationModal';
import { UnshareDialog } from '../Common/UnshareDialog';
import { PromptVariablesForApplyDialog } from './ChatInput/PromptVariablesForApplyDialog';
import { RenameConversationModal } from './RenameConversationModal';
import { ShareModal } from './ShareModal';

export function ChatModalsManager() {
  return (
    <>
      <ShareModal />
      <UnshareDialog />
      <ReplaceConfirmationModal />
      <RenameConversationModal />
      <PromptVariablesForApplyDialog />
    </>
  );
}
