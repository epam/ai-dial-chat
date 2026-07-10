import { mergeClasses } from '@epam/ai-dial-chat-shared';
import type { ApplicationSchemaSummaryDto } from '@epam/chat-api-client';
import { forwardRef, memo, useImperativeHandle, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AppsEditorI18nKeys } from '../../constants/translation-keys';
import type { AppEditorIframeHandle } from './AppEditorIframe';
import AppEditorIframe from './AppEditorIframe';
import AppPreviewChat from './AppPreviewChat';

export interface SettingsStepHandle {
  triggerSave: () => void;
}

interface Props {
  schema: ApplicationSchemaSummaryDto | undefined;
  appId: string;
  appDisplayName?: string;
  appIconUrl?: string;
  isPreviewing?: boolean;
  onSaveSuccess?: () => void;
  onSaveError?: (error: string) => void;
}

const SettingsStep = forwardRef<SettingsStepHandle, Props>(
  function SettingsStep(
    {
      schema,
      appId,
      appDisplayName,
      appIconUrl,
      isPreviewing = false,
      onSaveSuccess,
      onSaveError,
    },
    ref,
  ) {
    const { t } = useTranslation();
    const iframeRef = useRef<AppEditorIframeHandle>(null);

    useImperativeHandle(
      ref,
      () => ({
        triggerSave: () => iframeRef.current?.triggerSave(),
      }),
      [],
    );

    if (schema?.editorUrl) {
      return (
        <div className="relative size-full">
          <div className={mergeClasses('size-full', isPreviewing && 'hidden')}>
            <AppEditorIframe
              ref={iframeRef}
              schema={schema}
              appId={appId}
              onSaveSuccess={onSaveSuccess}
              onSaveError={onSaveError}
            />
          </div>
          {appId && (
            <div
              className={mergeClasses(
                'absolute inset-0 size-full',
                !isPreviewing && 'hidden',
              )}
            >
              <AppPreviewChat
                appId={appId}
                appDisplayName={appDisplayName ?? schema.displayName}
                appIconUrl={appIconUrl ?? schema.iconUrl}
              />
            </div>
          )}
        </div>
      );
    }

    return (
      <p className="flex h-full w-full items-center justify-center text-secondary">
        {t(AppsEditorI18nKeys.SettingsStepNoEditorPlaceholder)}
      </p>
    );
  },
);

export default memo(SettingsStep);
