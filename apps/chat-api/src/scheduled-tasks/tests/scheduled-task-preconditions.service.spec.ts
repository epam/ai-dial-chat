import {
  BadGatewayException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScheduledTasksService } from '../scheduled-tasks.service';
import { ScheduledTaskErrorCode } from '../types/scheduled-task-error-code.enum';
import {
  createScheduledTasksService,
  makeCacheManager,
  makeConfigService,
  makeDialClient,
  makeExternalServices,
  makeSchedulerConsent,
} from './scheduled-tasks.fixtures';

let fetchMock: ReturnType<typeof vi.fn>;

describe('ScheduledTasksService — DIAL_NATIVE application consent', () => {
  const body = {
    displayName: 'Daily summary',
    model: 'model',
    prompt: 'Summarize',
    trigger: { date: '2030-12-01T09:00:00Z' },
  };
  const schedule = {
    id: 'sched_123',
    display_name: body.displayName,
    trigger: body.trigger,
  };

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(schedule),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const setup = (externalServices = makeExternalServices()) => ({
    externalServices,
    service: createScheduledTasksService(
      makeDialClient(fetchMock),
      makeConfigService('scheduler-app') as never,
      makeCacheManager() as never,
      { resolveDeploymentItem: vi.fn() } as never,
      makeSchedulerConsent(externalServices),
    ),
  });

  const revoked = () =>
    makeExternalServices({
      authenticationType: 'DIAL_NATIVE',
      appLevelAuthStatus: 'SIGNED_OUT',
    });

  it.each([
    [
      'create',
      (service: ScheduledTasksService) =>
        service.createScheduledTask('user', 'token', body),
    ],
    [
      'update',
      (service: ScheduledTasksService) =>
        service.updateScheduledTask('user', 'token', 'sched_123', body),
    ],
    [
      'resume',
      (service: ScheduledTasksService) =>
        service.resumeScheduledTask('user', 'token', 'sched_123'),
    ],
  ])(
    'rejects %s with AdminConsentRequired and never calls DIAL Scheduler when consent is revoked',
    async (_name, run) => {
      const { service, externalServices } = setup(revoked());

      const error = await run(service).catch((err: unknown) => err);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        statusCode: 403,
        code: ScheduledTaskErrorCode.AdminConsentRequired,
      });
      expect(externalServices.getExternalService).toHaveBeenCalledWith(
        'token',
        'scheduler-app',
        'my-oauth-service',
        undefined,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('re-reads consent on every operation instead of caching it', async () => {
    const { service, externalServices } = setup();

    await service.createScheduledTask('user', 'token', body);
    externalServices.getExternalService.mockResolvedValue({
      authenticationType: 'DIAL_NATIVE',
      appLevelAuthStatus: 'SIGNED_OUT',
    });

    await expect(
      service.createScheduledTask('user', 'token', body),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(externalServices.getExternalService).toHaveBeenCalledTimes(2);
  });

  it('allows pause and delete without a consent check, so a user can still stop a task', async () => {
    const { service, externalServices } = setup(revoked());

    await service.pauseScheduledTask('user', 'token', 'sched_123');
    await service.deleteScheduledTask('user', 'token', 'sched_123');

    expect(externalServices.getExternalService).not.toHaveBeenCalled();
  });

  it.each([
    ['an OAuth service', { authenticationType: 'OAUTH' }],
    [
      'an unreported consent status',
      { authenticationType: 'DIAL_NATIVE', appLevelAuthStatus: undefined },
    ],
  ])('does not block %s', async (_name, status) => {
    const { service } = setup(makeExternalServices(status));

    await expect(
      service.createScheduledTask('user', 'token', body),
    ).resolves.toMatchObject({ id: 'sched_123' });
  });

  it('defers to DIAL Scheduler when the consent lookup itself fails', async () => {
    const externalServices = makeExternalServices();
    externalServices.getExternalService.mockRejectedValue(
      new BadGatewayException(),
    );
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service } = setup(externalServices);

    await expect(
      service.createScheduledTask('user', 'token', body),
    ).resolves.toMatchObject({ id: 'sched_123' });
  });
});
