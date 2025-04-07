import { InfoModal } from '../Common/InfoModal';
import { ReplaceConfirmationModal } from '../Common/ReplaceConfirmationModal/ReplaceConfirmationModal';
import { UnshareDialog } from '../Common/UnshareDialog';
import { SettingDialog } from '../Settings/SettingDialog';
import { PromptVariablesForApplyDialog } from './ChatInput/PromptVariablesForApplyDialog';
import { RenameConversationModal } from './RenameConversationModal';
import { ShareModal } from './ShareModal';

export function ChatModalsManager() {
  return (
    <>
      <InfoModal />
      <ShareModal />
      <UnshareDialog />
      <ReplaceConfirmationModal />
      <RenameConversationModal />
      <PromptVariablesForApplyDialog />
      <SettingDialog />
    </>
  );
}
