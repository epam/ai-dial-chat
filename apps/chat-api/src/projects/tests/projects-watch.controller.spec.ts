import { EventEmitter } from 'node:events';
import {
  BadRequestException,
  ForbiddenException,
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureGuard } from '../../app-config/feature-flags/feature.guard';
import type { SessionUser } from '../../auth/session/session.types';
import { ProjectsDownloadService } from '../download/projects-download.service';
import { ProjectWatchAction } from '../dto/project-watch-action.enum';
import type { ProjectWatchEventDto } from '../dto/project-watch-event.dto';
import { ProjectContextUploadInterceptor } from '../project-context-upload.interceptor';
import { ProjectsController } from '../projects.controller';
import { ProjectsService } from '../projects.service';
import { ProjectsUpdateService } from '../update/projects-update.service';
import { ProjectsWatchService } from '../watch/projects-watch.service';

const TEST_USER = {
  sub: 'user-1',
  at: 'test-access-token',
  bucket: 'test-bucket',
} as SessionUser;

const PROJECT_ID = 'projects/test-bucket/alpha';

const eventsOf = async function* (
  events: ProjectWatchEventDto[],
): AsyncGenerator<ProjectWatchEventDto> {
  yield* events;
};

const buildApp = async (
  watchService: { watchProjects: ReturnType<typeof vi.fn> },
  isFeatureEnabled = true,
): Promise<INestApplication> => {
  const module = await Test.createTestingModule({
    controllers: [ProjectsController],
    providers: [
      { provide: ProjectsService, useValue: {} },
      { provide: ProjectsDownloadService, useValue: {} },
      { provide: ProjectsUpdateService, useValue: {} },
      { provide: ProjectsWatchService, useValue: watchService },
      ProjectContextUploadInterceptor,
      { provide: ConfigService, useValue: { get: () => undefined } },
    ],
  })
    .overrideGuard(FeatureGuard)
    .useValue({ canActivate: () => isFeatureEnabled })
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
  return app;
};

describe('ProjectsController watchProjects (integration)', () => {
  let app: INestApplication;
  let watchService: { watchProjects: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    watchService = { watchProjects: vi.fn() };
  });

  afterEach(async () => {
    await app?.close();
  });

  it('streams the mapped events as SSE after the init comment', async () => {
    watchService.watchProjects.mockResolvedValue(
      eventsOf([
        {
          id: PROJECT_ID,
          action: ProjectWatchAction.Update,
          timestamp: 5,
          etag: 'e1',
        },
        { id: PROJECT_ID, action: ProjectWatchAction.Delete, timestamp: 9 },
      ]),
    );
    app = await buildApp(watchService);

    const res = await request(app.getHttpServer())
      .post('/api/v1/projects/watch')
      /* The SSE response asks for keep-alive. Without closing the socket, a
       * suite running in parallel intermittently read stray responses. */
      .set('Connection', 'close')
      .send({ ids: [PROJECT_ID] });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toBe(
      ': init\n\n' +
        `data: {"id":"${PROJECT_ID}","action":"UPDATE","timestamp":5,"etag":"e1"}\n\n` +
        `data: {"id":"${PROJECT_ID}","action":"DELETE","timestamp":9}\n\n`,
    );
    expect(watchService.watchProjects).toHaveBeenCalledWith(
      [PROJECT_ID],
      TEST_USER.at,
      expect.any(AbortSignal),
    );
  });

  it.each([
    ['no ids', { ids: [] }],
    [
      'too many ids',
      {
        ids: Array.from(
          { length: 1001 },
          (_, index) => `projects/test-bucket/p${index}`,
        ),
      },
    ],
    ['duplicate ids', { ids: [PROJECT_ID, PROJECT_ID] }],
    ['a path traversal id', { ids: ['projects/test-bucket/../other/secret'] }],
    ['a non-project id', { ids: ['conversations/test-bucket/chat'] }],
    ['an unknown field', { ids: [PROJECT_ID], url: 'projects/x/y' }],
  ])('rejects %s with 400 without calling DIAL Core', async (_, body) => {
    app = await buildApp(watchService);

    const res = await request(app.getHttpServer())
      .post('/api/v1/projects/watch')
      .send(body);

    expect(res.status).toBe(400);
    expect(watchService.watchProjects).not.toHaveBeenCalled();
  });

  it('is rejected by the feature guard when projects are disabled', async () => {
    app = await buildApp(watchService, false);

    const res = await request(app.getHttpServer())
      .post('/api/v1/projects/watch')
      .send({ ids: [PROJECT_ID] });

    expect(res.status).toBe(403);
    expect(watchService.watchProjects).not.toHaveBeenCalled();
  });

  it.each([
    [400, new BadRequestException('Invalid request to DIAL Core')],
    [403, new ForbiddenException()],
  ])(
    'answers %s without opening a stream when DIAL Core refuses the subscription',
    async (status, error) => {
      watchService.watchProjects.mockRejectedValue(error);
      app = await buildApp(watchService);

      const res = await request(app.getHttpServer())
        .post('/api/v1/projects/watch')
        .send({ ids: [PROJECT_ID] });

      expect(res.status).toBe(status);
      expect(res.headers['content-type']).not.toContain('text/event-stream');
    },
  );
});

describe('ProjectsController watchProjects (client disconnect)', () => {
  it('aborts the DIAL Core subscription and stops the stream when the client goes away', async () => {
    let capturedSignal: AbortSignal | undefined;
    let isCleanedUp = false;
    const watchService = {
      watchProjects: vi.fn(
        async (_ids: string[], _at: string, signal: AbortSignal) => {
          capturedSignal = signal;
          return (async function* () {
            try {
              await new Promise<void>((resolve) =>
                signal.addEventListener('abort', () => resolve()),
              );
              yield* [];
            } finally {
              isCleanedUp = true;
            }
          })();
        },
      ),
    };
    const controller = new ProjectsController(
      {} as ProjectsService,
      {} as ProjectsDownloadService,
      {} as ProjectsUpdateService,
      watchService as unknown as ProjectsWatchService,
    );
    const res = Object.assign(new EventEmitter(), {
      writableEnded: false,
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn(() => true),
      end: vi.fn(function (this: { writableEnded: boolean }) {
        this.writableEnded = true;
      }),
    });

    const handled = controller.watchProjects(
      { user: TEST_USER } as unknown as Request,
      res as unknown as Response,
      { ids: [PROJECT_ID] },
    );
    await vi.waitFor(() =>
      expect(res.write).toHaveBeenCalledWith(': init\n\n'),
    );
    res.emit('close');
    await handled;

    expect(capturedSignal?.aborted).toBe(true);
    expect(isCleanedUp).toBe(true);
    expect(res.listenerCount('close')).toBe(0);
  });
});
