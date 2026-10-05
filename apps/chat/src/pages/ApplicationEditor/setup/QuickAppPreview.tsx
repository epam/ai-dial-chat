import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  GhostIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconArrowNarrowLeft } from '@tabler/icons-react';
import type { FC } from 'react';
import { memo, useEffect, useMemo, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { CONFIRMATION_BOLD_COMPONENTS } from '../../../constants/confirmation-copy';
import { AppsEditorI18nKeys } from '../../../constants/translation-keys';
import { useDeployments } from '../../../context/DeploymentsContext';
import type { ApplicationPreviewProps } from '../../../models/application-editor';
import { AppsEditorQuery } from '../../../types/apps-editor';
import AppPreviewChat from './AppPreviewChat';

type Props = ApplicationPreviewProps;

const QuickAppPreview: FC<Props> = ({ appId, metadata, isVisible, onExit }) => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { schemas } = useDeployments();
  const schemaId = searchParams.get(AppsEditorQuery.Schema) ?? '';
  const schema = useMemo(
    () => schemas.find((item) => item.id === schemaId),
    [schemas, schemaId],
  );
  const appDisplayName = metadata.name || schema?.displayName || '';
  const appIconUrl = metadata.iconUrl || schema?.iconUrl;

  const backButtonRef = useRef<HTMLButtonElement>(null);
  // Moves focus into the preview as it opens, so it is not lost with the hidden editor.
  useEffect(() => {
    if (isVisible) backButtonRef.current?.focus();
  }, [isVisible]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only">{t(AppsEditorI18nKeys.PreviewBannerLabel)}</h1>
      <div className="flex items-center gap-2 border-b border-tertiary px-4 py-2 desktop:px-8 desktop:pb-3 desktop:pt-3">
        <GhostIconButton
          ref={backButtonRef}
          icon={
            <IconArrowNarrowLeft
              size={DIAL_ICON_SIZE.LG}
              stroke={DIAL_KIT_ICON_STROKE}
              aria-hidden
              className="rtl:scale-x-[-1]"
            />
          }
          aria-label={t(AppsEditorI18nKeys.PreviewBackToSetup)}
          onClick={onExit}
        />
        <h1 className="dial-h2-text min-w-0 truncate">
          {t(AppsEditorI18nKeys.PreviewBackToSetup)}
        </h1>
      </div>
      <p className="dial-small-text flex shrink-0 flex-wrap items-baseline justify-center gap-x-2 bg-control-accent-alpha px-4 py-2 text-center text-primary">
        <span aria-hidden className="dial-tiny-lead-semi-text text-accent">
          {t(AppsEditorI18nKeys.PreviewBannerLabel)}
        </span>
        <span>
          <Trans
            i18nKey={AppsEditorI18nKeys.PreviewBannerText}
            values={{ name: appDisplayName }}
            components={CONFIRMATION_BOLD_COMPONENTS}
          />
        </span>
      </p>
      <div className="relative min-h-0 flex-1">
        {/* Absolutely positioned, so the chat gets a definite height to fill. */}
        <div className="absolute inset-0">
          <AppPreviewChat
            appId={appId}
            appDisplayName={appDisplayName}
            appIconUrl={appIconUrl}
          />
        </div>
      </div>
    </div>
  );
};

export default memo(QuickAppPreview);
