import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { SSE_INIT_PAYLOAD, startSseResponse } from './sse';

const createResponse = () => {
  const calls: string[] = [];
  const res = {
    setHeader: vi.fn((name: string, value: string) => {
      calls.push(`setHeader:${name}=${value}`);
    }),
    flushHeaders: vi.fn(() => {
      calls.push('flushHeaders');
    }),
    write: vi.fn((chunk: string) => {
      calls.push(`write:${chunk}`);
      return true;
    }),
  };
  return { res: res as unknown as Response, calls };
};

describe('startSseResponse', () => {
  it('sets the event-stream headers, flushes them, then writes the init comment', () => {
    const { res, calls } = createResponse();

    startSseResponse(res);

    expect(calls).toEqual([
      'setHeader:Content-Type=text/event-stream',
      'setHeader:Cache-Control=no-cache',
      'setHeader:Connection=keep-alive',
      'flushHeaders',
      `write:${SSE_INIT_PAYLOAD}`,
    ]);
  });

  it('exposes an init payload that SSE readers treat as a comment', () => {
    expect(SSE_INIT_PAYLOAD.startsWith(':')).toBe(true);
    expect(SSE_INIT_PAYLOAD.endsWith('\n\n')).toBe(true);
    expect(SSE_INIT_PAYLOAD).not.toContain('data:');
  });
});
