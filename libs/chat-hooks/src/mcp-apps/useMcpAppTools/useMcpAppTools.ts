import type {
  DeploymentDetailsDto,
  DeploymentItemDto,
  DialToolsetDto,
} from '@epam/ai-dial-chat-api-client';
import type { Message } from '@epam/ai-dial-chat-shared';
import {
  collectDialLoopToolCallNames,
  collectToolCallNames,
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

  useEffect(() => {
    fetchedToolsetIdsRef.current = new Set();
    setQuickAppTools([]);

    let isCancelled = false;
    const load = async () => {
      const tools = await discoverDirectTools(client, deployment);
      if (!isCancelled) setDirectTools(tools);
    };
    void load();
    return () => {
      isCancelled = true;
    };
    /* Only the fields discovery reads: a new `deployment` object with the same id, type and flag must not refetch. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployment?.id, deployment?.type, deployment?.features?.mcp, client]);

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
  const dialLoopToolsetIds = useMemo(
    () => getDialLoopToolsetIds(activeDetails),
    [activeDetails],
  );
  const hasDialLoopToolCalls = useMemo(
    () =>
      dialLoopToolsetIds.length > 0 &&
      collectDialLoopToolCallNames(messages).size > 0,
    [dialLoopToolsetIds, messages],
  );

  useEffect(() => {
    if (!hasDialLoopToolCalls || dialLoopToolsetIds.length === 0) {
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
  }, [hasDialLoopToolCalls, dialLoopToolsetIds, client]);

  /* Stable identity between renders so memoized message rows don't re-render. */
  return useMemo(
    () => [...directTools, ...quickAppTools, ...dialLoopTools],
    [directTools, quickAppTools, dialLoopTools],
  );
};
