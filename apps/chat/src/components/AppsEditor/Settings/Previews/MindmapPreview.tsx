import { useCallback } from 'react';

import { useRouter } from 'next/router';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';

import { IframeRenderer } from '@/src/components/IframeRenderer';

interface Props {
  id: string;
  currentProviderId: string;
  mindmapHost: string;
}

export const MindmapPreview: React.FC<Props> = ({
  id,
  currentProviderId,
  mindmapHost,
}) => {
  const router = useRouter();
  const [selectedConversationsId] = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );
  const generateTargetUrl = useCallback(() => {
    try {
      const iframeUrl = `${mindmapHost}chat?authProvider=${currentProviderId}&id=${id}${selectedConversationsId.endsWith('preview conversation') ? `&conversationId=${selectedConversationsId}` : ''}`;
      return new URL(iframeUrl);
    } catch (error) {
      router.push('/404');
    }
  }, [mindmapHost, id, currentProviderId, router, selectedConversationsId]);

  return (
    <div className="size-full">
      <IframeRenderer
        iframeUrl={generateTargetUrl()?.href ?? ''}
        title={id}
        width="100%"
        height="100%"
        targetOrigin={generateTargetUrl()?.origin}
        onMessage={() => null}
        containerClassName="w-full h-full border-none"
      />
    </div>
  );
};
