import { IconPlus } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';

import { Spinner } from '@/src/components/Common/Spinner';

import Tooltip from '../Common/Tooltip';

interface Props {
  iconSize: number;
}

export const CreateNewChatMobile = ({ iconSize }: Props) => {
  const { t } = useTranslation(Translation.Header);
  const dispatch = useAppDispatch();

  const areConversationsLoaded = useAppSelector(
    ConversationsSelectors.areConversationsUploaded,
  );
  const isActiveNewConversationRequest = useAppSelector(
    ConversationsSelectors.selectIsActiveNewConversationRequest,
  );

  return (
    <Tooltip isTriggerClickable tooltip={t('New conversation')}>
      <button
        className="flex h-full items-center justify-center border-r border-tertiary px-3 md:px-5 xl:hidden"
        onClick={() => {
          if (!areConversationsLoaded || isActiveNewConversationRequest) return;
          dispatch(
            ConversationsActions.createNewConversations({
              names: [DEFAULT_CONVERSATION_NAME],
            }),
          );
        }}
      >
        {!areConversationsLoaded || isActiveNewConversationRequest ? (
          <Spinner
            size={iconSize + 6}
            className="cursor-pointer text-secondary"
          />
        ) : (
          <div className="flex items-center justify-center rounded bg-accent-secondary-alpha p-[3px]">
            <IconPlus
              className="cursor-pointer text-accent-secondary"
              size={iconSize}
            />
          </div>
        )}
      </button>
    </Tooltip>
  );
};
