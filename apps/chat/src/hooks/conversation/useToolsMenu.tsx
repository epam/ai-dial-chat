import type { ToolMenuItem } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconTelescope } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ToolsI18nKeys } from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import { useDeployments } from '../../context/DeploymentsContext';

/**
 * Derives the tools submenu items from the active deployment's configuration
 * schema and the operator-configured tool id. Manages toggle state locally,
 * resets on deployment change, and exposes a stable `toolConfigurationValue`
 * record for inclusion in completion requests.
 */
export const useToolsMenu = () => {
  const { t } = useTranslation();
  const { config } = useAppConfig();
  const { selectedItemId, selectedDeploymentConfiguration } = useDeployments();

  const deepResearchToolId = config.deepResearchToolId;

  const schemaProperty = useMemo(() => {
    if (deepResearchToolId == null) return null;
    if (selectedDeploymentConfiguration == null) return null;
    const prop =
      selectedDeploymentConfiguration.properties?.[deepResearchToolId];
    if (prop == null) return null;

    const isBooleanTyped =
      prop.type === 'boolean' ||
      (prop.type == null && typeof prop.default === 'boolean');
    if (!isBooleanTyped) return null;

    return prop;
  }, [deepResearchToolId, selectedDeploymentConfiguration]);

  const defaultValue = useMemo(
    () =>
      typeof schemaProperty?.default === 'boolean'
        ? schemaProperty.default
        : false,
    [schemaProperty],
  );

  const [isSelected, setIsSelected] = useState(defaultValue);

  useEffect(() => {
    setIsSelected(defaultValue);
  }, [selectedItemId, defaultValue]);

  const onToolToggle = useCallback(
    (id: string) => {
      if (id === deepResearchToolId) {
        setIsSelected((prev) => !prev);
      }
    },
    [deepResearchToolId],
  );

  const toolsMenuItems: ToolMenuItem[] = useMemo(() => {
    if (schemaProperty == null || deepResearchToolId == null) return [];

    const label =
      (typeof schemaProperty.title === 'string' && schemaProperty.title) ||
      t(ToolsI18nKeys.DeepResearchFallback);

    return [
      {
        id: deepResearchToolId,
        label,
        icon: <IconTelescope size={DIAL_ICON_SIZE.SM} aria-hidden />,
        isSelected,
      },
    ];
  }, [schemaProperty, deepResearchToolId, isSelected, t]);

  const toolConfigurationValue: Record<string, boolean> = useMemo(() => {
    if (deepResearchToolId == null || schemaProperty == null) return {};
    return { [deepResearchToolId]: isSelected };
  }, [deepResearchToolId, schemaProperty, isSelected]);

  return { toolsMenuItems, onToolToggle, toolConfigurationValue };
};
