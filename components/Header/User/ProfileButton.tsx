import { useSession } from 'next-auth/react';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';

import Image from 'next/image';

import HomeContext from '@/pages/api/home/home.context';

import UserIcon from '../../../public/images/icons/user.svg';
import XmarkIcon from '../../../public/images/icons/xmark.svg';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../Common/Tooltip';

export const ProfileButton = () => {
  const {
    state: { isProfileOpen },
    dispatch: homeDispatch,
  } = useContext(HomeContext);
  const { t } = useTranslation('sidebar');
  const { data: session } = useSession();

  const onClick = () => {
    homeDispatch({ field: 'isProfileOpen', value: !isProfileOpen });
  };
  return (
    <Tooltip>
      <TooltipTrigger>
        <button className="flex h-full items-center" onClick={onClick}>
          {isProfileOpen ? (
            <XmarkIcon className="text-gray-500" width={24} height={24} />
          ) : session?.user?.image ? (
            <Image
              className="rounded"
              src={session?.user?.image}
              width={24}
              height={24}
              alt={t(`User avatar`)}
            />
          ) : (
            <UserIcon width={18} height={18} />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {isProfileOpen ? t('Close profile settings') : t('Profile settings')}
      </TooltipContent>
    </Tooltip>
  );
};
