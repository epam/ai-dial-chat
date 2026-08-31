import type {
  DeploymentConfigurationSchema,
  DeploymentConfigurationSchemaProperty,
  ToolMenuItem,
} from '@epam/ai-dial-chat-shared';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

/** Host-supplied inputs to {@link useToolsMenu}. */
export interface UseToolsMenuParams {
  /** Id of the currently selected deployment, or `null` when none is selected. */
  selectedItemId: string | null;
  /** JSON-schema configuration for the selected deployment, or `null` when none. */
  selectedDeploymentConfiguration: DeploymentConfigurationSchema | null;
  /** Icon element rendered on every tool menu item. Defaults to `null`. */
  toolIcon?: ReactNode;
}

/** Result returned by {@link useToolsMenu}. */
export type UseToolsMenuResult = {
  /** One item per boolean property of the deployment configuration schema, in schema order. */
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

interface ToolDefinition {
  id: string;
  label: string;
  defaultValue: boolean;
}

const isBooleanProperty = (
  property: DeploymentConfigurationSchemaProperty,
): boolean =>
  property.type === 'boolean' ||
  (property.type == null && typeof property.default === 'boolean');

/** Turns a schema property key into a readable label: `deep_research` → `Deep research`. */
const humanizePropertyKey = (key: string): string => {
  const words = key.replace(/[_-]+/g, ' ').trim();
  if (words.length === 0) return key;
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const buildToolDefinitions = (
  configuration: DeploymentConfigurationSchema | null,
): ToolDefinition[] => {
  const properties = configuration?.properties;
  if (properties == null) return [];

  return Object.entries(properties)
    .filter(([, property]) => isBooleanProperty(property))
    .map(([key, property]) => ({
      id: key,
      label:
        typeof property.title === 'string' && property.title.length > 0
          ? property.title
          : humanizePropertyKey(key),
      defaultValue: property.default === true,
    }));
};

/**
 * Derives the tools submenu from the active deployment's configuration schema:
 * every boolean property becomes a toggle. Manages toggle state locally, resets
 * on deployment change, and exposes a stable `toolConfigurationValue` record for
 * inclusion in completion requests. Headless: the tool icon is the host's
 * responsibility, supplied via `toolIcon`.
 */
export const useToolsMenu = (
  params: UseToolsMenuParams,
): UseToolsMenuResult => {
  const { selectedItemId, selectedDeploymentConfiguration, toolIcon } = params;

  const toolDefinitions = useMemo(
    () => buildToolDefinitions(selectedDeploymentConfiguration),
    [selectedDeploymentConfiguration],
  );

  const defaultSelections = useMemo(
    () =>
      Object.fromEntries(
        toolDefinitions.map(({ id, defaultValue }) => [id, defaultValue]),
      ),
    [toolDefinitions],
  );

  const [selections, setSelections] =
    useState<Record<string, boolean>>(defaultSelections);

  /*
   * The effect below must not re-run just because the host handed us a new
   * schema object with identical contents — that would reset the toggles on
   * every render. Compare the defaults by value, and read the latest object
   * through a ref when a reset is actually due.
   */
  const defaultSelectionsSignature = JSON.stringify(defaultSelections);
  const defaultSelectionsRef = useRef(defaultSelections);
  defaultSelectionsRef.current = defaultSelections;

  useEffect(() => {
    setSelections(defaultSelectionsRef.current);
  }, [selectedItemId, defaultSelectionsSignature]);

  const onToolToggle = useCallback(
    (id: string) => {
      setSelections((prev) => {
        if (!(id in prev)) return prev;
        return { ...prev, [id]: !prev[id] };
      });
    },
    [setSelections],
  );

  const restoreToolConfiguration = useCallback(
    (configurationValue: Record<string, unknown> | undefined) => {
      if (configurationValue == null) return;
      setSelections((prev) => {
        let hasChange = false;
        const restored = { ...prev };
        for (const id of Object.keys(prev)) {
          const value = configurationValue[id];
          if (typeof value === 'boolean' && value !== prev[id]) {
            restored[id] = value;
            hasChange = true;
          }
        }
        return hasChange ? restored : prev;
      });
    },
    [setSelections],
  );

  const toolsMenuItems: ToolMenuItem[] = useMemo(
    () =>
      toolDefinitions.map(({ id, label }) => ({
        id,
        label,
        icon: toolIcon ?? null,
        isSelected: selections[id] ?? false,
      })),
    [toolDefinitions, selections, toolIcon],
  );

  const toolConfigurationValue: Record<string, boolean> = useMemo(
    () =>
      Object.fromEntries(
        toolDefinitions.map(({ id }) => [id, selections[id] ?? false]),
      ),
    [toolDefinitions, selections],
  );

  return {
    toolsMenuItems,
    onToolToggle,
    toolConfigurationValue,
    restoreToolConfiguration,
  };
};
