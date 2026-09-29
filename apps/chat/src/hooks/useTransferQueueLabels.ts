import type { TransferQueueLabels } from '@epam/ai-dial-ui-kit';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  ConversationExportI18nKeys,
} from '../constants/translation-keys';

/**
 * Returns the translated, direction-agnostic chrome of every `TransferQueue`
 * in the app — collapse/expand/close, the close confirmation, the canceled and
 * completed row labels, and the aggregate progress readout. Each queue adds
 * its own per-row strings on top. The strings live once under the export key
 * set rather than being duplicated per queue.
 */
export const useTransferQueueLabels = (): Partial<TransferQueueLabels> => {
  const { t } = useTranslation();

  return useMemo(
    () => ({
      canceledLabel: t(ConversationExportI18nKeys.CanceledLabel),
      successLabel: t(ConversationExportI18nKeys.SucceededLabel),
      collapseAriaLabel: t(ConversationExportI18nKeys.CollapseQueueAriaLabel),
      expandAriaLabel: t(ConversationExportI18nKeys.ExpandQueueAriaLabel),
      closeAriaLabel: t(ConversationExportI18nKeys.CloseQueueAriaLabel),
      closeConfirmHeader: t(ConversationExportI18nKeys.CloseQueueConfirmHeader),
      closeConfirmDescriptionInProgress: t(
        ConversationExportI18nKeys.CloseQueueConfirmDescriptionInProgress,
      ),
      closeConfirmDescriptionFailed: t(
        ConversationExportI18nKeys.CloseQueueConfirmDescriptionFailed,
      ),
      closeConfirmDescriptionMixed: t(
        ConversationExportI18nKeys.CloseQueueConfirmDescriptionMixed,
      ),
      closeConfirmLabel: t(ButtonsI18nKeys.Close),
      closeCancelLabel: t(ButtonsI18nKeys.Cancel),
      queueProgressValueText: (completed: number, total: number) =>
        t(ConversationExportI18nKeys.QueueProgressValueText, {
          completed,
          count: total,
        }),
    }),
    [t],
  );
};
