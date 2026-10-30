import {
  BadGatewayException,
  ConflictException,
  HttpException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createScheduledTasksService,
  makeCacheManager,
  makeConfigService,
  makeDialClient,
  makeSchedulerConsent,
} from './scheduled-tasks.fixtures';

let fetchMock: ReturnType<typeof vi.fn>;

describe('ScheduledTasksService — upstream error reason and code', () => {
  const body = {
    displayName: 'Daily summary',
    model: 'model',
    prompt: 'Summarize',
    trigger: { date: '2030-12-01T09:00:00Z' },
  };

  const upstream = (status: number, json: unknown) =>
    fetchMock.mockResolvedValue({
      ok: false,
      status,
      json: () => Promise.resolve(json),
    });

  const makeService = () =>
    createScheduledTasksService(
      makeDialClient(fetchMock),
      makeConfigService('scheduler-app') as never,
      makeCacheManager() as never,
      { resolveDeploymentItem: vi.fn() } as never,
      makeSchedulerConsent() as never,
    );

  const failure = (promise: Promise<unknown>) =>
    promise.then(
      () => {
        throw new Error('expected a rejection');
      },
      (err: unknown) => err as HttpException,
    );

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the generic message on a Scheduler 5xx and adds its reason and code', async () => {
    upstream(500, {
      error: {
        message: 'Application consent revoked',
        code: 'consent_revoked',
      },
    });

    const error = await failure(
      makeService().createScheduledTask('user', 'token', body),
    );

    expect(error).toBeInstanceOf(BadGatewayException);
    expect(error.getResponse()).toMatchObject({
      statusCode: 502,
      message: 'DIAL Core returned a server error',
      upstreamMessage: 'Application consent revoked',
      upstreamCode: 'consent_revoked',
    });
  });

  it('turns a bare-string 409 body on delete into upstreamMessage only', async () => {
    upstream(409, 'Schedule is already deleted');

    const error = await failure(
      makeService().deleteScheduledTask('user', 'token', 'sched_123'),
    );

    expect(error).toBeInstanceOf(ConflictException);
    const response = error.getResponse() as Record<string, unknown>;
    expect(response).toMatchObject({
      message: 'Conflict',
      upstreamMessage: 'Schedule is already deleted',
    });
    expect(response).not.toHaveProperty('upstreamCode');
  });

  it.each([401, 403, 404])(
    'never exposes upstream text or code for %i',
    async (status) => {
      upstream(status, { error: { message: 'secret detail', code: 'x' } });

      const error = await failure(
        makeService().getScheduledTask('token', 'sched_123'),
      );

      expect(JSON.stringify(error.getResponse())).not.toMatch(
        /upstream|secret detail/,
      );
    },
  );

  it('drops an unsafe code and truncates an oversized message', async () => {
    upstream(400, {
      error: { message: 'x'.repeat(5000), code: 'bad code; drop table' },
    });

    const error = await failure(
      makeService().getScheduledTask('token', 'sched_123'),
    );

    const response = error.getResponse() as Record<string, unknown>;
    expect(response.upstreamMessage).toBe('x'.repeat(1000));
    expect(response).not.toHaveProperty('upstreamCode');
  });

  it('never takes the typed code from the upstream body', async () => {
    upstream(502, { code: 'scheduler_down', message: 'Scheduler is down' });

    const error = await failure(
      makeService().pauseScheduledTask('user', 'token', 'sched_123'),
    );

    const response = error.getResponse() as Record<string, unknown>;
    expect(response).not.toHaveProperty('code');
    expect(response).toMatchObject({
      upstreamCode: 'scheduler_down',
      upstreamMessage: 'Scheduler is down',
    });
  });

  it('adds no upstream fields when Scheduler sends no reason', async () => {
    upstream(502, {});

    const error = await failure(
      makeService().getScheduledTask('token', 'sched_123'),
    );

    expect(error.getResponse()).not.toHaveProperty('upstreamMessage');
  });

  it('adds no upstream fields on a timeout', async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new Error('aborted'), { name: 'AbortError' }),
    );

    const error = await failure(
      makeService().getScheduledTask('token', 'sched_123'),
    );

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error.getResponse()).not.toHaveProperty('upstreamMessage');
  });
});
