import { vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import { SchedulerConsentService } from '../../external-services/scheduler-consent.service';
import { ScheduledTaskCompletionService } from '../scheduled-task-completion.service';
import { ScheduledTaskPreconditionsService } from '../scheduled-task-preconditions.service';
import { ScheduledTaskRunsService } from '../scheduled-task-runs.service';
import { ScheduledTasksListCacheService } from '../scheduled-tasks-list-cache.service';
import { ScheduledTasksService } from '../scheduled-tasks.service';
import { SchedulerUpstreamClient } from '../scheduler-upstream.client';

export const makeConfigService = (
  schedulerAppId?: string,
  timeoutMs = 10_000,
  schedulerServiceId: string | undefined = 'my-oauth-service',
) => ({
  get: vi.fn((key: string) => {
    const config: Record<string, unknown> = {
      SCHEDULER_APP_ID: schedulerAppId,
      SCHEDULER_SERVICE_ID: schedulerServiceId,
      SCHEDULER_SERVICE_TIMEOUT_MS: timeoutMs,
    };
    return config[key];
  }),
});

export const makeDialClient = (fetchCore: unknown): DialClientService =>
  ({
    baseUrl: 'http://dial-core',
    dialApiVersion: '2025-01-01-preview',
    fetchCore,
  }) as unknown as DialClientService;

export const makeExternalServices = (
  service: Record<string, unknown> = {
    authenticationType: 'DIAL_NATIVE',
    appLevelAuthStatus: 'SIGNED_IN',
  },
) => ({
  getExternalService: vi.fn().mockResolvedValue(service),
});

export const makeSchedulerConsent = (
  externalServices: ReturnType<
    typeof makeExternalServices
  > = makeExternalServices(),
) =>
  new SchedulerConsentService(
    externalServices as never,
    makeConfigService('scheduler-app') as never,
  );

export const makeCacheManager = () => {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key))),
    set: vi.fn((key: string, value: unknown) => {
      store.set(key, value);
      return Promise.resolve(value);
    }),
    del: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve(true);
    }),
  };
};

/**
 * Builds a `ScheduledTasksService` and its real collaborators from the five
 * inputs, in the order, the service's constructor took before it was split,
 * so every spec wires the facade in one place.
 */
export const createScheduledTasksService = (
  dialClient: DialClientService,
  configService: unknown,
  cacheManager: unknown,
  deploymentsService: unknown,
  schedulerConsentService: unknown,
): ScheduledTasksService => {
  const upstream = new SchedulerUpstreamClient(
    dialClient,
    configService as never,
  );
  return new ScheduledTasksService(
    dialClient,
    upstream,
    new ScheduledTasksListCacheService(cacheManager as never),
    new ScheduledTaskCompletionService(upstream),
    new ScheduledTaskRunsService(upstream, cacheManager as never),
    new ScheduledTaskPreconditionsService(
      schedulerConsentService as never,
      deploymentsService as never,
      upstream,
    ),
    cacheManager as never,
  );
};
