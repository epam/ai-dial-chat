import { ReplaceConfirmationModal } from '../Common/ReplaceConfirmationModal/ReplaceConfirmationModal';
import { UnshareDialog } from '../Common/UnshareDialog';
import { UserMobile } from '../Header/User/UserMobile';
import { PromptVariablesForApplyDialog } from './ChatInput/PromptVariablesForApplyDialog';
import { RenameConversationModal } from './RenameConversationModal';
import { ShareModal } from './ShareModal';

export function ChatModalsManager() {
  return (
    <>
      <UserMobile />
      <ShareModal />
      <UnshareDialog />
      <ReplaceConfirmationModal />
      <RenameConversationModal />
      <PromptVariablesForApplyDialog />
    </>
  );
}
