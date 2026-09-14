import {
  MCP_PROTOCOL_VERSION,
  MCP_PROTOCOL_VERSION_HEADER,
  MCP_SESSION_ID_HEADER,
} from '@epam/ai-dial-mcp-apps/constants';
import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import { McpDeploymentKindDto } from '../dto/mcp-app.dto';
import { McpAppService } from '../mcp-app.service';

const TOKEN = 'token';
const TOOLSET_ID = 'toolsets/bucket/my-toolset';
const SESSION_ID = 'session-42';

/** Mirrors an `openapi-fetch` success with `parseAs: 'text'`. */
const ok = (
  body: unknown,
  headers: Record<string, string> = {},
  contentType = 'application/json',
) => ({
  data: typeof body === 'string' ? body : JSON.stringify(body),
  response: {
    status: 200,
    headers: {
      get: (name: string) =>
        ({ 'content-type': contentType, ...headers })[name.toLowerCase()] ??
        null,
    },
  } as unknown as Response,
});

/** Mirrors an `openapi-fetch` failure: the body lands in `error`, never `data`. */
const failure = (status: number) => ({
  error: {},
  response: {
    status,
    headers: { get: () => null },
  } as unknown as Response,
});

const toolsList = (names: string[]) =>
  ok({
    jsonrpc: '2.0',
    id: 1,
    result: { tools: names.map((name) => ({ name })) },
  });

const initializeOk = (protocolVersion = MCP_PROTOCOL_VERSION) =>
  ok(
    { jsonrpc: '2.0', id: 1, result: { protocolVersion } },
    { [MCP_SESSION_ID_HEADER]: SESSION_ID },
  );

const makeService = () => {
  const postToolSetMcp = vi.fn();
  const postApplicationMcp = vi.fn();
  const getApplicationMcpResources = vi.fn();

  const dialClient = {
    client: { postToolSetMcp, postApplicationMcp, getApplicationMcpResources },
    baseUrl: 'http://dial-core',
  } as unknown as DialClientService;

  const cacheManager = {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
  };

  const service = new McpAppService(dialClient, cacheManager as never);
  return {
    service,
    postToolSetMcp,
    postApplicationMcp,
    getApplicationMcpResources,
  };
};

/** Every JSON-RPC method the proxy posted, in order. */
const postedMethods = (post: ReturnType<typeof vi.fn>): string[] =>
  post.mock.calls.map(([, init]) => (init.body as { method: string }).method);

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('McpAppService — transport', () => {
  it('posts through the SDK client, not native fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { service, postToolSetMcp } = makeService();
    postToolSetMcp.mockResolvedValueOnce(toolsList(['search']));

    await service.listToolNames(
      TOOLSET_ID,
      McpDeploymentKindDto.Toolset,
      TOKEN,
    );

    expect(postToolSetMcp).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('encodes the deployment id per path segment', async () => {
    const { service, postToolSetMcp } = makeService();
    postToolSetMcp.mockResolvedValueOnce(toolsList([]));

    await service.listToolNames(
      'toolsets/bucket/my toolset',
      McpDeploymentKindDto.Toolset,
      TOKEN,
    );

    expect(postToolSetMcp.mock.calls[0][0]).toBe(
      'toolsets/bucket/my%20toolset',
    );
  });

  it('routes applications to the application proxy', async () => {
    const { service, postApplicationMcp, postToolSetMcp } = makeService();
    postApplicationMcp.mockResolvedValueOnce(toolsList(['search']));

    await service.listToolNames(
      'app-1',
      McpDeploymentKindDto.Application,
      TOKEN,
    );

    expect(postApplicationMcp).toHaveBeenCalledTimes(1);
    expect(postToolSetMcp).not.toHaveBeenCalled();
  });

  it('reads a JSON-RPC message out of an SSE body', async () => {
    const { service, postToolSetMcp } = makeService();
    postToolSetMcp.mockResolvedValueOnce(
      ok(
        `event: message\ndata: ${JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: { tools: [{ name: 'search' }] },
        })}\n\n`,
        {},
        'text/event-stream',
      ),
    );

    await expect(
      service.listToolNames(TOOLSET_ID, McpDeploymentKindDto.Toolset, TOKEN),
    ).resolves.toEqual(['search']);
  });
});

describe('McpAppService — initialize fallback', () => {
  it('does not retry a tools/call that failed with an upstream 5xx', async () => {
    /*
     * Regression: any upstream failure used to trigger the handshake and a
     * second `tools/call`, so a side-effecting tool could run twice.
     */
    const { service, postToolSetMcp } = makeService();
    postToolSetMcp
      .mockResolvedValueOnce(toolsList(['send_email']))
      .mockResolvedValueOnce(failure(502));

    await expect(
      service.callTool(
        TOOLSET_ID,
        'send_email',
        {},
        McpDeploymentKindDto.Toolset,
        TOKEN,
      ),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(postedMethods(postToolSetMcp)).toEqual(['tools/list', 'tools/call']);
  });

  it('does not retry a tools/call rejected by a JSON-RPC error in a 200 body', async () => {
    const { service, postToolSetMcp } = makeService();
    postToolSetMcp
      .mockResolvedValueOnce(toolsList(['send_email']))
      .mockResolvedValueOnce(
        ok({
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32603, message: 'upstream exploded' },
        }),
      );

    await expect(
      service.callTool(
        TOOLSET_ID,
        'send_email',
        {},
        McpDeploymentKindDto.Toolset,
        TOKEN,
      ),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(postedMethods(postToolSetMcp)).toEqual(['tools/list', 'tools/call']);
  });

  it('performs the handshake and retries once when the session is missing (400)', async () => {
    const { service, postToolSetMcp } = makeService();
    postToolSetMcp
      .mockResolvedValueOnce(failure(400))
      .mockResolvedValueOnce(initializeOk())
      .mockResolvedValueOnce(ok({ jsonrpc: '2.0', id: 1, result: {} }))
      .mockResolvedValueOnce(toolsList(['search']));

    await expect(
      service.listToolNames(TOOLSET_ID, McpDeploymentKindDto.Toolset, TOKEN),
    ).resolves.toEqual(['search']);

    expect(postedMethods(postToolSetMcp)).toEqual([
      'tools/list',
      'initialize',
      'notifications/initialized',
      'tools/list',
    ]);
  });

  it('performs the handshake when the carried session expired (404)', async () => {
    const { service, postToolSetMcp } = makeService();
    postToolSetMcp
      .mockResolvedValueOnce(failure(404))
      .mockResolvedValueOnce(initializeOk())
      .mockResolvedValueOnce(ok({ jsonrpc: '2.0', id: 1, result: {} }))
      .mockResolvedValueOnce(toolsList(['search']));

    await expect(
      service.listToolNames(TOOLSET_ID, McpDeploymentKindDto.Toolset, TOKEN),
    ).resolves.toEqual(['search']);
  });

  it('replays the session id and the negotiated protocol version on the retry', async () => {
    const { service, postToolSetMcp } = makeService();
    postToolSetMcp
      .mockResolvedValueOnce(failure(400))
      .mockResolvedValueOnce(initializeOk('2025-06-18'))
      .mockResolvedValueOnce(ok({ jsonrpc: '2.0', id: 1, result: {} }))
      .mockResolvedValueOnce(toolsList([]));

    await service.listToolNames(
      TOOLSET_ID,
      McpDeploymentKindDto.Toolset,
      TOKEN,
    );

    const [, retryInit] = postToolSetMcp.mock.calls[3];
    expect(retryInit.headers[MCP_SESSION_ID_HEADER]).toBe(SESSION_ID);
    expect(retryInit.headers[MCP_PROTOCOL_VERSION_HEADER]).toBe('2025-06-18');

    /* The first attempt must stay session-free — direct-first is the default. */
    const [, firstInit] = postToolSetMcp.mock.calls[0];
    expect(firstInit.headers[MCP_SESSION_ID_HEADER]).toBeUndefined();
  });

  it('surfaces the original failure when initialize answers with a JSON-RPC error', async () => {
    /*
     * Regression: HTTP 200 alone was treated as a completed handshake, so an
     * error body still led to a retry with an unusable session.
     */
    const { service, postToolSetMcp } = makeService();
    postToolSetMcp.mockResolvedValueOnce(failure(404)).mockResolvedValueOnce(
      ok(
        {
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32600, message: 'unsupported protocol version' },
        },
        { [MCP_SESSION_ID_HEADER]: SESSION_ID },
      ),
    );

    await expect(
      service.listToolNames(TOOLSET_ID, McpDeploymentKindDto.Toolset, TOKEN),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(postedMethods(postToolSetMcp)).toEqual(['tools/list', 'initialize']);
  });

  it('surfaces the original failure when initialize returns no result', async () => {
    const { service, postToolSetMcp } = makeService();
    postToolSetMcp
      .mockResolvedValueOnce(failure(400))
      .mockResolvedValueOnce(ok({ jsonrpc: '2.0', id: 1 }));

    /* The original 400 is what the caller sees, not a handshake error. */
    await expect(
      service.listToolNames(TOOLSET_ID, McpDeploymentKindDto.Toolset, TOKEN),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(postedMethods(postToolSetMcp)).toEqual(['tools/list', 'initialize']);
  });

  it('acknowledges the handshake with the session it just negotiated', async () => {
    const { service, postToolSetMcp } = makeService();
    postToolSetMcp
      .mockResolvedValueOnce(failure(400))
      .mockResolvedValueOnce(initializeOk())
      .mockResolvedValueOnce(ok({ jsonrpc: '2.0', id: 1, result: {} }))
      .mockResolvedValueOnce(toolsList([]));

    await service.listToolNames(
      TOOLSET_ID,
      McpDeploymentKindDto.Toolset,
      TOKEN,
    );

    const [, notifyInit] = postToolSetMcp.mock.calls[2];
    expect(notifyInit.body).toEqual({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
    expect(notifyInit.headers[MCP_SESSION_ID_HEADER]).toBe(SESSION_ID);
  });
});

describe('McpAppService — callTool authorization', () => {
  it('rejects a tool the deployment does not expose, without calling it', async () => {
    const { service, postToolSetMcp } = makeService();
    postToolSetMcp.mockResolvedValueOnce(toolsList(['search']));

    await expect(
      service.callTool(
        TOOLSET_ID,
        'send_email',
        {},
        McpDeploymentKindDto.Toolset,
        TOKEN,
      ),
    ).rejects.toThrow();

    expect(postedMethods(postToolSetMcp)).toEqual(['tools/list']);
  });
});

describe('McpAppService — getResource', () => {
  it('fetches through the SDK and forwards the allowed headers', async () => {
    const { service, getApplicationMcpResources } = makeService();
    getApplicationMcpResources.mockResolvedValueOnce(
      ok('<html>widget</html>', {
        'content-security-policy': "frame-ancestors 'none'",
        'x-content-type-options': 'nosniff',
      }),
    );

    await expect(
      service.getResource(TOOLSET_ID, 'ui://widget/1', TOKEN),
    ).resolves.toEqual({
      body: '<html>widget</html>',
      headers: {
        'content-type': 'application/json',
        'content-security-policy': "frame-ancestors 'none'",
        'x-content-type-options': 'nosniff',
      },
    });

    const [id, init] = getApplicationMcpResources.mock.calls[0];
    expect(id).toBe('toolsets/bucket/my-toolset');
    expect(init.params.query.uri).toBe('ui://widget/1');
  });

  it('maps an upstream failure to the matching exception', async () => {
    const { service, getApplicationMcpResources } = makeService();
    getApplicationMcpResources.mockResolvedValueOnce(failure(404));

    await expect(
      service.getResource(TOOLSET_ID, 'ui://widget/1', TOKEN),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
