import { describe, expect, it } from 'vitest';
import { OAUTH_RESOURCE_PATTERN } from './oauth-resource.pattern';

describe('OAUTH_RESOURCE_PATTERN', () => {
  it.each([
    '',
    'https://mcp.notion.com/mcp',
    'http://localhost:8080/mcp',
    'urn:example:resource',
  ])('accepts %j', (value) => {
    expect(OAUTH_RESOURCE_PATTERN.test(value)).toBe(true);
  });

  it.each([
    'mcp.notion.com/mcp',
    '/mcp',
    'https://mcp.notion.com/mcp#tools',
    'https://mcp.notion.com/ mcp',
    'https://mcp.notion.com/mcp\nX-Injected: 1',
    '1https://mcp.notion.com',
  ])('rejects %j', (value) => {
    expect(OAUTH_RESOURCE_PATTERN.test(value)).toBe(false);
  });
});
