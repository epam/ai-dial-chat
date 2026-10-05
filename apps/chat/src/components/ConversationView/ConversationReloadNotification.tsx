import { Button, ButtonAppearance, ButtonVariant } from '@epam/ai-dial-ui-kit';
import { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatI18nKeys } from '../../constants/translation-keys';

interface ConversationReloadNotificationProps {
  isReloading: boolean;
  isStreaming: boolean;
  onRetry: () => Promise<void>;
}

/** Transient read failure with a read-only recovery action. */
export const ConversationReloadNotification: FC<
  ConversationReloadNotificationProps
> = ({ isReloading, isStreaming, onRetry }) => {
  const { t } = useTranslation();
  const handleRetry = () => {
    void onRetry();
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded border border-primary p-4 text-start">
      <div role="status" aria-live="polite" className="min-w-0 break-words">
        <p>{t(ChatI18nKeys.ConversationReloadErrorTitle)}</p>
        <p>{t(ChatI18nKeys.ConversationReloadError)}</p>
      </div>
      <Button
        variant={ButtonVariant.Neutral}
        appearance={ButtonAppearance.Outlined}
        label={t(ChatI18nKeys.RetryConversationReload)}
        className="min-h-11 min-w-11"
        disabled={isReloading || isStreaming}
        onClick={handleRetry}
      />
    </div>
  );
};
