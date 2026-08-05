import { CodeLanguage } from '@epam/ai-dial-catalog';
import { describe, expect, it } from 'vitest';
import {
  buildApplicationMcpUrl,
  buildToolsetConnectApi,
  buildToolsetMcpUrl,
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

  describe('buildToolsetConnectApi', () => {
    it('sets the resource endpoint URL to the toolset MCP URL', () => {
      const api = buildToolsetConnectApi(
        'https://dial.example.com',
        'search-tool',
      );
      expect(api.resource?.endpointUrl).toBe(
        'https://dial.example.com/v1/toolset/search-tool/mcp',
      );
    });

    it('includes a curl snippet that targets the same endpoint URL', () => {
      const api = buildToolsetConnectApi(
        'https://dial.example.com',
        'search-tool',
      );
      expect(api.snippets).toHaveLength(1);
      expect(api.snippets?.[0].language).toBe(CodeLanguage.Curl);
      expect(api.snippets?.[0].code).toContain(
        'https://dial.example.com/v1/toolset/search-tool/mcp',
      );
    });
  });
});
