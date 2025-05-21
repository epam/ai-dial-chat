import { InfoModal } from '@/src/components/Common/InfoModal';
import { ReplaceConfirmationModal } from '@/src/components/Common/ReplaceConfirmationModal/ReplaceConfirmationModal';
import { SystemDialogs } from '@/src/components/Common/SystemDialogs';
import { UnshareDialog } from '@/src/components/Common/UnshareDialog';
import { UserMobile } from '@/src/components/Header/User/UserMobile';
import { PromptModal } from '@/src/components/Promptbar/components/PromptModal';

import { PromptVariablesForApplyDialog } from './ChatInput/PromptVariablesForApplyDialog';
import { RenameConversationModal } from './RenameConversationModal';
import { ShareModal } from './ShareModal';

export function ChatModalsManager() {
  return (
    <>
      <InfoModal />
      <UserMobile />
      <ShareModal />
      <UnshareDialog />
      <ReplaceConfirmationModal />
      <RenameConversationModal />
      <PromptVariablesForApplyDialog />
      <PromptModal />
      <SystemDialogs />
    </>
  );
}
