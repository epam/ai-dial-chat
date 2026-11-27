import type {
  DeploymentDetailsDto,
  DeploymentItemDto,
  DialToolsetDto,
} from '@epam/ai-dial-chat-api-client';
import type { Message } from '@epam/ai-dial-chat-shared';
import {
  collectToolCallNames,
  hasDialLoopToolCalls,
  type McpAppToolRef,
} from '@epam/ai-dial-mcp-apps';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  discoverDialLoopTools,
  getDialLoopToolsetIds,
} from '../adapters/dial-loop/dial-loop-discovery';
import { discoverDirectTools } from '../adapters/direct/direct-discovery';
import {
  discoverQuickAppTools,
  findQuickAppToolsets,
} from '../adapters/quick-app/quick-app-discovery';
import type { McpAppsApiClient } from '../mcp-apps-api-client';

/**
 * Discovers MCP Apps-capable tools available to the current conversation by
 * merging three adapters (see `docs/mcp-apps.md`, "Temporary adapters"):
 *
 * 1. **Direct** — the active deployment itself, when it declares `features.mcp`.
 * 2. **Quick app** — any toolset whose name prefixes a tool-call name recorded in
 *    `state`, re-prefixed so the names match the recorded calls.
 * 3. **DIAL loop** — the toolsets listed in a DIAL loop application's
 *    configuration, inspected once a message carries a tool call reported as a stage.
 *
 * Empty until loaded, or if no adapter yields anything.
 * @param client - MCP Apps API client
 * @param deployment - the active deployment
 * @param messages - conversation messages
 * @param toolsets - every toolset the host knows
 * @param deploymentDetails - details of the active deployment, used to read a DIAL loop's configured toolsets
 */
export const useMcpAppTools = (
  client: McpAppsApiClient,
  deployment: DeploymentItemDto | undefined,
  messages: Message[],
  toolsets: DialToolsetDto[],
  deploymentDetails?: DeploymentDetailsDto | null,
): McpAppToolRef[] => {
  const [directTools, setDirectTools] = useState<McpAppToolRef[]>([]);
  const [quickAppTools, setQuickAppTools] = useState<McpAppToolRef[]>([]);
  const [dialLoopTools, setDialLoopTools] = useState<McpAppToolRef[]>([]);
  const fetchedToolsetIdsRef = useRef<Set<string>>(new Set());

  const deploymentId = deployment?.id;
  const deploymentType = deployment?.type;
  const hasMcp = deployment?.features?.mcp === true;

  useEffect(() => {
    fetchedToolsetIdsRef.current = new Set();
    setQuickAppTools([]);

    let isCancelled = false;
    const load = async () => {
      const tools = await discoverDirectTools(client, {
        id: deploymentId,
        type: deploymentType,
        hasMcp,
      });
      if (!isCancelled) setDirectTools(tools);
    };
    void load();
    return () => {
      isCancelled = true;
    };
  }, [deploymentId, deploymentType, hasMcp, client]);

  const toolCallNames = useMemo(
    () => collectToolCallNames(messages),
    [messages],
  );

  useEffect(() => {
    if (toolCallNames.size === 0) return;

    const candidateToolsets = findQuickAppToolsets(
      toolsets,
      toolCallNames,
    ).filter((toolset) => !fetchedToolsetIdsRef.current.has(toolset.id));
    if (candidateToolsets.length === 0) return;

    for (const toolset of candidateToolsets) {
      fetchedToolsetIdsRef.current.add(toolset.id);
    }

    const load = async () => {
      const tools = await discoverQuickAppTools(client, candidateToolsets);
      setQuickAppTools((prev) => [...prev, ...tools]);
    };
    void load();
  }, [toolCallNames, toolsets, client]);

  /* The host's details may still describe a previously selected deployment. */
  const activeDetails =
    deploymentDetails?.id === deployment?.id ? deploymentDetails : undefined;
  /* Keyed by value: a new but equal `deploymentDetails` object must not re-run discovery. */
  const dialLoopToolsetIdsKey = getDialLoopToolsetIds(activeDetails).join('\n');
  const dialLoopToolsetIds = useMemo(
    () =>
      dialLoopToolsetIdsKey === '' ? [] : dialLoopToolsetIdsKey.split('\n'),
    [dialLoopToolsetIdsKey],
  );
  const hasStageToolCalls = useMemo(
    () => dialLoopToolsetIds.length > 0 && hasDialLoopToolCalls(messages),
    [dialLoopToolsetIds, messages],
  );

  useEffect(() => {
    if (!hasStageToolCalls || dialLoopToolsetIds.length === 0) {
      setDialLoopTools([]);
      return;
    }
    let isCancelled = false;

    const load = async () => {
      const tools = await discoverDialLoopTools(client, dialLoopToolsetIds);
      if (!isCancelled) setDialLoopTools(tools);
    };
    void load();
    return () => {
      isCancelled = true;
    };
  }, [hasStageToolCalls, dialLoopToolsetIds, client]);

  /* Stable identity between renders so memoized message rows don't re-render. */
  return useMemo(
    () => [...directTools, ...quickAppTools, ...dialLoopTools],
    [directTools, quickAppTools, dialLoopTools],
  );
};
