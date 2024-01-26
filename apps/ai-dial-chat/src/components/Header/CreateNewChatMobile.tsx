import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch } from '@/src/store/hooks';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-settings';

import CirclePlusIcon from '../../../public/images/icons/circle-plus.svg';
import Tooltip from '../Common/Tooltip';

interface Props {
  iconSize: number;
}

export const CreateNewChatMobile = ({ iconSize }: Props) => {
  const { t } = useTranslation(Translation.SideBar);
  const dispatch = useAppDispatch();

  return (
    <Tooltip isTriggerClickable tooltip={t('New conversation')}>
      <div
        className="flex h-full items-center justify-center border-r border-tertiary px-3 md:hidden"
        onClick={() => {
          dispatch(
            ConversationsActions.createNewConversations({
              names: [DEFAULT_CONVERSATION_NAME],
            }),
          );
        }}
      >
        <CirclePlusIcon
          className="cursor-pointer text-secondary"
          width={iconSize}
          height={iconSize}
        />
      </div>
    </Tooltip>
  );
};
