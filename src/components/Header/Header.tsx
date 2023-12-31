import { IconX } from '@tabler/icons-react';
import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { isMediaQuery } from '@/src/utils/app/style-helpers';

import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import MoveLeftIcon from '../../../public/images/icons/move-left.svg';
import MoveRightIcon from '../../../public/images/icons/move-right.svg';
import Tooltip from '../Common/Tooltip';
import { SettingDialog } from '../Settings/SettingDialog';
import { CreateNewChatMobile } from './CreateNewChatMobile';
import { User } from './User/User';

const Header = () => {
  const showChatbar = useAppSelector(UISelectors.selectShowChatbar);
  const showPromptbar = useAppSelector(UISelectors.selectShowPromptbar);
  const isUserSettingsOpen = useAppSelector(
    UISelectors.selectIsUserSettingsOpen,
  );

  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.SideBar);

  const handleToggleChatbar = useCallback(() => {
    if (!showChatbar && isMediaQuery('(width <= 767px)')) {
      dispatch(UIActions.setShowPromptbar(false));
    }
    dispatch(UIActions.setShowChatbar(!showChatbar));
  }, [dispatch, showChatbar]);

  const handleTogglePromtbar = useCallback(() => {
    if (!showPromptbar && isMediaQuery('(width <= 767px)')) {
      dispatch(UIActions.setShowChatbar(false));
      dispatch(UIActions.setIsProfileOpen(false));
    }
    dispatch(UIActions.setShowPromptbar(!showPromptbar));
  }, [dispatch, showPromptbar]);

  const onClose = () => {
    dispatch(UIActions.setIsUserSettingsOpen(false));
  };

  return (
    <div
      className="z-40 flex h-[48px] w-full border-b border-tertiary bg-layer-3"
      data-qa="header"
    >
      <Tooltip isTriggerClickable tooltip={t('Conversation list')}>
        <div
          className="flex-none cursor-pointer border-r border-tertiary p-3 md:px-5"
          onClick={handleToggleChatbar}
          data-qa="chat-panel-toggle"
        >
          {showChatbar ? (
            <>
              <IconX
                className="text-secondary md:hidden"
                width={24}
                height={24}
              />

              <MoveLeftIcon
                className="text-secondary hover:text-accent-secondary max-md:hidden"
                width={24}
                height={24}
              />
            </>
          ) : (
            <MoveRightIcon
              className="text-secondary hover:text-accent-secondary"
              width={24}
              height={24}
            />
          )}
        </div>
      </Tooltip>
      <CreateNewChatMobile />
      <div className="flex grow justify-between">
        <span
          className="min-w-[110px] grow bg-center bg-no-repeat md:ml-5 md:grow-0 lg:bg-left"
          style={{
            backgroundImage: `var(--app-logo)`,
          }}
        ></span>
        <div className="w-[48px] max-md:border-l max-md:border-tertiary md:w-auto">
          <User />
        </div>
      </div>

      <Tooltip isTriggerClickable tooltip={t('Prompt list')}>
        <div
          className="flex-none cursor-pointer border-l border-tertiary p-3 md:px-5"
          onClick={handleTogglePromtbar}
          data-qa="prompts-panel-toggle"
        >
          {showPromptbar ? (
            <>
              <IconX
                className="text-secondary md:hidden"
                width={24}
                height={24}
              />

              <MoveRightIcon
                className="text-secondary hover:text-accent-tertiary max-md:hidden"
                width={24}
                height={24}
              />
            </>
          ) : (
            <MoveLeftIcon
              className="text-secondary hover:text-accent-tertiary"
              width={24}
              height={24}
            />
          )}
        </div>
      </Tooltip>
      <SettingDialog open={isUserSettingsOpen} onClose={onClose} />
    </div>
  );
};
export default Header;
