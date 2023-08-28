import { useTranslation } from 'next-i18next';

import { isMediaQuery } from '@/utils/app/styleHelpers';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { uiActions, uiSelectors } from '@/store/ui-store/ui.reducers';

import MoveLeftIcon from '../../public/images/icons/move-left.svg';
import MoveRightIcon from '../../public/images/icons/move-right.svg';
import XmarkIcon from '../../public/images/icons/xmark.svg';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Common/Tooltip';
import { SettingDialog } from '../Settings/SettingDialog';
import { CreateNewChatMobile } from './CreateNewChatMobile';
import { User } from './User/User';

const Header = () => {
  const showChatbar = useAppSelector(uiSelectors.selectShowChatbar);
  const showPromptbar = useAppSelector(uiSelectors.selectShowPromptbar);
  const isUserSettingsOpen = useAppSelector(
    uiSelectors.selectIsUserSettingsOpen,
  );

  const dispatch = useAppDispatch();

  const { t } = useTranslation('sidebar');

  const handleToggleChatbar = () => {
    if (!showChatbar && isMediaQuery('(width <= 767px)')) {
      dispatch(uiActions.setShowPromptbar(false));
    }
    dispatch(uiActions.setShowChatbar(!showChatbar));
  };
  const handleTogglePromtbar = () => {
    if (!showPromptbar && isMediaQuery('(width <= 767px)')) {
      dispatch(uiActions.setShowChatbar(false));
      dispatch(uiActions.setIsProfileOpen(false));
    }
    dispatch(uiActions.setShowPromptbar(!showPromptbar));
  };

  const onClose = () => {
    dispatch(uiActions.setIsUserSettingsOpen(false));
  };

  return (
    <div className="flex h-[48px] w-full border-b border-gray-300 bg-gray-100 dark:border-gray-900 dark:bg-gray-700">
      <Tooltip isTriggerClickable={true}>
        <TooltipTrigger>
          <div
            className="flex-none cursor-pointer border-r border-gray-300 p-3 dark:border-gray-900 md:px-5"
            onClick={handleToggleChatbar}
          >
            {showChatbar ? (
              <>
                <XmarkIcon
                  className="text-gray-500 md:hidden"
                  width={24}
                  height={24}
                />

                <MoveLeftIcon
                  className="text-gray-500 hover:text-green max-md:hidden"
                  width={24}
                  height={24}
                />
              </>
            ) : (
              <MoveRightIcon
                className="text-gray-500 hover:text-green"
                width={24}
                height={24}
              />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>{t('Conversation list')}</TooltipContent>
      </Tooltip>
      <CreateNewChatMobile />
      <div className="flex grow justify-between">
        <span
          className="min-w-[110px] grow bg-center bg-no-repeat dark:hidden md:ml-5 md:grow-0 lg:bg-left"
          style={{
            backgroundImage: `var(--app-logo)`,
          }}
        ></span>
        <span
          className="hidden min-w-[110px] grow bg-center bg-no-repeat dark:block md:ml-5 md:grow-0 lg:bg-left"
          style={{
            backgroundImage: `var(--app-logo-dark)`,
          }}
        ></span>
        <div className="w-[48px] max-md:border-l max-md:border-gray-300 max-md:dark:border-gray-900 md:w-auto">
          <User />
        </div>
      </div>

      <Tooltip isTriggerClickable={true}>
        <TooltipTrigger>
          <div
            className="flex-none cursor-pointer border-l border-gray-300 p-3 dark:border-gray-900 md:px-5"
            onClick={handleTogglePromtbar}
          >
            {showPromptbar ? (
              <>
                <XmarkIcon
                  className="text-gray-500 md:hidden"
                  width={24}
                  height={24}
                />

                <MoveRightIcon
                  className="text-gray-500 hover:text-violet max-md:hidden"
                  width={24}
                  height={24}
                />
              </>
            ) : (
              <MoveLeftIcon
                className="text-gray-500 hover:text-violet"
                width={24}
                height={24}
              />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>{t('Prompt list')}</TooltipContent>
      </Tooltip>
      <SettingDialog open={isUserSettingsOpen} onClose={onClose} />
    </div>
  );
};
export default Header;
