import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch } from '@/src/store/hooks';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-settings';

import CirclePlusIcon from '../../../public/images/icons/circle-plus.svg';
import Tooltip from '../Common/Tooltip';

export const CreateNewChatMobile = () => {
  const { t } = useTranslation(Translation.SideBar);
  const dispatch = useAppDispatch();

  return (
    <Tooltip isTriggerClickable tooltip={t('New conversation')}>
      <div
        className="flex border-r border-tertiary p-3 md:hidden"
        onClick={() => {
          dispatch(
            ConversationsActions.createNewConversations({
              names: [DEFAULT_CONVERSATION_NAME],
            }),
          );
        }}
      >
        <CirclePlusIcon className="cursor-pointer text-secondary" width={24} height={24} />
      </div>
    </Tooltip>
  );
};
