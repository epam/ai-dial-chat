import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  INestApplication,
  Logger,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureGuard } from '../../app-config/feature-flags/feature.guard';
import { AuthSource } from '../../auth/auth-source.enum';
import type { SessionUser } from '../../auth/session/session.types';
import { ConversationService } from '../../conversations/conversation.service';
import {
  GENERATION_SHUTDOWN_FLUSH_MS,
  ConversationGenerationService,
} from '../../conversations/generation/conversation-generation.service';
import { ProjectConversationStore } from '../../conversations/persistence/project-conversation.store';
import { ConversationCompletionsResponder } from '../../conversations/streaming/conversation-completions.responder';
import { DialClientService } from '../../dial/dial-client.service';
import { ConversationReadStateService } from '../../scheduled-task-unread/conversation-read-state.service';
import { ProjectAccessService } from '../access/project-access.service';
import { ProjectConversationsListService } from '../conversations/project-conversations-list.service';
import { ProjectConversationsController } from '../conversations/project-conversations.controller';
import { ProjectConversationsService } from '../conversations/project-conversations.service';

const USER = {
  sub: 'user-1',
  sid: 'session-1',
  at: 'token',
  bucket: 'a1b2c3',
} as SessionUser;
const OWNER_KEY = 'c:session-1';
const OWN = encodeURIComponent('projects/a1b2c3/q4');
const SHARED = encodeURIComponent('projects/z9y8x7/research');
const GENERATION_ID = '11111111-1111-4111-8111-111111111111';

const ok = (data?: unknown) => ({
  data,
  error: undefined,
  response: new Response(null, { status: 200 }),
});

const buildApp = async (
  isFeatureEnabled = true,
  sharedPermissions: string[] = ['READ'],
) => {
  const client = {
    uploadProjectFile: vi.fn(async () => ok()),
    downloadProjectFile: vi.fn(),
    deleteProjectFile: vi.fn(async () => ok()),
    listProjectFileMetadata: vi.fn(async () => ok({ items: [] })),
    getSharedResources: vi.fn(async () =>
      ok({
        resources: [
          {
            nodeType: 'ITEM',
            url: 'projects/z9y8x7/research',
            permissions: sharedPermissions,
          },
        ],
      }),
    ),
  };
  const conversationService = {
    getConversation: vi.fn(),
    saveClientConversation: vi.fn(),
    renameConversation: vi.fn(),
    generateTitle: vi.fn(),
    streamCompletion: vi.fn(),
    stopBackgroundGeneration: vi.fn(),
    stopForegroundGeneration: vi.fn().mockResolvedValue('not_found'),
    resolveBackgroundAttach: vi.fn(),
  };
  const readState = {
    getProjectReadState: vi.fn(async () => ({
      readBefore: 0,
      versions: new Map<string, string>(),
    })),
    markProjectConversationViewed: vi.fn(async () => undefined),
    removeProjectConversation: vi.fn(async () => undefined),
  };
  const module = await Test.createTestingModule({
    controllers: [ProjectConversationsController],
    providers: [
      ProjectAccessService,
      ProjectConversationsService,
      ProjectConversationsListService,
      ProjectConversationStore,
      ConversationCompletionsResponder,
      ConversationGenerationService,
      { provide: GENERATION_SHUTDOWN_FLUSH_MS, useValue: 0 },
      { provide: DialClientService, useValue: { client } },
      { provide: ConversationService, useValue: conversationService },
      {
        provide: CACHE_MANAGER,
        useValue: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
      },
      { provide: ConfigService, useValue: { get: () => 1_800_000 } },
      { provide: ConversationReadStateService, useValue: readState },
    ],
  })
    .overrideGuard(FeatureGuard)
    .useValue({ canActivate: () => isFeatureEnabled })
    .compile();

  const app: INestApplication = module.createNestApplication();
  app.use(
    (
      req: Express.Request & { user?: unknown; authSource?: AuthSource },
      _res: unknown,
      next: () => void,
    ) => {
      req.user = USER;
      req.authSource = AuthSource.Cookie;
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
  return {
    app,
    client,
    conversationService,
    readState,
    generations: module.get(ConversationGenerationService),
  };
};

describe('ProjectConversationsController (integration)', () => {
  let app: INestApplication | undefined;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    vi.restoreAllMocks();
  });

  it('answers 403 on every route when the projects flag is off', async () => {
    const built = await buildApp(false);
    app = built.app;

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${OWN}/conversations`)
      .expect(403);
    expect(built.client.listProjectFileMetadata).not.toHaveBeenCalled();
  });

  it("refuses a view-only recipient's writes with 403 before any Core write or model call", async () => {
    const built = await buildApp();
    app = built.app;

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${SHARED}/conversations`)
      .send({ firstMessage: 'Hi', deploymentId: 'gpt-4o' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${SHARED}/conversations/completions`)
      .send({
        path: 'z9y8x7/research/conversations/x',
        generationId: GENERATION_ID,
        model: 'gpt-4o',
        mode: 'append',
        message: 'Hi',
      })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/api/v1/projects/${SHARED}/conversations/x`)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${SHARED}/conversations/x/generate-title`)
      .expect(403);

    expect(built.conversationService.generateTitle).not.toHaveBeenCalled();
    expect(built.client.uploadProjectFile).not.toHaveBeenCalled();
    expect(built.client.deleteProjectFile).not.toHaveBeenCalled();
    expect(built.conversationService.streamCompletion).not.toHaveBeenCalled();
  });

  it('generates a title for a recipient with WRITE from the project conversation locator', async () => {
    const built = await buildApp(true, ['READ', 'WRITE']);
    app = built.app;
    built.conversationService.generateTitle.mockResolvedValue('Greeting');

    const res = await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${SHARED}/conversations/gpt-4o__Hi__1/generate-title`,
      )
      .expect(200);

    expect(res.body).toEqual({ name: 'Greeting' });
    expect(built.conversationService.generateTitle).toHaveBeenCalledWith(
      'projects/z9y8x7/research/conversations/gpt-4o__Hi__1',
      USER.at,
      USER.bucket,
    );
  });

  it('lets a recipient with WRITE create a chat in the owner bucket', async () => {
    const built = await buildApp(true, ['READ', 'WRITE']);
    app = built.app;

    const res = await request(app.getHttpServer())
      .post(`/api/v1/projects/${SHARED}/conversations`)
      .send({ firstMessage: 'Hi', deploymentId: 'gpt-4o' })
      .expect(201);

    expect(res.body.id).toMatch(/^projects\/z9y8x7\/research\/conversations\//);
    const [bucket] = built.client.uploadProjectFile.mock
      .calls[0] as unknown as [string];
    expect(bucket).toBe('z9y8x7');
  });

  it('streams a completion for a recipient with WRITE', async () => {
    const built = await buildApp(true, ['READ', 'WRITE']);
    app = built.app;
    built.conversationService.streamCompletion.mockImplementation(
      async function* (..._args: unknown[]) {
        const onReady = _args[10] as () => void;
        onReady();
        yield 'data: {}\n\n';
      },
    );

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${SHARED}/conversations/completions`)
      .send({
        path: 'z9y8x7/research/conversations/x',
        generationId: GENERATION_ID,
        model: 'gpt-4o',
        mode: 'append',
        message: 'Hi',
      })
      .expect(200);

    const [locator, token] = built.conversationService.streamCompletion.mock
      .calls[0] as unknown as [string, string];
    expect(locator).toBe('projects/z9y8x7/research/conversations/x');
    expect(token).toBe(USER.at);
  });

  it('refuses a write to an organization project without asking DIAL Core', async () => {
    const built = await buildApp();
    app = built.app;

    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${encodeURIComponent('projects/public/handbook')}/conversations`,
      )
      .send({ firstMessage: 'Hi', deploymentId: 'gpt-4o' })
      .expect(403);

    expect(built.client.getSharedResources).not.toHaveBeenCalled();
    expect(built.client.uploadProjectFile).not.toHaveBeenCalled();
  });

  it('answers 400 for a completion path outside the addressed project', async () => {
    const built = await buildApp();
    app = built.app;

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${OWN}/conversations/completions`)
      .send({
        path: 'a1b2c3/other/conversations/x',
        generationId: GENERATION_ID,
        model: 'gpt-4o',
        mode: 'append',
        message: 'Hi',
      })
      .expect(400);
    expect(built.conversationService.streamCompletion).not.toHaveBeenCalled();
  });

  it('answers 400 for traversal in the conversation name without calling Core', async () => {
    const built = await buildApp();
    app = built.app;

    await request(app.getHttpServer())
      .get(
        `/api/v1/projects/${OWN}/conversations/${encodeURIComponent('../context/tickets.csv')}`,
      )
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${OWN}/conversations/..`)
      .expect((res) => expect([400, 404]).toContain(res.status));
    expect(built.client.downloadProjectFile).not.toHaveBeenCalled();
    expect(built.conversationService.getConversation).not.toHaveBeenCalled();
  });

  it('lists conversations with isUnread from the caller read state', async () => {
    const built = await buildApp();
    app = built.app;
    built.client.listProjectFileMetadata.mockResolvedValue(
      ok({
        items: [{ name: 'gpt-4o__Hi__1', nodeType: 'ITEM', updatedAt: 5 }],
      }),
    );
    built.client.downloadProjectFile.mockResolvedValue(
      ok(JSON.stringify({ name: 'Hi' })),
    );

    const res = await request(app.getHttpServer())
      .get(`/api/v1/projects/${OWN}/conversations`)
      .expect(200);

    expect(res.body.items).toEqual([
      expect.objectContaining({ name: 'gpt-4o__Hi__1', isUnread: true }),
    ]);
    expect(built.readState.getProjectReadState).toHaveBeenCalledWith(
      'projects/a1b2c3/q4',
      USER.at,
      USER.bucket,
    );
  });

  it("marks a shared project's conversation viewed in the caller's state with 204", async () => {
    const built = await buildApp();
    app = built.app;
    built.client.downloadProjectFile.mockResolvedValue(
      ok(JSON.stringify({ name: 'Hi' })),
    );

    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${SHARED}/conversations/gpt-4o__Hi__1/viewed`)
      .expect(204);

    expect(built.readState.markProjectConversationViewed).toHaveBeenCalledWith(
      'projects/z9y8x7/research',
      'projects/z9y8x7/research/conversations/gpt-4o__Hi__1',
      expect.stringMatching(/^"sha256:[\da-f]+"$/),
      USER.at,
      USER.bucket,
    );
  });

  it('answers 404 on the viewed route for a missing conversation', async () => {
    const built = await buildApp();
    app = built.app;
    built.client.downloadProjectFile.mockResolvedValue({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 404 }),
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${OWN}/conversations/gpt-4o__Gone__1/viewed`)
      .expect(404);
    expect(
      built.readState.markProjectConversationViewed,
    ).not.toHaveBeenCalled();
  });

  it('answers 400 for traversal on the viewed route without calling Core', async () => {
    const built = await buildApp();
    app = built.app;

    await request(app.getHttpServer())
      .patch(
        `/api/v1/projects/${OWN}/conversations/${encodeURIComponent('../secret')}/viewed`,
      )
      .expect(400);
    expect(built.client.downloadProjectFile).not.toHaveBeenCalled();
  });

  it('answers 403 on the viewed route when the projects flag is off', async () => {
    const built = await buildApp(false);
    app = built.app;

    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${OWN}/conversations/gpt-4o__Hi__1/viewed`)
      .expect(403);
    expect(
      built.readState.markProjectConversationViewed,
    ).not.toHaveBeenCalled();
  });

  it('creates a conversation with If-Match: * and answers 201 with its locator', async () => {
    const built = await buildApp();
    app = built.app;

    const res = await request(app.getHttpServer())
      .post(`/api/v1/projects/${OWN}/conversations`)
      .send({
        firstMessage: 'Draft a help center article',
        deploymentId: 'gpt-4o',
      })
      .expect(201);

    expect(res.body.id).toMatch(
      /^projects\/a1b2c3\/q4\/conversations\/gpt-4o__Draft a help center article__[\da-f-]{36}$/,
    );
    expect(res.body.folderId).toBe('projects/a1b2c3/q4');
    const [bucket, path, filePath, init] = built.client.uploadProjectFile.mock
      .calls[0] as unknown as [
      string,
      string,
      string,
      { headers: Record<string, string> },
    ];
    expect([bucket, path]).toEqual(['a1b2c3', 'q4']);
    expect(filePath).toMatch(/^conversations\/gpt-4o__/);
    expect(init.headers['If-Match']).toBe('*');
  });

  it('stops the generation registered under the same project locator', async () => {
    const built = await buildApp();
    app = built.app;
    const lease = built.generations.register(
      OWNER_KEY,
      'projects/a1b2c3/q4/conversations/x',
      GENERATION_ID,
    );

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${OWN}/conversations/completions/stop`)
      .send({
        path: 'a1b2c3/q4/conversations/x',
        generationId: GENERATION_ID,
      })
      .expect(204);

    expect(lease.abortController.signal.aborted).toBe(true);
  });

  it('streams a completion with the locator as the conversation path', async () => {
    const built = await buildApp();
    app = built.app;
    built.conversationService.streamCompletion.mockImplementation(
      async function* (..._args: unknown[]) {
        const onReady = _args[10] as () => void;
        onReady();
        yield 'data: {}\n\n';
      },
    );

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${OWN}/conversations/completions`)
      .send({
        path: 'a1b2c3/q4/conversations/x',
        generationId: GENERATION_ID,
        model: 'gpt-4o',
        mode: 'append',
        message: 'Hi',
      })
      .expect(200);

    expect(built.conversationService.streamCompletion).toHaveBeenCalledWith(
      'projects/a1b2c3/q4/conversations/x',
      USER.at,
      USER.bucket,
      GENERATION_ID,
      'append',
      'Hi',
      undefined,
      'gpt-4o',
      undefined,
      OWNER_KEY,
      expect.any(Function),
      USER.sub,
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });
});
