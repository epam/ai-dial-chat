import type {
  DeploymentConfigurationSchema,
  ToolMenuItem,
} from '@epam/ai-dial-chat-shared';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

/** Translatable strings the tools menu surfaces. */
export interface ToolsMenuLabels {
  /** Fallback label for the deep-research tool when the schema defines no `title`. */
  deepResearchFallback: string;
}

/** Host-supplied inputs to {@link useToolsMenu}. */
export interface UseToolsMenuParams {
  /** Operator-configured deep-research tool id, or `null` when none is configured. */
  deepResearchToolId: string | null;
  /** Id of the currently selected deployment, or `null` when none is selected. */
  selectedItemId: string | null;
  /** JSON-schema configuration for the selected deployment, or `null` when none. */
  selectedDeploymentConfiguration: DeploymentConfigurationSchema | null;
  /** Translated labels. Fields not provided fall back to English defaults. */
  labels?: Partial<ToolsMenuLabels>;
  /** Icon element rendered on the tool menu item. Defaults to `null`. */
  toolIcon?: ReactNode;
}

/** Result returned by {@link useToolsMenu}. */
export type UseToolsMenuResult = {
  /** Derived submenu items (empty until a boolean tool property is found). */
  toolsMenuItems: ToolMenuItem[];
  /** Toggles the tool with the given id; ignores unknown ids. */
  onToolToggle: (id: string) => void;
  /** Stable record of tool ids to their current on/off state, for completion requests. */
  toolConfigurationValue: Record<string, boolean>;
  /** Restores toggle state from a persisted tool configuration record. */
  restoreToolConfiguration: (
    configurationValue: Record<string, unknown> | undefined,
  ) => void;
};

const DEFAULT_LABELS: ToolsMenuLabels = {
  deepResearchFallback: 'Deep research',
};

/**
 * Derives the tools submenu from the active deployment's configuration schema
 * and the operator-configured tool id. Manages toggle state locally, resets on
 * deployment change, and exposes a stable `toolConfigurationValue` record for
 * inclusion in completion requests. Headless: translation and the tool icon are
 * the host's responsibility, supplied via `labels` and `toolIcon`.
 */
export const useToolsMenu = (
  params: UseToolsMenuParams,
): UseToolsMenuResult => {
  const {
    deepResearchToolId,
    selectedItemId,
    selectedDeploymentConfiguration,
  } = params;

  const labels = useMemo(
    () => ({ ...DEFAULT_LABELS, ...params.labels }),
    [params.labels],
  );
  const toolIcon = params.toolIcon;

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

  const restoreToolConfiguration = useCallback(
    (configurationValue: Record<string, unknown> | undefined) => {
      if (deepResearchToolId == null) return;
      const value = configurationValue?.[deepResearchToolId];
      if (typeof value === 'boolean') {
        setIsSelected(value);
      }
    },
    [deepResearchToolId],
  );

  const toolsMenuItems: ToolMenuItem[] = useMemo(() => {
    if (schemaProperty == null || deepResearchToolId == null) return [];

    const label =
      (typeof schemaProperty.title === 'string' && schemaProperty.title) ||
      labels.deepResearchFallback;

    return [
      {
        id: deepResearchToolId,
        label,
        icon: toolIcon ?? null,
        isSelected,
      },
    ];
  }, [schemaProperty, deepResearchToolId, isSelected, labels, toolIcon]);

  const toolConfigurationValue: Record<string, boolean> = useMemo(() => {
    if (deepResearchToolId == null || schemaProperty == null) return {};
    return { [deepResearchToolId]: isSelected };
  }, [deepResearchToolId, schemaProperty, isSelected]);

  return {
    toolsMenuItems,
    onToolToggle,
    toolConfigurationValue,
    restoreToolConfiguration,
  };
};
