import { useContext } from 'react';

import { isMediaQuery } from '@/utils/app/styleHelpers';

import HomeContext from '@/pages/api/home/home.context';

import MoveLeftIcon from '../../public/images/icons/move-left.svg';
import MoveRightIcon from '../../public/images/icons/move-right.svg';
import { SettingDialog } from '../Settings/SettingDialog';
import { User } from './User';

const Header = () => {
  const {
    state: { showChatbar, showPromptbar, isUserSettingsOpen },
    dispatch: homeDispatch,
  } = useContext(HomeContext);

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
    }
    homeDispatch({ field: 'showPromptbar', value: !showPromptbar });
    localStorage.setItem('showPromptbar', JSON.stringify(!showPromptbar));
  };

  const onClose = () => {
    homeDispatch({ field: 'isUserSettingsOpen', value: false });
  };
  return (
    <div className="flex h-[48px] w-full border-b border-gray-300 bg-gray-100 dark:border-gray-900 dark:bg-gray-700">
      <div
        className="flex-none cursor-pointer border-r border-gray-300 px-5 py-3 dark:border-gray-900"
        onClick={handleToggleChatbar}
      >
        {showChatbar ? (
          <MoveLeftIcon
            className="text-gray-500 dark:text-gray-200"
            width={24}
            height={24}
            stroke="currentColor"
          />
        ) : (
          <MoveRightIcon
            className="text-gray-500 dark:text-gray-200"
            width={24}
            height={24}
            stroke="currentColor"
          />
        )}
      </div>
      <div className="flex grow">
        <span
          className="min-w-[195px] bg-center bg-no-repeat invert"
          style={{
            backgroundImage: `var(--app-logo)`,
          }}
        ></span>
        <div className="grow"></div>
        <div className="align-center  flex min-w-[195px]">
          <User />
        </div>
      </div>

      <div
        className="flex-none cursor-pointer border-l border-gray-300 px-5 py-3 dark:border-gray-900"
        onClick={handleTogglePromtbar}
      >
        {showPromptbar ? (
          <MoveRightIcon
            className="text-gray-500 dark:text-gray-200"
            width={24}
            height={24}
            stroke="currentColor"
          />
        ) : (
          <MoveLeftIcon
            className="text-gray-500 dark:text-gray-200"
            width={24}
            height={24}
            stroke="currentColor"
          />
        )}
      </div>
      <SettingDialog open={isUserSettingsOpen} onClose={onClose} />
    </div>
  );
};
export default Header;
