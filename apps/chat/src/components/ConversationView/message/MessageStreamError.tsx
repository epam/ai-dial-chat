import {
  Button,
  ButtonAppearance,
  ButtonVariant,
  ElementSize,
  ErrorMessageNotification,
} from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  ChatI18nKeys,
} from '../../../constants/translation-keys';
import type { ConversationMessageItemProps } from '../ConversationMessageItem';

interface MessageStreamErrorProps extends Pick<
  ConversationMessageItemProps,
  'msg' | 'isAssistantTyping'
> {
  isStreamErrorRetryShown: boolean;
  handleStreamErrorRetry: () => void;
}

/**
 * The stream-error banner under an assistant message, with a retry button
 * while retrying is possible. Presentational and private to
 * `ConversationMessageItem`.
 */
const MessageStreamError: FC<MessageStreamErrorProps> = ({
  msg,
  isAssistantTyping,
  isStreamErrorRetryShown,
  handleStreamErrorRetry,
}) => {
  const { t } = useTranslation();

  return (
    <div className="w-full">
      <ErrorMessageNotification
        title={t(ChatI18nKeys.StreamErrorTitle)}
        message={
          <span className="flex flex-wrap items-center justify-between gap-2 text-start">
            <span className="min-w-0 wrap-anywhere">
              {msg.streamErrorMessage || t(ChatI18nKeys.StreamError)}
            </span>
            {isStreamErrorRetryShown && (
              <Button
                variant={ButtonVariant.Neutral}
                appearance={ButtonAppearance.Outlined}
                size={ElementSize.Small}
                label={t(ButtonsI18nKeys.TryAgain)}
                disabled={isAssistantTyping}
                onClick={handleStreamErrorRetry}
              />
            )}
          </span>
        }
      />
    </div>
  );
};

export default MessageStreamError;
