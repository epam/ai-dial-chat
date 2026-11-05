import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ErrorMessageNotification,
  NeutralButton,
} from '@epam/ai-dial-ui-kit';
import { IconCopy } from '@tabler/icons-react';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ConversationPanelI18nKeys } from '../../constants/translation-keys';

interface ConversationReadOnlyFooterProps {
  duplicateError?: string;
  /* The conversation's model is unavailable, so it cannot be duplicated. */
  isDuplicateUnavailable?: boolean;
  onDuplicateConversation?: () => void;
}

/**
 * Shown in place of the composer for a read-only (shared or published)
 * conversation: the duplicate action, or why it is unavailable, and any
 * duplicate error. Presentational.
 */
const ConversationReadOnlyFooter: FC<ConversationReadOnlyFooterProps> = ({
  duplicateError,
  isDuplicateUnavailable,
  onDuplicateConversation,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center gap-2 p-4">
      {duplicateError && <ErrorMessageNotification message={duplicateError} />}
      {isDuplicateUnavailable ? (
        <p className="dial-small-text text-center text-secondary">
          {t(ConversationPanelI18nKeys.DuplicateUnavailableModel)}
        </p>
      ) : (
        <NeutralButton
          label={t(ConversationPanelI18nKeys.DuplicateReadOnlyDescription)}
          iconBefore={
            <IconCopy size={DIAL_ICON_SIZE.MD} stroke={DIAL_KIT_ICON_STROKE} />
          }
          onClick={onDuplicateConversation}
        />
      )}
    </div>
  );
};

export default ConversationReadOnlyFooter;
