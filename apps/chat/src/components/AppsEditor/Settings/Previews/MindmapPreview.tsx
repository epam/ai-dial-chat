import { useCallback } from 'react';

import { IframeRenderer } from '@/src/components/IframeRenderer';

interface Props {
  id: string;
  selectedConversationsId: string;
  currentProviderId: string;
  mindmapHost: string;
}

export const MindmapPreview: React.FC<Props> = ({
  id,
  currentProviderId,
  mindmapHost,
  selectedConversationsId,
}) => {
  const generateTargetUrl = useCallback(() => {
    try {
      const iframeUrl = `${mindmapHost}chat?authProvider=${currentProviderId}&id=${id}&conversationId=${selectedConversationsId}`;
      return new URL(iframeUrl);
    } catch (error) {
      console.error('Error generating target URL', error);
    }
  }, [mindmapHost, id, currentProviderId, selectedConversationsId]);

  return (
    <div className="size-full">
      {generateTargetUrl()?.href && (
        <IframeRenderer
          iframeUrl={generateTargetUrl()?.href ?? ''}
          title={id}
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
