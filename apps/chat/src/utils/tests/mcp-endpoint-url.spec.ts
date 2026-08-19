import { CodeLanguage } from '@epam/ai-dial-catalog';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { McpResourceKind } from '../../types/mcp';
import {
  buildApplicationMcpUrl,
  buildConnectApi,
  buildToolsetMcpUrl,
  resolveMcpResourceKind,
} from '../mcp-endpoint-url';

describe('mcp-endpoint-url', () => {
  describe('buildToolsetMcpUrl', () => {
    it('trims exactly one trailing slash from the base URL', () => {
      const result = buildToolsetMcpUrl(
        'https://dial.example.com/',
        'search-tool',
      );
      expect(result.includes('.com//v1/toolset/')).toBe(false);
      expect(result).toBe(
        'https://dial.example.com/v1/toolset/search-tool/mcp',
      );
    });

    it('matches the toolset URL shape', () => {
      expect(
        buildToolsetMcpUrl('https://dial.example.com', 'search-tool'),
      ).toBe('https://dial.example.com/v1/toolset/search-tool/mcp');
    });
  });

  describe('buildApplicationMcpUrl', () => {
    it('matches the application URL shape', () => {
      expect(buildApplicationMcpUrl('https://dial.example.com', 'my-app')).toBe(
        'https://dial.example.com/v1/deployments/my-app/mcp',
      );
    });

    it('encodes path segments independently, without affecting separators', () => {
      expect(
        buildApplicationMcpUrl(
          'https://dial.example.com',
          'applications/public/my app',
        ),
      ).toBe(
        'https://dial.example.com/v1/deployments/applications/public/my%20app/mcp',
      );
    });

    it('does not double-encode an already-encoded space', () => {
      expect(
        buildApplicationMcpUrl('https://dial.example.com', 'my%20app'),
      ).toBe('https://dial.example.com/v1/deployments/my%20app/mcp');
    });

    it('preserves a literal %2F inside a segment instead of splitting it further', () => {
      expect(
        buildApplicationMcpUrl('https://dial.example.com', 'Team%2FApp One'),
      ).toBe('https://dial.example.com/v1/deployments/Team%2FApp%20One/mcp');
    });
  });

  describe('resolveMcpResourceKind', () => {
    it('resolves a toolset to the toolset kind', () => {
      expect(resolveMcpResourceKind(CatalogEntityType.Toolset)).toBe(
        McpResourceKind.Toolset,
      );
    });

    it('resolves an MCP-capable agent to the application kind', () => {
      expect(resolveMcpResourceKind(CatalogEntityType.Agent, true)).toBe(
        McpResourceKind.Application,
      );
    });

    it('returns null for an agent that does not support MCP', () => {
      expect(resolveMcpResourceKind(CatalogEntityType.Agent, false)).toBeNull();
      expect(
        resolveMcpResourceKind(CatalogEntityType.Agent, undefined),
      ).toBeNull();
    });

    it('returns null for a model even when it reports MCP support', () => {
      expect(resolveMcpResourceKind(CatalogEntityType.Model, true)).toBeNull();
    });
  });

  describe('buildConnectApi', () => {
    it('sets the resource endpoint URL to the toolset MCP URL for the toolset kind', () => {
      const api = buildConnectApi(
        'https://dial.example.com',
        'search-tool',
        McpResourceKind.Toolset,
      );
      expect(api.resource?.endpointUrl).toBe(
        'https://dial.example.com/v1/toolset/search-tool/mcp',
      );
    });

    it('sets the resource endpoint URL to the deployments MCP URL for the application kind', () => {
      const api = buildConnectApi(
        'https://dial.example.com',
        'my-app',
        McpResourceKind.Application,
      );
      expect(api.resource?.endpointUrl).toBe(
        'https://dial.example.com/v1/deployments/my-app/mcp',
      );
    });

    it('includes a curl snippet that targets the same endpoint URL', () => {
      const api = buildConnectApi(
        'https://dial.example.com',
        'my-app',
        McpResourceKind.Application,
      );
      expect(api.snippets).toHaveLength(1);
      expect(api.snippets?.[0].language).toBe(CodeLanguage.Curl);
      expect(api.snippets?.[0].code).toContain(
        'https://dial.example.com/v1/deployments/my-app/mcp',
      );
    });
  });
});
