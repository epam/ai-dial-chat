import type {
  MessageActionAriaLabels,
  MessageActionTooltips,
} from '@epam/ai-dial-conversation-messages';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  ConversationI18nKeys,
} from '../../constants/translation-keys';
import type { useDeployments } from '../../context/DeploymentsContext';
import { useLanguage } from '../../hooks/language/useLanguage';
import { resolveCatalogIconUrl } from '../../utils/icon-path';
import { resolveLocalizedText } from '../../utils/locale';

interface UseMessageListLabelsParams {
  items: ReturnType<typeof useDeployments>['items'];
}

/**
 * Labels the message list renders: per-deployment display names and icons
 * for message headers, the message-action tooltips and aria labels, and the
 * model-changed status and stage-step text. Reads the i18n and language
 * contexts itself.
 */
export const useMessageListLabels = ({ items }: UseMessageListLabelsParams) => {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const deploymentLookup = useMemo<
    Record<string, { displayName: string; iconUrl: string | undefined }>
  >(
    () =>
      Object.fromEntries(
        items.map((d) => [
          d.id,
          {
            displayName: resolveLocalizedText(d.displayName, language),
            iconUrl: resolveCatalogIconUrl(d.iconUrl),
          },
        ]),
      ),
    [items, language],
  );

  const tooltips = useMemo<MessageActionTooltips>(
    () => ({
      edit: t(ButtonsI18nKeys.Edit),
      delete: t(ButtonsI18nKeys.Delete),
      regenerate: t(ButtonsI18nKeys.Regenerate),
      copy: t(ButtonsI18nKeys.CopyText),
      copyMessage: t(ButtonsI18nKeys.CopyMessage),
      copied: t(ButtonsI18nKeys.Copied),
      copyMarkdown: t(ButtonsI18nKeys.CopyAsMarkdown),
      copiedMarkdown: t(ButtonsI18nKeys.Copied),
      like: t(ButtonsI18nKeys.Like),
      dislike: t(ButtonsI18nKeys.Dislike),
    }),
    [t],
  );

  const ariaLabels = useMemo<MessageActionAriaLabels>(
    () => ({
      editMessage: t(ButtonsI18nKeys.EditMessage),
      deleteMessage: t(ButtonsI18nKeys.DeleteMessage),
      regenerateResponse: t(ButtonsI18nKeys.RegenerateResponse),
      copyResponse: t(ButtonsI18nKeys.CopyResponse),
      copyMessage: t(ButtonsI18nKeys.CopyMessage),
      copiedMessageStatus: t(ButtonsI18nKeys.MessageCopiedStatus),
      copiedStatus: t(ButtonsI18nKeys.ResponseCopiedStatus),
      copiedMarkdownStatus: t(ButtonsI18nKeys.MarkdownCopiedStatus),
      actionsGroup: t(ButtonsI18nKeys.MessageActionsGroup),
      copyAsMarkdown: t(ButtonsI18nKeys.CopyAsMarkdown),
      likeResponse: t(ButtonsI18nKeys.LikeResponse),
      dislikeResponse: t(ButtonsI18nKeys.DislikeResponse),
    }),
    [t],
  );

  const formatStatusModelChangedBody = useCallback(
    (from: string, to: string) =>
      t(ConversationI18nKeys.StatusModelChangedBody, {
        from,
        to,
      }),
    [t],
  );

  const stepsLabel = useCallback(
    (count: number) => t(ConversationI18nKeys.StagesStep, { count }),
    [t],
  );

  return {
    deploymentLookup,
    tooltips,
    ariaLabels,
    formatStatusModelChangedBody,
    stepsLabel,
  };
};
