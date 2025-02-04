import { ReplaceConfirmationModal } from '../Common/ReplaceConfirmationModal/ReplaceConfirmationModal';
import { UnshareDialog } from '../Common/UnshareDialog';
import { RenameConversationModal } from './RenameConversationModal';
import { ShareModal } from './ShareModal';

export const MainModalManager = () => {
  return (
    <>
      <ShareModal />
      <UnshareDialog />
      <ReplaceConfirmationModal />
      <RenameConversationModal />
    </>
  );
};
