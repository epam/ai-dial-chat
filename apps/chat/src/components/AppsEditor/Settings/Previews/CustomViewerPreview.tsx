import { useCallback } from 'react';

import { IframeRenderer } from '@/src/components/IframeRenderer';

interface Props {
  id: string;
  selectedConversationsId: string;
  currentProviderId: string;
  customViewerUrl: string;
  title: string;
  theme: string;
}

export const CustomViewerPreview: React.FC<Props> = ({
  id,
  currentProviderId,
  customViewerUrl,
  selectedConversationsId,
  title,
  theme,
}) => {
  const generateTargetUrl = useCallback(() => {
    try {
      const iframeUrl = `${customViewerUrl}?authProvider=${currentProviderId}&id=${id}&conversationId=${selectedConversationsId}&theme=${theme}`;
      return new URL(iframeUrl);
    } catch (error) {
      console.error('Error generating target URL', error);
    }
  }, [customViewerUrl, id, currentProviderId, selectedConversationsId, theme]);

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
        />
      )}
    </div>
  );
};
