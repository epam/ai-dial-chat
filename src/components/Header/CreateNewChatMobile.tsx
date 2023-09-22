import { useTranslation } from 'next-i18next';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch } from '@/src/store/hooks';

import CirclePlusIcon from '../../../public/images/icons/circle-plus.svg';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Common/Tooltip';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-settings';

export const CreateNewChatMobile = () => {
  const { t } = useTranslation('sidebar');
  const dispatch = useAppDispatch();

  return (
    <Tooltip isTriggerClickable={true}>
      <TooltipTrigger>
        <div
          className="flex border-r border-gray-300 p-3 dark:border-gray-900 md:hidden"
          onClick={() => {
            dispatch(
              ConversationsActions.createNewConversations({
                names: [DEFAULT_CONVERSATION_NAME],
              }),
            );
          }}
        >
          <CirclePlusIcon className="text-gray-500" width={24} height={24} />
        </div>
      </TooltipTrigger>
      <TooltipContent>{t('New conversation')}</TooltipContent>
    </Tooltip>
  );
};
