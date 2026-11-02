import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import { ProjectWatchAction } from '../dto/project-watch-action.enum';
import type { ProjectWatchEventDto } from '../dto/project-watch-event.dto';
import { ProjectsWatchService } from '../watch/projects-watch.service';

const PROJECT_ID = 'projects/a1b2c3/marketing/q4 launch';
const CORE_URL = 'projects/a1b2c3/marketing/q4%20launch';

const streamOf = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });

const collect = async (events: AsyncGenerator<ProjectWatchEventDto>) => {
  const result: ProjectWatchEventDto[] = [];
  for await (const event of events) result.push(event);
  return result;
};

describe('ProjectsWatchService', () => {
  let subscribeToResources: ReturnType<typeof vi.fn>;
  let service: ProjectsWatchService;

  beforeEach(() => {
    subscribeToResources = vi.fn();
    service = new ProjectsWatchService({
      client: { subscribeToResources },
    } as unknown as DialClientService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('subscribes once to every project URL with the bearer token and signal', async () => {
    subscribeToResources.mockResolvedValue({
      response: new Response(streamOf([])),
    });
    const signal = new AbortController().signal;

    await collect(
      await service.watchProjects(
        [PROJECT_ID, 'projects/public/handbook'],
        'token-1',
        signal,
      ),
    );

    expect(subscribeToResources).toHaveBeenCalledOnce();
    expect(subscribeToResources).toHaveBeenCalledWith({
      body: {
        resources: [{ url: CORE_URL }, { url: 'projects/public/handbook' }],
      },
      headers: {
        Authorization: 'Bearer token-1',
        Accept: 'text/event-stream',
      },
      parseAs: 'stream',
      signal,
    });
  });

  it('yields project events and drops heartbeats, file events and malformed frames', async () => {
    subscribeToResources.mockResolvedValue({
      response: new Response(
        streamOf([
          ': heartbeat\n\n',
          `data: {"url":"${CORE_URL}","action":"UPDATE","timestamp":5,"etag":"e1","senderPodId":"p"}\n`,
          `\ndata: {"url":"${CORE_URL}/files/brief.md","action":"UPDATE","timestamp":5}\n\n`,
          'data: not-json\n\n',
          `data: {"url":"${CORE_URL}","action":"DELETE","timestamp":9}\n\n`,
        ]),
      ),
    });

    const events = await collect(
      await service.watchProjects(
        [PROJECT_ID],
        'token-1',
        new AbortController().signal,
      ),
    );

    expect(events).toEqual([
      {
        id: PROJECT_ID,
        action: ProjectWatchAction.Update,
        timestamp: 5,
        etag: 'e1',
      },
      { id: PROJECT_ID, action: ProjectWatchAction.Delete, timestamp: 9 },
    ]);
  });

  it('rejects with 400 and one warning when Core does not support project subscriptions', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {
      /* silenced */
    });
    subscribeToResources.mockResolvedValue({
      response: new Response('resource type is not supported', {
        status: 400,
      }),
    });

    await expect(
      service.watchProjects(
        [PROJECT_ID],
        'token-1',
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).not.toContain('a1b2c3');
  });

  it('rejects with 403 when Core denies one of the projects', async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {
      /* silenced */
    });
    subscribeToResources.mockResolvedValue({
      response: new Response(null, { status: 403 }),
    });

    await expect(
      service.watchProjects(
        [PROJECT_ID],
        'token-1',
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects with 502 when Core answers without a stream', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {
      /* silenced */
    });
    subscribeToResources.mockResolvedValue({
      response: { ok: true, status: 200, body: null },
    });

    await expect(
      service.watchProjects(
        [PROJECT_ID],
        'token-1',
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('cancels the Core stream when the consumer stops reading', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            `data: {"url":"${CORE_URL}","action":"UPDATE","timestamp":1}\n\n`,
          ),
        );
      },
      cancel,
    });
    subscribeToResources.mockResolvedValue({ response: new Response(body) });

    const events = await service.watchProjects(
      [PROJECT_ID],
      'token-1',
      new AbortController().signal,
    );
    await events.next();
    await events.return(undefined);

    expect(cancel).toHaveBeenCalledOnce();
  });
});
