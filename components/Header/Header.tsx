import { useContext } from 'react';
import { useTranslation } from 'react-i18next';

import { isMediaQuery } from '@/utils/app/styleHelpers';

import HomeContext from '@/pages/api/home/home.context';

import MoveLeftIcon from '../../public/images/icons/move-left.svg';
import MoveRightIcon from '../../public/images/icons/move-right.svg';
import XmarkIcon from '../../public/images/icons/xmark.svg';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Common/Tooltip';
import { SettingDialog } from '../Settings/SettingDialog';
import { CreateNewChatMobile } from './CreateNewChatMobile';
import { ProfileButton } from './ProfileButton';
import { User } from './User';

const Header = () => {
  const {
    state: { showChatbar, showPromptbar, isUserSettingsOpen, isProfileOpen },
    dispatch: homeDispatch,
    handleNewConversation,
  } = useContext(HomeContext);

  const { t } = useTranslation('sidebar');

  const handleToggleChatbar = () => {
    if (!showChatbar && isMediaQuery('(width <= 767px)')) {
      homeDispatch({ field: 'showPromptbar', value: false });
      localStorage.setItem('showPromptbar', JSON.stringify(false));
    }
    homeDispatch({ field: 'showChatbar', value: !showChatbar });
    localStorage.setItem('showChatbar', JSON.stringify(!showChatbar));
  };
  const handleTogglePromtbar = () => {
    if (!showPromptbar && isMediaQuery('(width <= 767px)')) {
      homeDispatch({ field: 'showChatbar', value: false });
      localStorage.setItem('showChatbar', JSON.stringify(false));

      homeDispatch({ field: 'isProfileOpen', value: false });
    }
    homeDispatch({ field: 'showPromptbar', value: !showPromptbar });
    localStorage.setItem('showPromptbar', JSON.stringify(!showPromptbar));
  };

  const onClose = () => {
    homeDispatch({ field: 'isUserSettingsOpen', value: false });
  };

  return (
    <div className="flex h-[48px] w-full border-b border-gray-300 bg-gray-100 dark:border-gray-900 dark:bg-gray-700">
      <Tooltip>
        <TooltipTrigger>
          <div
            className="flex-none cursor-pointer border-r border-gray-300 px-5 py-3 dark:border-gray-900"
            onClick={handleToggleChatbar}
          >
            {showChatbar ? (
              isMediaQuery('(width <= 767px)') ? (
                <XmarkIcon
                  className="text-gray-500"
                  width={24}
                  height={24}
                  stroke="currentColor"
                />
              ) : (
                <MoveLeftIcon
                  className="text-gray-500 hover:text-green"
                  width={24}
                  height={24}
                  stroke="currentColor"
                />
              )
            ) : (
              <MoveRightIcon
                className="text-gray-500 hover:text-green"
                width={24}
                height={24}
                stroke="currentColor"
              />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {showChatbar ? t('Close chat menu') : t('Open chat menu')}
        </TooltipContent>
      </Tooltip>
      {isMediaQuery('(width <= 767px)') && (
        <CreateNewChatMobile handleNewConversation={handleNewConversation} />
      )}
      <div className="flex grow justify-between">
        <span
          className="bg-center bg-no-repeat dark:invert max-md:grow xl:min-w-[195px]"
          style={{
            backgroundImage: `var(--app-logo)`,
          }}
        ></span>
        <div className="max-md:border-l max-md:border-gray-300 max-md:dark:border-gray-900 xl:min-w-[195px]">
          {isMediaQuery('(width <= 767px)') ? (
            <ProfileButton isOpen={isProfileOpen} />
          ) : (
            <User />
          )}
        </div>
      </div>

      <Tooltip>
        <TooltipTrigger>
          <div
            className="flex-none cursor-pointer border-l border-gray-300 px-5 py-3 dark:border-gray-900"
            onClick={handleTogglePromtbar}
          >
            {showPromptbar ? (
              isMediaQuery('(width <= 767px)') ? (
                <XmarkIcon
                  className="text-gray-500"
                  width={24}
                  height={24}
                  stroke="currentColor"
                />
              ) : (
                <MoveRightIcon
                  className="text-gray-500 hover:text-violet"
                  width={24}
                  height={24}
                  stroke="currentColor"
                />
              )
            ) : (
              <MoveLeftIcon
                className="text-gray-500 hover:text-violet"
                width={24}
                height={24}
                stroke="currentColor"
              />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {showPromptbar ? t('Close prompt menu') : t('Open prompt menu')}
        </TooltipContent>
      </Tooltip>
      <SettingDialog open={isUserSettingsOpen} onClose={onClose} />
    </div>
  );
};
export default Header;
