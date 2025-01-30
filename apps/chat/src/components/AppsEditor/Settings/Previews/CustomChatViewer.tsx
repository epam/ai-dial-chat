import { useCallback } from 'react';

import { Conversation } from '@/src/types/chat';

import { useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { IframeRenderer } from '@/src/components/IframeRenderer';

interface Props {
  id: string;
  conversation: Conversation;
  currentProviderId: string;
  customViewerUrl: string;
  title: string;
}

export const CustomChatViewer: React.FC<Props> = ({
  id,
  currentProviderId,
  customViewerUrl,
  conversation,
  title,
}) => {
  const theme = useAppSelector(UISelectors.selectThemeState);

  const generateTargetUrl = useCallback(() => {
    try {
      const iframeUrl = `${customViewerUrl}?authProvider=${currentProviderId}&conversationId=${encodeURIComponent(conversation.id)}&id=${encodeURIComponent(id)}&theme=${theme}`;
      return new URL(iframeUrl);
    } catch (error) {
      console.error('Error generating target URL', error);
    }
  }, [customViewerUrl, id, currentProviderId, theme, conversation.id]);

  return (
    <div className="size-full">
      {generateTargetUrl()?.href && (
        <IframeRenderer
          iframeUrl={generateTargetUrl()?.href ?? ''}
          title={title}
          width="100%"
          height="100%"
          targetOrigin={generateTargetUrl()?.origin}
          onMessage={() => null}
          containerClassName="w-full h-full border-none"
          conversationId={conversation.id}
        />
      )}
    </div>
  );
};
