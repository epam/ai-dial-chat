import { useTranslation } from 'react-i18next';

import { Conversation } from '@/types/chat';

import CirclePlusIcon from '../../public/images/icons/circle-plus.svg';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Common/Tooltip';

interface CreateNewChatMobileProps {
  handleNewConversation: (
    name?: string | undefined,
  ) => Conversation | undefined;
}
export const CreateNewChatMobile = ({
  handleNewConversation,
}: CreateNewChatMobileProps) => {
  const { t } = useTranslation('sidebar');

  return (
    <Tooltip>
      <TooltipTrigger>
        <div
          className="flex border-r border-gray-300 p-3 dark:border-gray-900"
          onClick={() => handleNewConversation()}
        >
          <CirclePlusIcon
            className="text-gray-500"
            width={24}
            height={24}
            stroke="currentColor"
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>{t('New chat')}</TooltipContent>
    </Tooltip>
  );
};
