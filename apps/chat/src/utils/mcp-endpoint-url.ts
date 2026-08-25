import type { CatalogItemApiDetails } from '@epam/ai-dial-catalog';
import { CodeLanguage } from '@epam/ai-dial-catalog';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { McpResourceKind } from '../types/mcp';

const safeDecodeURIComponent = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const encodeMcpResourcePath = (path: string): string =>
  path
    .split('/')
    .map((segment) => encodeURIComponent(safeDecodeURIComponent(segment)))
    .join('/');

const trimTrailingSlash = (baseUrl: string): string =>
  baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

export const buildToolsetMcpUrl = (baseUrl: string, id: string): string =>
  `${trimTrailingSlash(baseUrl)}/v1/toolset/${encodeMcpResourcePath(id)}/mcp`;

export const buildApplicationMcpUrl = (baseUrl: string, id: string): string =>
  `${trimTrailingSlash(baseUrl)}/v1/deployments/${encodeMcpResourcePath(id)}/mcp`;

const MCP_URL_BUILDERS: Record<
  McpResourceKind,
  (baseUrl: string, id: string) => string
> = {
  [McpResourceKind.Toolset]: buildToolsetMcpUrl,
  [McpResourceKind.Application]: buildApplicationMcpUrl,
};

/** Returns the MCP resource kind a catalog item's Connect endpoint belongs to, or `null` when the item exposes no MCP endpoint. */
export const resolveMcpResourceKind = (
  type: CatalogEntityType,
  supportsMcp?: boolean,
): McpResourceKind | null => {
  if (type === CatalogEntityType.Toolset) return McpResourceKind.Toolset;
  if (type === CatalogEntityType.Agent && supportsMcp === true) {
    return McpResourceKind.Application;
  }
  return null;
};

/** Builds the "Connect" tab's resource/endpoint/snippet data for the MCP endpoint of the given resource kind. */
export const buildConnectApi = (
  baseUrl: string,
  id: string,
  kind: McpResourceKind,
): CatalogItemApiDetails => {
  const url = MCP_URL_BUILDERS[kind](baseUrl, id);
  return {
    resource: { endpointUrl: url },
    snippets: [
      {
        language: CodeLanguage.Curl,
        code: `curl -X POST ${url} \\\n  -H 'Content-Type: application/json' \\\n  -H 'Api-Key: <key>' \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
      },
    ],
  };
};
