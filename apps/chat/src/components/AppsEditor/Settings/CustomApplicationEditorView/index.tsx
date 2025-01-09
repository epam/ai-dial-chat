import { useCallback } from 'react';

import { useRouter } from 'next/router';

import { IframeRenderer } from '@/src/components/IframeRenderer';

interface Props {
  id: string;
  currentProviderId: string;
  host: string;
}

export const CustomApplicationEditorView: React.FC<Props> = ({
  id,
  currentProviderId,
  host,
}) => {
  const router = useRouter();

  const generateTargetUrl = useCallback(() => {
    try {
      const iframeUrl = `${host}?authProvider=${currentProviderId}&id=${id}`;
      return new URL(iframeUrl);
    } catch (error) {
      router.push('/404');
    }
  }, [host, id, currentProviderId, router]);

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
