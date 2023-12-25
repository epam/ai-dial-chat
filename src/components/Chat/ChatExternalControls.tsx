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
      className="absolute inset-x-0 -top-14 mx-auto mb-3 flex w-fit items-center gap-3 rounded border border-primary bg-layer-2 p-3 hover:bg-layer-4"
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
