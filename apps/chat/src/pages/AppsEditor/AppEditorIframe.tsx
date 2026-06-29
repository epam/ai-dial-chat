import { DialSpinner } from '@epam/ai-dial-ui-kit';
import type { ApplicationSchemaSummaryDto } from '@epam/chat-api-client';
import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  READY_TO_INTERACT_EVENT,
  UPDATED_SUCCESS_EVENT,
} from '../../constants/apps-editor';
import { AppsEditorI18nKeys } from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { useTheme } from '../../context/ThemeContext';

interface Props {
  schema: ApplicationSchemaSummaryDto;
  appId: string;
  onUpdated?: () => void;
}

const AppEditorIframe: FC<Props> = ({ schema, appId, onUpdated }) => {
  const { t } = useTranslation();
  const { user } = useUser();
  const { currentTheme } = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const iframeUrl = useMemo(() => {
    const providerId = user?.providerId ?? '';
    const params = new URLSearchParams({
      authProvider: providerId,
      id: appId,
      theme: currentTheme,
    });
    return `${schema.editorUrl}?${params.toString()}`;
  }, [schema.editorUrl, appId, user?.providerId, currentTheme]);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      const displayName = schema.displayName ?? '';
      if (event.data?.type === `${displayName}/${READY_TO_INTERACT_EVENT}`) {
        setIsLoading(false);
      } else if (
        event.data?.type === `${displayName}/${UPDATED_SUCCESS_EVENT}`
      ) {
        onUpdated?.();
      }
    },
    [schema.displayName, onUpdated],
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleMessage]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const handleLoad = () => setIsLoading(false);
    iframe.addEventListener('load', handleLoad);
    return () => {
      iframe.removeEventListener('load', handleLoad);
    };
  }, [iframeUrl]);

  return (
    <div className="relative size-full">
      {isLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-layer-1"
          aria-label={t(AppsEditorI18nKeys.SettingsStepLoadingLabel)}
          aria-live="polite"
        >
          <DialSpinner />
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={iframeUrl}
        title={schema.displayName}
        className="size-full border-none"
      />
    </div>
  );
};

export default memo(AppEditorIframe);
