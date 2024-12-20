import { ReplaceConfirmationModal } from '../Common/ReplaceConfirmationModal/ReplaceConfirmationModal';
import { RenameConversationModal } from './RenameConversationModal';
import ShareModal from './ShareModal';

export const MainModalManager = () => {
  return (
    <>
      <ShareModal />
      <ReplaceConfirmationModal />
      <RenameConversationModal />
    </>
  );
};
