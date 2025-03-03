import { IconMessage2 } from '@tabler/icons-react';

import Link from 'next/link';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch } from '@/src/store/hooks';

import Tooltip from '../Common/Tooltip';

export const BackToChat = () => {
  const { t } = useTranslation(Translation.Header);
  const dispatch = useAppDispatch();

  return (
    <Tooltip isTriggerClickable tooltip={t('Back to Chat')}>
      <Link
        href="/"
        shallow
        className="flex h-full items-center justify-center border-r border-tertiary px-[9px]"
        onClick={() => {
          dispatch(
            ConversationsActions.setIsStartedCustomViewerConversation(false),
          );
        }}
      >
        <div
          className="flex cursor-pointer items-center justify-center rounded border border-transparent bg-accent-primary-alpha p-[2px] hover:border-accent-primary md:px-[10px]"
          data-qa="back-to-chat"
        >
          <IconMessage2 className="text-accent-primary" size={24} />
        </div>
      </Link>
    </Tooltip>
  );
};
