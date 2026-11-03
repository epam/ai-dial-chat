import { findDeploymentByIdOrReference } from '@epam/ai-dial-chat-hooks';
import { Tooltip } from '@epam/ai-dial-ui-kit';
import { useTranslation } from 'react-i18next';
import { ScheduledTasksI18nKeys } from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import { resolveLocalizedText } from '../../utils/locale';
import { useLanguage } from '../language/useLanguage';

/** Resolves the saved deployment after catalog loading, without treating catalog errors as deletion. */
export const useScheduledTaskModelPreview = (modelId?: string) => {
  const { items, isLoading, error } = useDeployments();
  const { language } = useLanguage();
  const { t } = useTranslation();
  const deployment = findDeploymentByIdOrReference(items, modelId);
  const isUnavailable = Boolean(modelId && !isLoading && !error && !deployment);
  let modelDisplayName: string | undefined;
  if (modelId && !isLoading) {
    if (deployment) {
      modelDisplayName =
        resolveLocalizedText(deployment.displayName, language) || modelId;
    } else if (isUnavailable) {
      let name = modelId.replace(/\/+$/, '').split('/').pop() || modelId;
      try {
        name = decodeURIComponent(name);
      } catch {
        /* Preserve malformed escapes. */
      }
      modelDisplayName = t(ScheduledTasksI18nKeys.UnavailableModelName, {
        name,
      });
    } else {
      modelDisplayName = modelId;
    }
  }
  const renderModelName = (name: string) =>
    isUnavailable ? (
      <Tooltip
        tooltip={t(ScheduledTasksI18nKeys.UnavailableModelTooltip)}
        asChild
      >
        <span tabIndex={0} className="cursor-pointer text-error">
          {name}
        </span>
      </Tooltip>
    ) : (
      name
    );
  return { modelDisplayName, renderModelName, isUnavailable, isLoading };
};
