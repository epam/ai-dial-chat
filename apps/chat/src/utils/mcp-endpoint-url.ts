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
