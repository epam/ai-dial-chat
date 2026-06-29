import type { ApplicationSchemaSummaryDto } from '@epam/chat-api-client';
import type { FC } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { AppsEditorI18nKeys } from '../../constants/translation-keys';
import AppEditorIframe from './AppEditorIframe';

interface Props {
  schema: ApplicationSchemaSummaryDto | undefined;
  appId: string;
}

const SettingsStep: FC<Props> = ({ schema, appId }) => {
  const { t } = useTranslation();

  if (schema?.editorUrl) {
    return <AppEditorIframe schema={schema} appId={appId} />;
  }

  return (
    <p className="flex h-full w-full items-center justify-center text-secondary">
      {t(AppsEditorI18nKeys.SettingsStepNoEditorPlaceholder)}
    </p>
  );
};

export default memo(SettingsStep);
