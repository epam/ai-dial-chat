import { IconX } from '@tabler/icons-react';
import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { isSmallScreen } from '@/src/utils/app/mobile';
import { ApiUtils } from '@/src/utils/server/api';

import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import { HEADER_TITLE_TEXT } from '@/src/constants/chat';

import MoveLeftIcon from '../../../public/images/icons/move-left.svg';
import MoveRightIcon from '../../../public/images/icons/move-right.svg';
import PrimaryLogo from '../../../public/images/icons/primary-logo.svg';
import SecondaryLogo from '../../../public/images/icons/secondary-logo.svg';
import Tooltip from '../Common/Tooltip';
import { SettingDialog } from '../Settings/SettingDialog';
import { CreateNewChatMobile } from './CreateNewChatMobile';
import { User } from './User/User';

import { Feature } from '@epam/ai-dial-shared';

const DEFAULT_HEADER_ICON_SIZE = 24;
const OVERLAY_HEADER_ICON_SIZE = 18;

const Header = () => {
  const showChatbar = useAppSelector(UISelectors.selectShowChatbar);
  const showPromptbar = useAppSelector(UISelectors.selectShowPromptbar);
  const isUserSettingsOpen = useAppSelector(
    UISelectors.selectIsUserSettingsOpen,
  );
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const customLogo = useAppSelector(UISelectors.selectCustomLogo);
  const isCustomLogoFeatureEnabled: boolean = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.CustomLogo),
  );
  const customLogoUrl =
    isCustomLogoFeatureEnabled &&
    customLogo &&
    `api/${ApiUtils.encodeApiUrl(customLogo)}`;

  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.SideBar);
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );

  const handleToggleChatbar = useCallback(() => {
    if (!showChatbar && isSmallScreen()) {
      dispatch(UIActions.setShowPromptbar(false));
      dispatch(UIActions.setIsProfileOpen(false));
    }
    dispatch(UIActions.setShowChatbar(!showChatbar));
  }, [dispatch, showChatbar]);

  const handleTogglePromtbar = useCallback(() => {
    if (!showPromptbar && isSmallScreen()) {
      dispatch(UIActions.setShowChatbar(false));
      dispatch(UIActions.setIsProfileOpen(false));
    }
    dispatch(UIActions.setShowPromptbar(!showPromptbar));
  }, [dispatch, showPromptbar]);

  const onClose = () => {
    dispatch(UIActions.setIsUserSettingsOpen(false));
  };

  const headerIconSize = isOverlay
    ? OVERLAY_HEADER_ICON_SIZE
    : DEFAULT_HEADER_ICON_SIZE;

  return (
    <div
      className={classNames(
        'z-40 flex w-full border-b border-tertiary bg-layer-3',
        isOverlay ? 'min-h-[36px]' : 'min-h-[48px]',
      )}
      data-qa="header"
    >
      {enabledFeatures.has(Feature.ConversationsSection) && (
        <Tooltip isTriggerClickable tooltip={t('Conversation list')}>
          <div
            className="flex h-full cursor-pointer items-center justify-center border-r border-tertiary px-3 md:px-5"
            onClick={handleToggleChatbar}
            data-qa="chat-panel-toggle"
          >
            {showChatbar ? (
              <>
                <IconX
                  className="md:hidden"
                  width={headerIconSize}
                  height={headerIconSize}
                />

                <MoveLeftIcon
                  className="hover:text-accent-primary max-md:hidden"
                  width={headerIconSize}
                  height={headerIconSize}
                />
              </>
            ) : (
              <MoveRightIcon
                className="hover:text-accent-primary"
                width={headerIconSize}
                height={headerIconSize}
              />
            )}
          </div>
        </Tooltip>
      )}
      {!enabledFeatures.has(Feature.HideNewConversation) && (
        <CreateNewChatMobile iconSize={headerIconSize} />
      )}
      <div className="flex grow justify-between">
        <div className="flex grow justify-center md:justify-start">
          <PrimaryLogo
            className="mr-3 self-center md:ml-5"
            width={31}
            height={30}
          />
          <div className="my-3 border-r border-primary" />
          <SecondaryLogo className="ml-3 self-center" width={25} height={30} />
          <span className="ml-2 flex flex-wrap content-center font-weave text-[22px] font-bold md:mr-3">
            {HEADER_TITLE_TEXT}
          </span>
          <span className="my-3 hidden border-r border-primary md:inline-block" />
          <span className="ml-2 hidden flex-wrap content-center text-s md:flex">
            {t('Your secured IA assistant within Pernod Ricard environment')}
          </span>
        </div>
        <div className="w-[48px] max-md:border-l max-md:border-tertiary md:w-auto">
          <User />
        </div>
      </div>

      {enabledFeatures.has(Feature.PromptsSection) && (
        <Tooltip isTriggerClickable tooltip={t('Prompt list')}>
          <div
            className="flex h-full cursor-pointer items-center justify-center border-l border-tertiary px-3 md:px-5"
            onClick={handleTogglePromtbar}
            data-qa="prompts-panel-toggle"
          >
            {showPromptbar ? (
              <>
                <IconX
                  className="md:hidden"
                  width={headerIconSize}
                  height={headerIconSize}
                />

                <MoveRightIcon
                  className="hover:text-accent-primary max-md:hidden"
                  width={headerIconSize}
                  height={headerIconSize}
                />
              </>
            ) : (
              <MoveLeftIcon
                className="hover:text-accent-primary"
                width={headerIconSize}
                height={headerIconSize}
              />
            )}
          </div>
        </Tooltip>
      )}
      <SettingDialog open={isUserSettingsOpen} onClose={onClose} />
    </div>
  );
};
export default Header;
