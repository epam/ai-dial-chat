import { useRouter } from 'next/router';

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
  const isActiveNewConversationRequest = useAppSelector(
    ConversationsSelectors.selectIsActiveNewConversationRequest,
  );
  const customLogo = useAppSelector(UISelectors.selectCustomLogo);
  const isCustomLogoFeatureEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.CustomLogo),
  );

  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );

  const customLogoUrl =
    isCustomLogoFeatureEnabled &&
    customLogo &&
    `/api/${ApiUtils.encodeApiUrl(customLogo)}`;

  const createNewConversation = () => {
    if (!areConversationsLoaded || isActiveNewConversationRequest) return;
    dispatch(
      ConversationsActions.createNewConversations({
        names: [DEFAULT_CONVERSATION_NAME],
      }),
    );
    dispatch(ConversationsActions.resetSearch());
  };

  const handleLogoClick = () => {
    if (router.route === '/') createNewConversation();
    else {
      router.push('/').then(createNewConversation);
    }
  };

  return (
    <button
      onClick={handleLogoClick}
      disabled={messageIsStreaming}
      className="mx-auto min-w-[110px] bg-contain bg-center bg-no-repeat disabled:cursor-not-allowed md:ml-5 lg:bg-left"
      style={{
        backgroundImage: customLogoUrl
          ? `url(${cssEscape(customLogoUrl)})`
          : `var(--app-logo)`,
      }}
    ></button>
  );
};
