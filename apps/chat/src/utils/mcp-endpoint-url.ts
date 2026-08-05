import type { CatalogItemApiDetails } from '@epam/ai-dial-catalog';
import { CodeLanguage } from '@epam/ai-dial-catalog';

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

/** Builds the "Connect" tab's resource/endpoint/snippet data for a toolset's MCP endpoint. */
export const buildToolsetConnectApi = (
  baseUrl: string,
  id: string,
): CatalogItemApiDetails => {
  const url = buildToolsetMcpUrl(baseUrl, id);
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
