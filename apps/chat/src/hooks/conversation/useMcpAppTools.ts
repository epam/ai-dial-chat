import type {
  DeploymentItemDto,
  DialToolsetDto,
} from '@epam/ai-dial-chat-api-client';
import type { Message } from '@epam/ai-dial-chat-shared';
import {
  collectToolCallNames,
  type McpAppToolRef,
  type McpDeploymentKind,
} from '@epam/ai-dial-mcp-apps';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  listMcpAppTools,
  type McpAppToolSummary,
} from '../../server-api/mcp-apps';

/**
 * Discovers MCP Apps-capable tools available to the current conversation, merging two
 * sources:
 *
 * 1. **Direct** — the active deployment itself, when it declares `features.mcp` (a
 *    toolset, or an application that is itself an MCP server).
 * 2. **Indirect** — any toolset in `toolsets` whose name prefixes a tool-call name
 *    actually seen in `messages` (e.g. `weather_get_weather` implies the `weather`
 *    toolset). This covers a quick app that has no MCP capability of its own but
 *    internally delegates to an MCP-capable toolset — a link Core does not otherwise
 *    expose to the host. Tool names discovered this way are re-prefixed with the
 *    toolset's name so they match the `{toolset}_{tool}` form seen in real tool calls,
 *    keeping downstream name-matching (`findMcpAppForMessage`) unchanged.
 *
 * Empty until loaded, or if neither source yields anything.
 */
export const useMcpAppTools = (
  deployment: DeploymentItemDto | undefined,
  messages: Message[],
  toolsets: DialToolsetDto[],
): McpAppToolRef[] => {
  const [directTools, setDirectTools] = useState<McpAppToolRef[]>([]);
  const [indirectTools, setIndirectTools] = useState<McpAppToolRef[]>([]);
  const fetchedToolsetIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetchedToolsetIdsRef.current = new Set();
    setIndirectTools([]);

    if (deployment?.features?.mcp !== true) {
      setDirectTools([]);
      return;
    }
    if (deployment.type !== 'toolset' && deployment.type !== 'application') {
      setDirectTools([]);
      return;
    }
    const deploymentId = deployment.id;
    const kind: McpDeploymentKind = deployment.type;

    const loadDirectTools = async () => {
      try {
        const tools: McpAppToolSummary[] = await listMcpAppTools(
          deploymentId,
          kind,
        );
        setDirectTools(
          tools.map(({ resourceUri, toolName }) => ({
            toolsetId: deploymentId,
            resourceUri,
            toolName,
            mcpToolName: toolName,
            kind,
          })),
        );
      } catch {
        setDirectTools([]);
      }
    };
    void loadDirectTools();
  }, [deployment?.id, deployment?.type, deployment?.features?.mcp]);

  const toolCallNames = useMemo(
    () => collectToolCallNames(messages),
    [messages],
  );

  useEffect(() => {
    if (toolCallNames.size === 0) return;

    const candidateToolsets = toolsets.filter((toolset) => {
      if (fetchedToolsetIdsRef.current.has(toolset.id)) return false;
      const prefix = `${toolset.displayName ?? toolset.id}_`;
      return [...toolCallNames].some((name) => name.startsWith(prefix));
    });
    if (candidateToolsets.length === 0) return;

    for (const toolset of candidateToolsets) {
      fetchedToolsetIdsRef.current.add(toolset.id);
    }

    const loadIndirectTools = async () => {
      const results = await Promise.all(
        candidateToolsets.map(async (toolset) => {
          try {
            const tools = await listMcpAppTools(toolset.id, 'toolset');
            return tools.map(({ resourceUri, toolName }) => ({
              toolsetId: toolset.id,
              resourceUri,
              toolName: `${toolset.displayName ?? toolset.id}_${toolName}`,
              mcpToolName: toolName,
              kind: 'toolset' as McpDeploymentKind,
            }));
          } catch {
            return [];
          }
        }),
      );
      setIndirectTools((prev) => [...prev, ...results.flat()]);
    };
    void loadIndirectTools();
  }, [toolCallNames, toolsets]);

  return [...directTools, ...indirectTools];
};
