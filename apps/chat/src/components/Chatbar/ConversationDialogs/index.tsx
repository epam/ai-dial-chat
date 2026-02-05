import { FC } from 'react';

import { ConversationMoveToDialog } from './ConversationMoveToDialog';
import { DeleteConversationDialog } from './DeleteConversationDialog';
import { ExportConversationDialog } from './ExportConversationDialog';

export const ConversationDialogs: FC = () => {
  return (
    <>
      <ConversationMoveToDialog />
      <DeleteConversationDialog />
      <ExportConversationDialog />
    </>
  );
};
