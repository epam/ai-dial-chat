import { useCallback } from 'react';

import { Conversation } from '@/src/types/chat';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { IframeRenderer } from '@/src/components/IframeRenderer';

interface Props {
  id: string;
  conversation: Conversation;
  customViewerUrl: string;
  title: string;
}

export const CustomChatViewer: React.FC<Props> = ({
  id,
  customViewerUrl,
  conversation,
  title,
}) => {
  const theme = useAppSelector(UISelectors.selectThemeState);
  const providerId = useAppSelector(SettingsSelectors.selectProviderId);

  const generateTargetUrl = useCallback(() => {
    try {
      const iframeUrl = `${customViewerUrl}?authProvider=${providerId}&conversationId=${encodeURIComponent(conversation.id)}&id=${encodeURIComponent(id)}&theme=${theme}`;
      return new URL(iframeUrl);
    } catch (error) {
      console.error('Error generating target URL', error);
    }
  }, [customViewerUrl, id, providerId, theme, conversation.id]);

  return (
    <div className="size-full">
      {generateTargetUrl()?.href && (
        <IframeRenderer
          iframeUrl={generateTargetUrl()?.href ?? ''}
          title={title}
          width="100%"
          height="100%"
          targetOrigin={generateTargetUrl()?.origin}
          containerClassName="w-full h-full border-none"
          conversationId={conversation.id}
        />
      )}
    </div>
  );
};
