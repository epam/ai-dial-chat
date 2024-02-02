import { IconCopy } from '@tabler/icons-react';
import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch } from '@/src/store/hooks';

export default function ChatExternalControls() {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();

  const handleDuplicate = useCallback(() => {
    dispatch(ConversationsActions.duplicateSelectedConversations());
  }, [dispatch]);

  return (
    <button
      className="button button-chat !-top-10"
      onClick={handleDuplicate}
      data-qa="duplicate"
    >
      <span className="text-secondary">
        <IconCopy width={18} height={18} />
      </span>
      {t('Duplicate the chat to be able to edit it')}
    </button>
  );
}
