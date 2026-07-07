import { DialSpinner } from '@epam/ai-dial-ui-kit';
import type { ApplicationSchemaSummaryDto } from '@epam/chat-api-client';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { AppsEditorI18nKeys } from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { useTheme } from '../../context/ThemeContext';
import { AppsEditorEvent } from '../../types/apps-editor';

export interface AppEditorIframeHandle {
  triggerSave: () => void;
}

interface Props {
  schema: ApplicationSchemaSummaryDto;
  appId: string;
  onUpdated?: () => void;
  onSaveSuccess?: () => void;
  onSaveError?: (error: string) => void;
}

const AppEditorIframe = forwardRef<AppEditorIframeHandle, Props>(
  function AppEditorIframe(
    { schema, appId, onUpdated, onSaveSuccess, onSaveError },
    ref,
  ) {
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
        if (
          !schema.editorUrl ||
          event.origin !== new URL(schema.editorUrl).origin
        )
          return;
        const displayName = schema.displayName ?? '';
        if (
          event.data?.type ===
          `${displayName}/${AppsEditorEvent.ReadyToInteract}`
        ) {
          setIsLoading(false);
        } else if (
          event.data?.type ===
          `${displayName}/${AppsEditorEvent.UpdatedSuccess}`
        ) {
          onUpdated?.();
        } else if (event.data?.type === AppsEditorEvent.SaveSuccess) {
          onSaveSuccess?.();
        } else if (event.data?.type === AppsEditorEvent.SaveError) {
          onSaveError?.(event.data?.error ?? '');
        }
      },
      [
        schema.editorUrl,
        schema.displayName,
        onUpdated,
        onSaveSuccess,
        onSaveError,
      ],
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

    useImperativeHandle(
      ref,
      () => ({
        triggerSave: () => {
          if (!schema.editorUrl) return;
          iframeRef.current?.contentWindow?.postMessage(
            { type: AppsEditorEvent.TriggerSave },
            new URL(schema.editorUrl).origin,
          );
        },
      }),
      [schema.editorUrl],
    );

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
  },
);

export default memo(AppEditorIframe);
