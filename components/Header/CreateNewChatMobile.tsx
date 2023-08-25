import { useContext } from 'react';

import { useTranslation } from 'next-i18next';

import HomeContext from '@/pages/api/home/home.context';

import CirclePlusIcon from '../../public/images/icons/circle-plus.svg';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Common/Tooltip';

export const CreateNewChatMobile = () => {
  const { handleNewConversation } = useContext(HomeContext);
  const { t } = useTranslation('sidebar');

  return (
    <Tooltip isTriggerClickable={true}>
      <TooltipTrigger>
        <div
          className="flex border-r border-gray-300 p-3 dark:border-gray-900 md:hidden"
          onClick={() => {
            handleNewConversation();
          }}
        >
          <CirclePlusIcon className="text-gray-500" width={24} height={24} />
        </div>
      </TooltipTrigger>
      <TooltipContent>{t('New conversation')}</TooltipContent>
    </Tooltip>
  );
};
