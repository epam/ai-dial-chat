import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { McpAppToolCallSeed, McpAppToolRef } from '../../models/mcp-apps';
import { resolveMcpAppToolResult } from '../mcp-app';

const makeMatch = (overrides?: Partial<McpAppToolRef>): McpAppToolRef => ({
  toolsetId: 'toolsets/public/entity-lookup',
  resourceUri: 'ui://entity-card/index.html',
  toolName: 'Entity_Lookup_show_entity_card',
  mcpToolName: 'show_entity_card',
  kind: 'toolset',
  discovery: 'direct',
  ...overrides,
});

const liveResult: CallToolResult = {
  content: [{ type: 'text', text: 'live' }],
};
const seedResult: CallToolResult = {
  content: [{ type: 'text', text: 'transcript' }],
};
const seed: McpAppToolCallSeed = {
  toolInput: { entityId: 'e-1' },
  toolResult: seedResult,
};

describe('resolveMcpAppToolResult', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns the live result without retrying when the first call succeeds', async () => {
    const callTool = vi.fn().mockResolvedValue(liveResult);

    const result = await resolveMcpAppToolResult(makeMatch(), seed, callTool);

    expect(result).toBe(liveResult);
    expect(callTool).toHaveBeenCalledOnce();
  });

  it('retries a failed live call once and returns the retried result', async () => {
    const callTool = vi
      .fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce(liveResult);

    const pending = resolveMcpAppToolResult(makeMatch(), seed, callTool);
    await vi.runAllTimersAsync();

    expect(await pending).toBe(liveResult);
    expect(callTool).toHaveBeenCalledTimes(2);
  });

  it('sends the retry with the same arguments as the first attempt', async () => {
    const callTool = vi
      .fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce(liveResult);

    const pending = resolveMcpAppToolResult(makeMatch(), seed, callTool);
    await vi.runAllTimersAsync();
    await pending;

    expect(callTool).toHaveBeenNthCalledWith(
      1,
      'toolsets/public/entity-lookup',
      'show_entity_card',
      { entityId: 'e-1' },
      'toolset',
    );
    expect(callTool).toHaveBeenNthCalledWith(
      2,
      'toolsets/public/entity-lookup',
      'show_entity_card',
      { entityId: 'e-1' },
      'toolset',
    );
  });

  it('waits before retrying instead of retrying immediately', async () => {
    const callTool = vi
      .fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce(liveResult);

    const pending = resolveMcpAppToolResult(makeMatch(), seed, callTool);
    await vi.advanceTimersByTimeAsync(499);

    expect(callTool).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(1);

    expect(callTool).toHaveBeenCalledTimes(2);
    expect(await pending).toBe(liveResult);
  });

  it('adds random jitter on top of the base retry delay', async () => {
    vi.mocked(Math.random).mockReturnValue(0.999);
    const callTool = vi
      .fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce(liveResult);

    const pending = resolveMcpAppToolResult(makeMatch(), seed, callTool);
    await vi.advanceTimersByTimeAsync(500);

    expect(callTool).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(500);

    expect(callTool).toHaveBeenCalledTimes(2);
    expect(await pending).toBe(liveResult);
  });

  it('falls back to the transcript result when the retry fails too', async () => {
    const callTool = vi.fn().mockRejectedValue(new Error('fetch failed'));

    const pending = resolveMcpAppToolResult(makeMatch(), seed, callTool);
    await vi.runAllTimersAsync();

    expect(await pending).toBe(seedResult);
    expect(callTool).toHaveBeenCalledTimes(2);
  });

  it('resolves to undefined when both attempts fail and there is no transcript result', async () => {
    const callTool = vi.fn().mockRejectedValue(new Error('fetch failed'));

    const pending = resolveMcpAppToolResult(
      makeMatch(),
      { toolInput: seed.toolInput },
      callTool,
    );
    await vi.runAllTimersAsync();

    expect(await pending).toBeUndefined();
  });

  it('never retries more than once', async () => {
    const callTool = vi.fn().mockRejectedValue(new Error('fetch failed'));

    const pending = resolveMcpAppToolResult(makeMatch(), seed, callTool);
    await vi.runAllTimersAsync();
    await pending;
    await vi.advanceTimersByTimeAsync(10_000);

    expect(callTool).toHaveBeenCalledTimes(2);
  });

  it('does not call the tool for an unconfirmed indirect match', async () => {
    const callTool = vi.fn();

    const result = await resolveMcpAppToolResult(
      makeMatch({ discovery: 'indirect' }),
      undefined,
      callTool,
    );

    expect(result).toBeUndefined();
    expect(callTool).not.toHaveBeenCalled();
  });
});
