import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  INestApplication,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureGuard } from '../../app-config/feature-flags/feature.guard';
import { ScheduledTasksController } from '../scheduled-tasks.controller';
import { ScheduledTasksService } from '../scheduled-tasks.service';

const TEST_USER = { sub: 'user-1', at: 'test-access-token' };

const validCreateBody = {
  displayName: 'Daily summary',
  trigger: { date: '2026-07-24T09:00:00.000Z' },
  model: 'gpt-4.1-mini-2025-04-14',
  prompt: 'Summarize my inbox',
};

const mockSchedule = {
  id: 'sched_123',
  displayName: 'Daily summary',
  trigger: { date: '2026-07-24T09:00:00.000Z' },
};

interface MockScheduledTasksService {
  listScheduledTasks: ReturnType<typeof vi.fn>;
  createScheduledTask: ReturnType<typeof vi.fn>;
  getScheduledTask: ReturnType<typeof vi.fn>;
  updateScheduledTask: ReturnType<typeof vi.fn>;
  listScheduledTaskRuns: ReturnType<typeof vi.fn>;
  pauseScheduledTask: ReturnType<typeof vi.fn>;
  resumeScheduledTask: ReturnType<typeof vi.fn>;
  deleteScheduledTask: ReturnType<typeof vi.fn>;
}

async function buildApp(
  service: MockScheduledTasksService,
  featureEnabled = true,
): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [ScheduledTasksController],
    providers: [{ provide: ScheduledTasksService, useValue: service }],
  })
    .overrideGuard(FeatureGuard)
    .useValue({ canActivate: () => featureEnabled })
    .compile();

  const app = module.createNestApplication();
  app.use(
    (
      req: Express.Request & { user?: unknown },
      _res: unknown,
      next: () => void,
    ) => {
      req.user = TEST_USER;
      next();
    },
  );
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  await app.listen(0, '127.0.0.1');
  return app;
}

describe('ScheduledTasksController (integration)', () => {
  let app: INestApplication;
  let service: MockScheduledTasksService;

  beforeEach(async () => {
    service = {
      listScheduledTasks: vi.fn(),
      createScheduledTask: vi.fn(),
      getScheduledTask: vi.fn(),
      updateScheduledTask: vi.fn(),
      listScheduledTaskRuns: vi.fn(),
      pauseScheduledTask: vi.fn(),
      resumeScheduledTask: vi.fn(),
      deleteScheduledTask: vi.fn(),
    };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  describe('GET /api/v1/scheduled-tasks', () => {
    it('returns 200 with the mapped list', async () => {
      service.listScheduledTasks.mockResolvedValue({ items: [mockSchedule] });

      const res = await request(app.getHttpServer())
        .get('/api/v1/scheduled-tasks')
        .expect(200);

      expect(res.body).toEqual({ items: [mockSchedule] });
      expect(service.listScheduledTasks).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        {},
      );
    });

    it('tells the browser not to cache the response, so a just-created task is never served stale from the HTTP cache', async () => {
      service.listScheduledTasks.mockResolvedValue({ items: [mockSchedule] });

      const res = await request(app.getHttpServer())
        .get('/api/v1/scheduled-tasks')
        .expect(200);

      expect(res.headers['cache-control']).toBe('private, no-store');
    });

    it('forwards valid limit/offset/search query params to the service', async () => {
      service.listScheduledTasks.mockResolvedValue({ items: [mockSchedule] });

      await request(app.getHttpServer())
        .get('/api/v1/scheduled-tasks?limit=12&offset=24&search=inbox')
        .expect(200);

      expect(service.listScheduledTasks).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        { limit: 12, offset: 24, search: 'inbox' },
      );
    });

    it('returns 400 when limit is out of range', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/scheduled-tasks?limit=101')
        .expect(400);
      expect(service.listScheduledTasks).not.toHaveBeenCalled();
    });

    it('returns 400 when offset is negative', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/scheduled-tasks?offset=-1')
        .expect(400);
      expect(service.listScheduledTasks).not.toHaveBeenCalled();
    });

    it('forwards a valid sort query param to the service', async () => {
      service.listScheduledTasks.mockResolvedValue({ items: [mockSchedule] });

      await request(app.getHttpServer())
        .get('/api/v1/scheduled-tasks?sort=nameAZ')
        .expect(200);

      expect(service.listScheduledTasks).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        { sort: 'nameAZ' },
      );
    });

    it('returns 400 for an invalid sort query parameter', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/scheduled-tasks?sort=oldest')
        .expect(400);
      expect(service.listScheduledTasks).not.toHaveBeenCalled();
    });

    it('returns 401 when the service reports the caller is not authenticated', async () => {
      service.listScheduledTasks.mockRejectedValue(new UnauthorizedException());
      await request(app.getHttpServer())
        .get('/api/v1/scheduled-tasks')
        .expect(401);
    });

    it('returns 502 when the service reports a DIAL Core error', async () => {
      service.listScheduledTasks.mockRejectedValue(
        new BadGatewayException('DIAL Core returned an error response'),
      );
      await request(app.getHttpServer())
        .get('/api/v1/scheduled-tasks')
        .expect(502);
    });

    it('returns 503 when the service reports DIAL Core unavailable', async () => {
      service.listScheduledTasks.mockRejectedValue(
        new ServiceUnavailableException('DIAL Core is unreachable'),
      );
      await request(app.getHttpServer())
        .get('/api/v1/scheduled-tasks')
        .expect(503);
    });
  });

  describe('POST /api/v1/scheduled-tasks', () => {
    it('returns 201 with the created schedule', async () => {
      service.createScheduledTask.mockResolvedValue(mockSchedule);

      const res = await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks')
        .send(validCreateBody)
        .expect(201);

      expect(res.body).toEqual(mockSchedule);
      expect(service.createScheduledTask).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        expect.objectContaining(validCreateBody),
      );
    });

    it('returns 400 when displayName is missing', async () => {
      const { displayName: _displayName, ...rest } = validCreateBody;
      await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks')
        .send(rest)
        .expect(400);
      expect(service.createScheduledTask).not.toHaveBeenCalled();
    });

    it('returns 400 when prompt is missing', async () => {
      const { prompt: _prompt, ...rest } = validCreateBody;
      await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks')
        .send(rest)
        .expect(400);
      expect(service.createScheduledTask).not.toHaveBeenCalled();
    });

    it('returns 400 when trigger is missing', async () => {
      const { trigger: _trigger, ...rest } = validCreateBody;
      await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks')
        .send(rest)
        .expect(400);
      expect(service.createScheduledTask).not.toHaveBeenCalled();
    });

    it.each([
      {
        name: 'contains a non-string value',
        fields: { minute: { value: '0' }, hour: '9' },
      },
      {
        name: 'contains an unsupported field',
        fields: { minute: '0', timezone: 'UTC' },
      },
      {
        name: 'contains an out-of-range value',
        fields: { minute: '0', hour: '24' },
      },
      {
        name: 'contains an out-of-range day of week',
        fields: { minute: '0', day_of_week: '7' },
      },
      {
        name: 'contains a reversed range',
        fields: { minute: '30-10', hour: '9' },
      },
      {
        name: 'is empty',
        fields: {},
      },
    ])('returns 400 when cron.fields $name', async ({ fields }) => {
      await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks')
        .send({
          ...validCreateBody,
          trigger: { cron: { fields } },
        })
        .expect(400);
      expect(service.createScheduledTask).not.toHaveBeenCalled();
    });

    it('accepts supported cron expressions', async () => {
      service.createScheduledTask.mockResolvedValue(mockSchedule);
      const body = {
        ...validCreateBody,
        trigger: {
          cron: {
            fields: {
              minute: '*/15',
              hour: '9-17',
              day_of_week: 'mon-fri',
            },
          },
        },
      };

      await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks')
        .send(body)
        .expect(201);

      expect(service.createScheduledTask).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        expect.objectContaining(body),
      );
    });

    it('returns 201 when description is provided', async () => {
      service.createScheduledTask.mockResolvedValue({
        ...mockSchedule,
        description: 'Summarizes unread inbox items every morning',
      });
      const body = {
        ...validCreateBody,
        description: 'Summarizes unread inbox items every morning',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks')
        .send(body)
        .expect(201);

      expect(res.body.description).toBe(
        'Summarizes unread inbox items every morning',
      );
      expect(service.createScheduledTask).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        expect.objectContaining(body),
      );
    });

    it('returns 400 when description exceeds 500 characters', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks')
        .send({ ...validCreateBody, description: 'a'.repeat(501) })
        .expect(400);
      expect(service.createScheduledTask).not.toHaveBeenCalled();
    });

    it('returns 400 when the body includes a client-supplied stream field', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks')
        .send({ ...validCreateBody, stream: true })
        .expect(400);
      expect(service.createScheduledTask).not.toHaveBeenCalled();
    });

    it('returns 400 when the mapper rejects an invalid trigger', async () => {
      service.createScheduledTask.mockRejectedValue(
        new BadRequestException(
          'trigger must specify exactly one of "date" or "cron"',
        ),
      );
      await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks')
        .send({
          ...validCreateBody,
          trigger: {
            date: validCreateBody.trigger.date,
            cron: { fields: { minute: '0' } },
          },
        })
        .expect(400);
    });

    it('accepts a cron trigger with startDate and endDate', async () => {
      service.createScheduledTask.mockResolvedValue(mockSchedule);
      const body = {
        ...validCreateBody,
        trigger: {
          cron: {
            fields: { hour: '9', minute: '0' },
            startDate: '2026-08-01T00:00:00.000Z',
            endDate: '2026-12-31T23:59:59.999Z',
          },
        },
      };

      await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks')
        .send(body)
        .expect(201);

      expect(service.createScheduledTask).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        expect.objectContaining(body),
      );
    });

    it('returns 400 when startDate is not a valid ISO 8601 string', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks')
        .send({
          ...validCreateBody,
          trigger: {
            cron: {
              fields: { hour: '9', minute: '0' },
              startDate: 'not-a-date',
            },
          },
        })
        .expect(400);
      expect(service.createScheduledTask).not.toHaveBeenCalled();
    });

    it('returns 400 when the mapper rejects an inverted cron window', async () => {
      service.createScheduledTask.mockRejectedValue(
        new BadRequestException(
          'trigger.cron.endDate must be strictly after trigger.cron.startDate',
        ),
      );
      await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks')
        .send({
          ...validCreateBody,
          trigger: {
            cron: {
              fields: { hour: '9', minute: '0' },
              startDate: '2026-12-31T23:59:59.999Z',
              endDate: '2026-08-01T00:00:00.000Z',
            },
          },
        })
        .expect(400);
    });

    it('returns 401 when the service reports the caller is not authenticated', async () => {
      service.createScheduledTask.mockRejectedValue(
        new UnauthorizedException(),
      );
      await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks')
        .send(validCreateBody)
        .expect(401);
    });

    it('returns 502 when the service reports a DIAL Core error', async () => {
      service.createScheduledTask.mockRejectedValue(
        new BadGatewayException('DIAL Core returned an error response'),
      );
      await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks')
        .send(validCreateBody)
        .expect(502);
    });

    it('returns 503 when the service reports DIAL Core unavailable', async () => {
      service.createScheduledTask.mockRejectedValue(
        new ServiceUnavailableException('DIAL Core is unreachable'),
      );
      await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks')
        .send(validCreateBody)
        .expect(503);
    });
  });

  describe('GET /api/v1/scheduled-tasks/:scheduleId', () => {
    it('returns 200 with the schedule', async () => {
      service.getScheduledTask.mockResolvedValue(mockSchedule);

      const res = await request(app.getHttpServer())
        .get('/api/v1/scheduled-tasks/sched_123')
        .expect(200);

      expect(res.body).toEqual(mockSchedule);
      expect(service.getScheduledTask).toHaveBeenCalledWith(
        TEST_USER.at,
        'sched_123',
      );
    });

    it('returns 400 for a path-traversal-shaped scheduleId without calling the service', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/scheduled-tasks/..%2F..%2Fetc%2Fpasswd')
        .expect(400);
      expect(service.getScheduledTask).not.toHaveBeenCalled();
    });

    it('returns 401 when the service reports the caller is not authenticated', async () => {
      service.getScheduledTask.mockRejectedValue(new UnauthorizedException());
      await request(app.getHttpServer())
        .get('/api/v1/scheduled-tasks/sched_123')
        .expect(401);
    });

    it('returns 404 when the schedule does not exist', async () => {
      service.getScheduledTask.mockRejectedValue(
        new NotFoundException('Resource not found'),
      );
      await request(app.getHttpServer())
        .get('/api/v1/scheduled-tasks/sched_missing')
        .expect(404);
    });

    it('returns 502/503 on upstream failure', async () => {
      service.getScheduledTask.mockRejectedValue(
        new ServiceUnavailableException('DIAL Core is unreachable'),
      );
      await request(app.getHttpServer())
        .get('/api/v1/scheduled-tasks/sched_123')
        .expect(503);
    });
  });

  describe('GET /api/v1/scheduled-tasks/:scheduleId/runs', () => {
    const mockRuns = {
      items: [
        {
          id: 'run_1',
          status: 'Success',
          startTime: '2026-07-24T09:00:00.000Z',
          endTime: '2026-07-24T09:01:39.000Z',
          durationSeconds: 99,
        },
      ],
      count: 1,
      limit: 20,
      offset: 0,
      next: null,
      previous: null,
    };

    it('returns 200 with the mapped run history', async () => {
      service.listScheduledTaskRuns.mockResolvedValue(mockRuns);

      const res = await request(app.getHttpServer())
        .get('/api/v1/scheduled-tasks/sched_123/runs')
        .expect(200);

      expect(res.body).toEqual(mockRuns);
      expect(service.listScheduledTaskRuns).toHaveBeenCalledWith(
        TEST_USER.at,
        'sched_123',
        {},
      );
    });

    it('does not cache the response', async () => {
      service.listScheduledTaskRuns.mockResolvedValue(mockRuns);

      const res = await request(app.getHttpServer())
        .get('/api/v1/scheduled-tasks/sched_123/runs')
        .expect(200);

      expect(res.headers['cache-control']).toBe('private, no-store');
    });

    it('forwards valid limit/offset query params', async () => {
      service.listScheduledTaskRuns.mockResolvedValue(mockRuns);

      await request(app.getHttpServer())
        .get('/api/v1/scheduled-tasks/sched_123/runs?limit=20&offset=40')
        .expect(200);

      expect(service.listScheduledTaskRuns).toHaveBeenCalledWith(
        TEST_USER.at,
        'sched_123',
        { limit: 20, offset: 40 },
      );
    });

    it('returns 400 when limit is out of range', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/scheduled-tasks/sched_123/runs?limit=101')
        .expect(400);
      expect(service.listScheduledTaskRuns).not.toHaveBeenCalled();
    });

    it('returns 400 when offset is negative', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/scheduled-tasks/sched_123/runs?offset=-1')
        .expect(400);
      expect(service.listScheduledTaskRuns).not.toHaveBeenCalled();
    });

    it('returns 400 for a path-traversal-shaped scheduleId without calling the service', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/scheduled-tasks/..%2F..%2Fetc%2Fpasswd/runs')
        .expect(400);
      expect(service.listScheduledTaskRuns).not.toHaveBeenCalled();
    });

    it('returns 401 when the service reports the caller is not authenticated', async () => {
      service.listScheduledTaskRuns.mockRejectedValue(
        new UnauthorizedException(),
      );
      await request(app.getHttpServer())
        .get('/api/v1/scheduled-tasks/sched_123/runs')
        .expect(401);
    });

    it('returns 404 when the schedule does not exist', async () => {
      service.listScheduledTaskRuns.mockRejectedValue(
        new NotFoundException('Resource not found'),
      );
      await request(app.getHttpServer())
        .get('/api/v1/scheduled-tasks/sched_missing/runs')
        .expect(404);
    });

    it('returns 502/503 on upstream failure', async () => {
      service.listScheduledTaskRuns.mockRejectedValue(
        new ServiceUnavailableException('DIAL Core is unreachable'),
      );
      await request(app.getHttpServer())
        .get('/api/v1/scheduled-tasks/sched_123/runs')
        .expect(503);
    });
  });

  describe('PUT /api/v1/scheduled-tasks/:scheduleId', () => {
    it('returns 200 with the updated schedule', async () => {
      service.updateScheduledTask.mockResolvedValue(mockSchedule);

      const res = await request(app.getHttpServer())
        .put('/api/v1/scheduled-tasks/sched_123')
        .send(validCreateBody)
        .expect(200);

      expect(res.body).toEqual(mockSchedule);
      expect(service.updateScheduledTask).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        'sched_123',
        expect.objectContaining(validCreateBody),
      );
    });

    it('returns 400 for an invalid scheduleId', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/scheduled-tasks/..%2F..%2Fetc%2Fpasswd')
        .send(validCreateBody)
        .expect(400);
      expect(service.updateScheduledTask).not.toHaveBeenCalled();
    });

    it('returns 400 for an invalid body', async () => {
      const { model: _model, ...rest } = validCreateBody;
      await request(app.getHttpServer())
        .put('/api/v1/scheduled-tasks/sched_123')
        .send(rest)
        .expect(400);
      expect(service.updateScheduledTask).not.toHaveBeenCalled();
    });

    it('returns 400 when description exceeds 500 characters', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/scheduled-tasks/sched_123')
        .send({ ...validCreateBody, description: 'a'.repeat(501) })
        .expect(400);
      expect(service.updateScheduledTask).not.toHaveBeenCalled();
    });

    it('returns 400 when the body includes a client-supplied stream field', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/scheduled-tasks/sched_123')
        .send({ ...validCreateBody, stream: true })
        .expect(400);
      expect(service.updateScheduledTask).not.toHaveBeenCalled();
    });

    it('returns 401 when the service reports the caller is not authenticated', async () => {
      service.updateScheduledTask.mockRejectedValue(
        new UnauthorizedException(),
      );
      await request(app.getHttpServer())
        .put('/api/v1/scheduled-tasks/sched_123')
        .send(validCreateBody)
        .expect(401);
    });

    it('returns 404 when the schedule does not exist', async () => {
      service.updateScheduledTask.mockRejectedValue(
        new NotFoundException('Resource not found'),
      );
      await request(app.getHttpServer())
        .put('/api/v1/scheduled-tasks/sched_missing')
        .send(validCreateBody)
        .expect(404);
    });

    it('returns 502/503 on upstream failure', async () => {
      service.updateScheduledTask.mockRejectedValue(
        new BadGatewayException('DIAL Core returned an error response'),
      );
      await request(app.getHttpServer())
        .put('/api/v1/scheduled-tasks/sched_123')
        .send(validCreateBody)
        .expect(502);
    });
  });
  describe('POST /api/v1/scheduled-tasks/:scheduleId/pause', () => {
    it('returns 200 with the paused schedule', async () => {
      const pausedSchedule = { ...mockSchedule, isActive: false };
      service.pauseScheduledTask.mockResolvedValue(pausedSchedule);

      const res = await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks/sched_123/pause')
        .expect(200);

      expect(res.body).toEqual(pausedSchedule);
      expect(service.pauseScheduledTask).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        'sched_123',
      );
    });

    it('returns 400 for a path-traversal-shaped scheduleId without calling the service', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks/..%2F..%2Fetc%2Fpasswd/pause')
        .expect(400);
      expect(service.pauseScheduledTask).not.toHaveBeenCalled();
    });

    it('returns 401 when the service reports the caller is not authenticated', async () => {
      service.pauseScheduledTask.mockRejectedValue(new UnauthorizedException());
      await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks/sched_123/pause')
        .expect(401);
    });

    it('returns 404 when the schedule does not exist', async () => {
      service.pauseScheduledTask.mockRejectedValue(
        new NotFoundException('Resource not found'),
      );
      await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks/sched_missing/pause')
        .expect(404);
    });

    it('returns 429 when the service reports a rate limit', async () => {
      service.pauseScheduledTask.mockRejectedValue(
        new HttpException('Too many requests', 429),
      );
      await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks/sched_123/pause')
        .expect(429);
    });

    it('returns 502/503 on upstream failure', async () => {
      service.pauseScheduledTask.mockRejectedValue(
        new BadGatewayException('DIAL Core returned an error response'),
      );
      await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks/sched_123/pause')
        .expect(502);
    });
  });

  describe('POST /api/v1/scheduled-tasks/:scheduleId/resume', () => {
    it('returns 200 with the resumed schedule', async () => {
      const resumedSchedule = {
        ...mockSchedule,
        isActive: true,
        nextRunTime: '2026-07-28T12:00:00.000Z',
      };
      service.resumeScheduledTask.mockResolvedValue(resumedSchedule);

      const res = await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks/sched_123/resume')
        .expect(200);

      expect(res.body).toEqual(resumedSchedule);
      expect(service.resumeScheduledTask).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        'sched_123',
      );
    });

    it('returns 400 for a path-traversal-shaped scheduleId without calling the service', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks/..%2F..%2Fetc%2Fpasswd/resume')
        .expect(400);
      expect(service.resumeScheduledTask).not.toHaveBeenCalled();
    });

    it('returns 401 when the service reports the caller is not authenticated', async () => {
      service.resumeScheduledTask.mockRejectedValue(
        new UnauthorizedException(),
      );
      await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks/sched_123/resume')
        .expect(401);
    });

    it('returns 404 when the schedule does not exist', async () => {
      service.resumeScheduledTask.mockRejectedValue(
        new NotFoundException('Resource not found'),
      );
      await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks/sched_missing/resume')
        .expect(404);
    });

    it('returns 429 when the service reports a rate limit', async () => {
      service.resumeScheduledTask.mockRejectedValue(
        new HttpException('Too many requests', 429),
      );
      await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks/sched_123/resume')
        .expect(429);
    });

    it('returns 502/503 on upstream failure', async () => {
      service.resumeScheduledTask.mockRejectedValue(
        new ServiceUnavailableException('DIAL Core is unreachable'),
      );
      await request(app.getHttpServer())
        .post('/api/v1/scheduled-tasks/sched_123/resume')
        .expect(503);
    });
  });

  describe('DELETE /api/v1/scheduled-tasks/:scheduleId', () => {
    it('returns 204 with an empty body for an authenticated owner delete', async () => {
      service.deleteScheduledTask.mockResolvedValue(undefined);

      const res = await request(app.getHttpServer())
        .delete('/api/v1/scheduled-tasks/sched_123')
        .expect(204);

      expect(res.body).toEqual({});
      expect(res.text).toBe('');
      expect(service.deleteScheduledTask).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        'sched_123',
      );
    });

    it('does not cache the response', async () => {
      service.deleteScheduledTask.mockResolvedValue(undefined);

      const res = await request(app.getHttpServer())
        .delete('/api/v1/scheduled-tasks/sched_123')
        .expect(204);

      expect(res.headers['cache-control']).toBe('private, no-store');
    });

    it('returns 400 for a path-traversal-shaped scheduleId without calling the service', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/scheduled-tasks/..%2F..%2Fetc%2Fpasswd')
        .expect(400);
      expect(service.deleteScheduledTask).not.toHaveBeenCalled();
    });

    it('returns 401 when the service reports the caller is not authenticated', async () => {
      service.deleteScheduledTask.mockRejectedValue(
        new UnauthorizedException(),
      );
      await request(app.getHttpServer())
        .delete('/api/v1/scheduled-tasks/sched_123')
        .expect(401);
    });

    it('returns 404 when the schedule does not exist, is owned by another user, or is already hard-deleted', async () => {
      service.deleteScheduledTask.mockRejectedValue(
        new NotFoundException('Resource not found'),
      );
      await request(app.getHttpServer())
        .delete('/api/v1/scheduled-tasks/sched_missing')
        .expect(404);
    });

    it('returns 409 when the schedule is already soft-deleted', async () => {
      service.deleteScheduledTask.mockRejectedValue(
        new ConflictException('Conflict'),
      );
      await request(app.getHttpServer())
        .delete('/api/v1/scheduled-tasks/sched_123')
        .expect(409);
    });

    it('returns 429 when the service reports a rate limit', async () => {
      service.deleteScheduledTask.mockRejectedValue(
        new HttpException('Too many requests', 429),
      );
      await request(app.getHttpServer())
        .delete('/api/v1/scheduled-tasks/sched_123')
        .expect(429);
    });

    it('returns 502/503 on upstream failure', async () => {
      service.deleteScheduledTask.mockRejectedValue(
        new BadGatewayException('DIAL Scheduler could not unregister the job'),
      );
      await request(app.getHttpServer())
        .delete('/api/v1/scheduled-tasks/sched_123')
        .expect(502);
    });
  });
});

describe('ScheduledTasksController — unauthenticated / feature-disabled', () => {
  it('returns 403 for every route when the feature is disabled', async () => {
    const service: MockScheduledTasksService = {
      listScheduledTasks: vi.fn(),
      createScheduledTask: vi.fn(),
      getScheduledTask: vi.fn(),
      updateScheduledTask: vi.fn(),
      listScheduledTaskRuns: vi.fn(),
      pauseScheduledTask: vi.fn(),
      resumeScheduledTask: vi.fn(),
      deleteScheduledTask: vi.fn(),
    };
    const app = await buildApp(service, false);

    await request(app.getHttpServer())
      .get('/api/v1/scheduled-tasks')
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/scheduled-tasks')
      .send(validCreateBody)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/scheduled-tasks/sched_123')
      .expect(403);
    await request(app.getHttpServer())
      .put('/api/v1/scheduled-tasks/sched_123')
      .send(validCreateBody)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/scheduled-tasks/sched_123/runs')
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/scheduled-tasks/sched_123/pause')
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/scheduled-tasks/sched_123/resume')
      .expect(403);
    await request(app.getHttpServer())
      .delete('/api/v1/scheduled-tasks/sched_123')
      .expect(403);

    expect(service.listScheduledTasks).not.toHaveBeenCalled();
    expect(service.createScheduledTask).not.toHaveBeenCalled();
    expect(service.getScheduledTask).not.toHaveBeenCalled();
    expect(service.updateScheduledTask).not.toHaveBeenCalled();
    expect(service.listScheduledTaskRuns).not.toHaveBeenCalled();
    expect(service.pauseScheduledTask).not.toHaveBeenCalled();
    expect(service.resumeScheduledTask).not.toHaveBeenCalled();
    expect(service.deleteScheduledTask).not.toHaveBeenCalled();

    await app.close();
  });
});
