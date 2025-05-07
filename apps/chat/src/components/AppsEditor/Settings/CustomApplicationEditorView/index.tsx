import { useCallback } from 'react';

import { useRouter } from 'next/router';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { Routes } from '@/src/constants/routes';

import { IframeRenderer } from '@/src/components/IframeRenderer';

interface Props {
  id: string;
  host: string;
  theme: string;
  title: string;
}

export const CustomApplicationEditorView: React.FC<Props> = ({
  id,
  host,
  theme,
  title,
}) => {
  const providerId = useAppSelector(SettingsSelectors.selectProviderId);
  const router = useRouter();

  const generateTargetUrl = useCallback(() => {
    try {
      const iframeUrl = `${host}?authProvider=${providerId}&id=${encodeURIComponent(id)}&theme=${theme}`;
      return new URL(iframeUrl);
    } catch (error) {
      router.push(Routes.NotFound);
    }
  }, [host, id, providerId, router, theme]);

  return (
    <div className="size-full">
      <IframeRenderer
        iframeUrl={generateTargetUrl()?.href ?? ''}
        title={title}
        width="100%"
        height="100%"
        containerClassName="w-full h-full border-none transition-all"
      />
    </div>
  );
};
