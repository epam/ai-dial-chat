import { MouseEventHandler } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/router';

import classNames from 'classnames';

import { ApiUtils } from '@/src/utils/server/api';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';

import { Feature } from '@epam/ai-dial-shared';
import cssEscape from 'css.escape';

export const Logo = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const areConversationsLoaded = useAppSelector(
    ConversationsSelectors.areConversationsUploaded,
  );
  const customLogo = useAppSelector(UISelectors.selectCustomLogo);
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );

  const isCustomLogoFeatureEnabled = enabledFeatures.has(Feature.CustomLogo);
  const isNewConversationDisabled = enabledFeatures.has(
    Feature.HideNewConversation,
  );

  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );

  const customLogoUrl =
    isCustomLogoFeatureEnabled &&
    customLogo &&
    `/api/${ApiUtils.encodeApiUrl(customLogo)}`;

  const createNewConversation = () => {
    if (!areConversationsLoaded || isNewConversationDisabled) return;
    dispatch(
      ConversationsActions.createNewConversations({
        names: [DEFAULT_CONVERSATION_NAME],
      }),
    );
    dispatch(ConversationsActions.resetSearch());
  };

  const handleLogoClick: MouseEventHandler<HTMLAnchorElement> = (e) => {
    if (messageIsStreaming) return e.preventDefault();
    if (router.route === '/') {
      e.preventDefault();
    }
    createNewConversation();
  };

  return (
    <Link
      href={'/'}
      shallow
      onClick={handleLogoClick}
      className={classNames(
        'mx-auto min-w-[110px] bg-contain bg-center bg-no-repeat md:ml-5 lg:bg-left',
        messageIsStreaming && 'cursor-not-allowed',
      )}
      style={{
        backgroundImage: customLogoUrl
          ? `url(${cssEscape(customLogoUrl)})`
          : `var(--app-logo)`,
      }}
      data-qa="logo"
    ></Link>
  );
};
