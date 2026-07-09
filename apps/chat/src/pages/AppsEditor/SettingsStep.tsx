import type { ApplicationSchemaSummaryDto } from '@epam/chat-api-client';
import { forwardRef, memo, useImperativeHandle, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AppsEditorI18nKeys } from '../../constants/translation-keys';
import type { AppEditorIframeHandle } from './AppEditorIframe';
import AppEditorIframe from './AppEditorIframe';

export interface SettingsStepHandle {
  triggerSave: () => void;
}

interface Props {
  schema: ApplicationSchemaSummaryDto | undefined;
  appId: string;
  onSaveSuccess?: () => void;
  onSaveError?: (error: string) => void;
}

const SettingsStep = forwardRef<SettingsStepHandle, Props>(
  function SettingsStep({ schema, appId, onSaveSuccess, onSaveError }, ref) {
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
        <AppEditorIframe
          ref={iframeRef}
          schema={schema}
          appId={appId}
          onSaveSuccess={onSaveSuccess}
          onSaveError={onSaveError}
        />
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
