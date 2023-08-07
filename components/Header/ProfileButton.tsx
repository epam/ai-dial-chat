import { useContext } from 'react';
import { useTranslation } from 'react-i18next';

import HomeContext from '@/pages/api/home/home.context';

import UserIcon from '../../public/images/icons/user.svg';
import XmarkIcon from '../../public/images/icons/xmark.svg';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Common/Tooltip';

interface ProfileButtonProps {
  isOpen: boolean;
}
export const ProfileButton = ({ isOpen }: ProfileButtonProps) => {
  const {
    state: { isProfileOpen },
    dispatch: homeDispatch,
  } = useContext(HomeContext);
  const { t } = useTranslation('sidebar');

  const onClick = () => {
    homeDispatch({ field: 'isProfileOpen', value: !isProfileOpen });
  };
  return (
    <Tooltip>
      <TooltipTrigger>
        <button className="flex h-full items-center" onClick={onClick}>
          {isOpen ? (
            <XmarkIcon
              className="text-gray-500"
              width={24}
              height={24}
              stroke="currentColor"
            />
          ) : (
            <UserIcon
              className="text-gray-500"
              width={24}
              height={24}
              stroke="currentColor"
            />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {isOpen ? t('Close profile settings') : t('Profile settings')}
      </TooltipContent>
    </Tooltip>
  );
};
