import { useCallback } from 'react';

import { useRouter } from 'next/router';

import { IframeRenderer } from '@/src/components/IframeRenderer';

interface Props {
  id: string;
  currentProviderId: string;
  host: string;
  theme: string;
}

export const CustomApplicationEditorView: React.FC<Props> = ({
  id,
  currentProviderId,
  host,
  theme,
}) => {
  const router = useRouter();

  const generateTargetUrl = useCallback(() => {
    try {
      const iframeUrl = `${host}?authProvider=${currentProviderId}&id=${encodeURIComponent(id)}&theme=${theme}`;
      return new URL(iframeUrl);
    } catch (error) {
      router.push('/404');
    }
  }, [host, id, currentProviderId, router, theme]);

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
