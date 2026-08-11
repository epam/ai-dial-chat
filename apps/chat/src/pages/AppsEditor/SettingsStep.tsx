import type { ApplicationSchemaSummaryDto } from '@epam/ai-dial-chat-api-client';
import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { forwardRef, memo, useImperativeHandle, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AppsEditorI18nKeys } from '../../constants/translation-keys';
import type { TriggerSaveGeneralPayload } from '../../types/apps-editor';
import type { AppEditorIframeHandle } from './AppEditorIframe';
import AppEditorIframe from './AppEditorIframe';
import AppPreviewChat from './AppPreviewChat';

export interface SettingsStepHandle {
  triggerSave: (general?: TriggerSaveGeneralPayload) => void;
}

interface Props {
  schema: ApplicationSchemaSummaryDto | undefined;
  appId: string;
  appDisplayName?: string;
  appIconUrl?: string;
  isPreviewing?: boolean;
  onUpdated?: () => void;
  onSaveSuccess?: (hasChanges: boolean) => void;
  onSaveError?: (error: string) => void;
  /** Notifies the host whenever the embedded editor's readiness to save changes (`AppsEditorEvent.ReadyToSave`), not merely UI-rendered readiness. */
  onReadyChange?: (isReady: boolean) => void;
  /** Notifies the host whenever the embedded editor reports the user is logged out (`AppsEditorEvent.LoggedOut`). */
  onLoggedOutChange?: (isLoggedOut: boolean) => void;
  /**
   * Bumped by the host whenever a save reports a real configuration change
   * (`SaveSuccessMessage.hasChanges === true`). Passed as `AppPreviewChat`'s
   * `key`, so it remounts — discarding the previous preview conversation and
   * composer state — the next time the preview pane is shown.
   */
  previewResetKey?: number;
}

const SettingsStep = forwardRef<SettingsStepHandle, Props>(
  function SettingsStep(
    {
      schema,
      appId,
      appDisplayName,
      appIconUrl,
      isPreviewing = false,
      onUpdated,
      onSaveSuccess,
      onSaveError,
      onReadyChange,
      onLoggedOutChange,
      previewResetKey,
    },
    ref,
  ) {
    const { t } = useTranslation();
    const iframeRef = useRef<AppEditorIframeHandle>(null);

    useImperativeHandle(
      ref,
      () => ({
        triggerSave: (general?: TriggerSaveGeneralPayload) =>
          iframeRef.current?.triggerSave(general),
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
              onUpdated={onUpdated}
              onSaveSuccess={onSaveSuccess}
              onSaveError={onSaveError}
              onReadyChange={onReadyChange}
              onLoggedOutChange={onLoggedOutChange}
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
                key={previewResetKey}
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
