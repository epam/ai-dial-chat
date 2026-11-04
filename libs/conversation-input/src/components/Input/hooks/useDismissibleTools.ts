import type { ToolMenuItem } from '@epam/ai-dial-chat-shared';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface UseDismissibleToolsParams {
  toolsMenuItems: ToolMenuItem[] | undefined;
  canRemoveTools: boolean;
  isPhone: boolean;
  onToolToggle: ((toolId: string) => void) | undefined;
}

/**
 * Tool chips the composer shows and the chip × dismissal behind them. Private
 * to `Input`: dismissal is view state of one composer, forgotten when the
 * deployment offers a different tool list.
 */
export const useDismissibleTools = ({
  toolsMenuItems,
  canRemoveTools,
  isPhone,
  onToolToggle,
}: UseDismissibleToolsParams) => {
  /*
   * Chips the user dismissed with the chip's ×. Dismissal is view state of this
   * input only: a dismissed tool comes back the moment it is switched on again
   * from the `+` menu, and the whole set is forgotten when the deployment
   * offers a different list of tools.
   */
  const [dismissedToolIds, setDismissedToolIds] = useState<string[]>([]);
  const toolIdsSignature = (toolsMenuItems ?? [])
    .map((tool) => tool.id)
    .join('|');

  useEffect(() => {
    setDismissedToolIds([]);
  }, [toolIdsSignature]);

  const visibleTools = useMemo(() => {
    const tools = toolsMenuItems ?? [];
    /*
     * A phone composer has no room for a chip per tool, so only tools that
     * are switched on stay visible; the rest are added from `+` → Tools.
     */
    if (isPhone) return tools.filter((tool) => tool.isSelected);
    if (!canRemoveTools) return tools;
    return tools.filter(
      (tool) => tool.isSelected || !dismissedToolIds.includes(tool.id),
    );
  }, [toolsMenuItems, dismissedToolIds, canRemoveTools, isPhone]);

  const handleToolDismiss = useCallback(
    (toolId: string) => {
      setDismissedToolIds((prev) =>
        prev.includes(toolId) ? prev : [...prev, toolId],
      );
      const tool = toolsMenuItems?.find((item) => item.id === toolId);
      if (tool?.isSelected) onToolToggle?.(toolId);
    },
    [toolsMenuItems, onToolToggle],
  );

  return { visibleTools, handleToolDismiss };
};
