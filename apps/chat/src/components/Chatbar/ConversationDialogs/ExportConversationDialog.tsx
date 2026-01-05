import { FC, useCallback } from 'react';

import { ConversationsActions, ImportExportActions } from '@/src/store/actions';
import { useAppDispatch } from '@/src/store/hooks';
import { ConversationsSelectors } from '@/src/store/selectors';

import { ExportModal } from '@/src/components/Chatbar/ExportModal';
import { withRenderWhenEntities } from '@/src/components/Common/RenderWhen';

interface ExportConversationDialogProps {
  conversationId: string;
}

const ExportConversationDialogView: FC<ExportConversationDialogProps> = ({
  conversationId,
}) => {
  const dispatch = useAppDispatch();

  const handleCloseExportModal = useCallback(() => {
    dispatch(ConversationsActions.setExportingConversationId());
  }, [dispatch]);

  const handleExport = useCallback(
    (args?: unknown) => {
      const typedArgs = args as { withAttachments?: boolean };

      dispatch(
        ImportExportActions.exportConversation({
          conversationId: conversationId,
          withAttachments: typedArgs?.withAttachments ?? false,
        }),
      );
      handleCloseExportModal();
    },
    [dispatch, handleCloseExportModal, conversationId],
  );

  return (
    <ExportModal onExport={handleExport} onClose={handleCloseExportModal} />
  );
};

export const ExportConversationDialog =
  withRenderWhenEntities<ExportConversationDialogProps>({
    conversationId: ConversationsSelectors.selectExportingConversationId,
  })(ExportConversationDialogView);
