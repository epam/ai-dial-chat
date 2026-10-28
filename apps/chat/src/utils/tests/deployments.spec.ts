import { describe, expect, it } from 'vitest';
import { isDeepLinkableDeployment } from '../deployments';

describe('isDeepLinkableDeployment', () => {
  it('accepts a deployment that declares no interfaces', () => {
    expect(isDeepLinkableDeployment({})).toBe(true);
  });

  it('accepts a deployment offering the chat interface', () => {
    expect(isDeepLinkableDeployment({ interfaces: ['chat', 'mcp'] })).toBe(
      true,
    );
  });

  it('rejects an application that only declares a custom UI', () => {
    expect(isDeepLinkableDeployment({ interfaces: ['custom_ui'] })).toBe(false);
  });

  it('rejects an application that only declares MCP', () => {
    expect(isDeepLinkableDeployment({ interfaces: ['mcp'] })).toBe(false);
  });

  it('rejects a deployment hidden by the operator', () => {
    expect(isDeepLinkableDeployment({ isHidden: true })).toBe(false);
  });
});
