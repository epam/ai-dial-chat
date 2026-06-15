import { ChatEventsModal } from '@/src/components/Chat/ChatEventsModal/ChatEventsModal';
import { AgentDialogs } from '@/src/components/Common/AgentDialogs';
import { InfoModal } from '@/src/components/Common/InfoModal';
import { ChatUploadReplaceConfirmationModal } from '@/src/components/Common/ReplaceConfirmationModal/ChatUploadReplaceConfirmationModal';
import { ImportReplaceConfirmationModal } from '@/src/components/Common/ReplaceConfirmationModal/ImportReplaceConfirmationModal';
import { SystemDialogs } from '@/src/components/Common/SystemDialogs';
import { ToolsetDialogs } from '@/src/components/Common/ToolsetDialogs';
import { UnshareDialog } from '@/src/components/Common/UnshareDialog';
import { UserMobile } from '@/src/components/Header/User/UserMobile';
import { DeleteMarketplaceEntityDialog } from '@/src/components/Marketplace/DeleteMarketplaceEntityDialog';
import { PromptModal } from '@/src/components/Promptbar/components/PromptModal';
import { SettingDialog } from '@/src/components/Settings/SettingDialog';

import { PromptVariablesForApplyDialog } from './ChatInput/PromptVariablesForApplyDialog';
import { PublishDialog } from './Publish/PublishDialog';
import { RenameConversationModal } from './RenameConversationModal';
import { ShareModal } from './ShareModal';

export function ChatModalsManager() {
  return (
    <>
      <InfoModal />
      <UserMobile />
      <ShareModal />
      <UnshareDialog />
      <ImportReplaceConfirmationModal />
      <ChatUploadReplaceConfirmationModal />
      <RenameConversationModal />
      <PromptVariablesForApplyDialog />
      <PromptModal />
      <SystemDialogs />
      <PublishDialog />
      <AgentDialogs />
      <ToolsetDialogs />
      <DeleteMarketplaceEntityDialog />
      <SettingDialog />
      <ChatEventsModal />
    </>
  );
}
