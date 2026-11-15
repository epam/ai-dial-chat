import {
  findDeploymentByIdOrReference,
  getQuickAppConversationStarters,
} from '@epam/ai-dial-chat-hooks';
import { useMemo } from 'react';
import { useDeployments } from '../../context/DeploymentsContext';
import { useModelSelectorLabels } from '../../hooks/conversation/useModelSelectorLabels';
import { useLanguage } from '../../hooks/language/useLanguage';
import { resolveCatalogIconUrl } from '../../utils/icon-path';
import { resolveLocalizedText } from '../../utils/locale';

interface UseConversationDeploymentStateParams {
  /* Pinned by the app editor's preview pane; otherwise the selected deployment applies. */
  fixedModel:
    { id: string; displayName?: string; iconUrl?: string } | undefined;
}

/**
 * The deployment a conversation runs on and everything derived from it for
 * the composer: the fixed or selected deployment (localized), whether it is
 * hidden, the deployment id for usage limits, the model-selector items and
 * labels, quick-app starters, and whether the deployment disables input.
 * Reads the deployments and language contexts itself.
 */
export const useConversationDeploymentState = ({
  fixedModel,
}: UseConversationDeploymentStateParams) => {
  const { language } = useLanguage();
  const {
    items,
    selectedItemId,
    setSelectedItemId,
    selectedDeploymentConfiguration,
    isLoading,
    error,
    toolsets,
  } = useDeployments();
  const activeDeploymentId = fixedModel?.id ?? selectedItemId;

  const selectedDeployment = useMemo(() => {
    const deployment = findDeploymentByIdOrReference(items, activeDeploymentId);
    return deployment
      ? {
          ...deployment,
          displayName: resolveLocalizedText(deployment.displayName, language),
          description: resolveLocalizedText(deployment.description, language),
        }
      : undefined;
  }, [items, activeDeploymentId, language]);
  /*
   * A model hidden through HIDDEN_ENTITY_TAGS can no longer be used, even in a
   * conversation that already ran on it (issue #9183). The picker stays
   * enabled: switching to a visible model is how the conversation continues.
   */
  const isSelectedModelHidden = !!selectedDeployment?.isHidden;

  /* Exactly one usage surface is composed: the dial when the flag is on,
   otherwise the banner above the input. */
  const usageDeploymentId =
    selectedDeployment?.id ?? activeDeploymentId ?? undefined;

  const deploymentItems = useMemo(
    () =>
      items.map(
        ({
          id,
          displayName,
          displayVersion,
          iconUrl,
          type,
          inputAttachmentTypes,
          features,
        }) => ({
          id,
          displayName: resolveLocalizedText(displayName, language),
          displayVersion,
          iconUrl: iconUrl ? resolveCatalogIconUrl(iconUrl) : undefined,
          type,
          inputAttachmentTypes,
          features,
        }),
      ),
    [items, language],
  );

  const fixedDeploymentItems = useMemo(
    () =>
      fixedModel
        ? [
            {
              id: fixedModel.id,
              displayName: fixedModel.displayName,
              iconUrl: fixedModel.iconUrl,
            },
          ]
        : undefined,
    [fixedModel],
  );

  const hasQuickAppStarters = useMemo(
    () =>
      getQuickAppConversationStarters(selectedDeployment?.conversationStarters)
        .starters.length > 0,
    [selectedDeployment?.conversationStarters],
  );

  const isInputDisabled = useMemo(
    () =>
      !hasQuickAppStarters &&
      !!selectedDeploymentConfiguration?.isChatMessageInputDisabled,
    [hasQuickAppStarters, selectedDeploymentConfiguration],
  );

  const modelSelectorLabels = useModelSelectorLabels({
    isLoading,
    error,
    itemCount: items.length,
  });

  return {
    items,
    setSelectedItemId,
    isLoading,
    toolsets,
    activeDeploymentId,
    selectedDeployment,
    isSelectedModelHidden,
    usageDeploymentId,
    deploymentItems,
    fixedDeploymentItems,
    isInputDisabled,
    modelSelectorLabels,
  };
};
