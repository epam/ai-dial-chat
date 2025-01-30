import { IconPlus } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

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

export const CreateNewConversation = ({ iconSize }: Props) => {
  const { t } = useTranslation(Translation.Header);
  const dispatch = useAppDispatch();

  const areConversationsLoaded = useAppSelector(
    ConversationsSelectors.areConversationsUploaded,
  );
  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );

  return (
    <Tooltip isTriggerClickable tooltip={t('New conversation')}>
      <button
        className="flex h-full items-center justify-center border-r border-tertiary px-[9px] disabled:cursor-not-allowed"
        aria-label={`${t('New conversation')}`}
        onClick={() => {
          if (!areConversationsLoaded) return;
          dispatch(
            ConversationsActions.createNewConversations({
              names: [DEFAULT_CONVERSATION_NAME],
              headerCreateNew: true,
            }),
          );
          dispatch(ConversationsActions.resetSearch());
        }}
        disabled={messageIsStreaming}
        data-qa="new-entity"
      >
        {!areConversationsLoaded ? (
          <Spinner
            size={iconSize + 6}
            className="cursor-pointer text-secondary md:mx-2"
          />
        ) : (
          <div
            className={classNames(
              'flex items-center justify-center rounded border border-transparent bg-accent-secondary-alpha p-[2px] md:px-[10px]',
              messageIsStreaming
                ? 'cursor-not-allowed'
                : 'cursor-pointer hover:border-accent-secondary',
            )}
          >
            <IconPlus
              className={classNames(
                'text-accent-secondary',
                messageIsStreaming ? 'cursor-not-allowed' : 'cursor-pointer',
              )}
              size={iconSize}
            />
          </div>
        )}
      </button>
    </Tooltip>
  );
};
