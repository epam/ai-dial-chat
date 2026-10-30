import {
  ForbiddenException,
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureKey } from '../../app-config/feature-flags/feature-key.enum';
import { FeatureGuard } from '../../app-config/feature-flags/feature.guard';
import { FEATURE_KEY_METADATA } from '../../app-config/feature-flags/require-feature.decorator';
import type { SessionUser } from '../../auth/session/session.types';
import type { ConversationService } from '../../conversations/conversation.service';
import type { ProjectConversationStore } from '../../conversations/persistence/project-conversation.store';
import { ConversationCompletionsResponder } from '../../conversations/streaming/conversation-completions.responder';
import type { ProjectConversationsListService } from '../conversations/project-conversations-list.service';
import { ProjectConversationsController } from '../conversations/project-conversations.controller';
import { ProjectConversationsService } from '../conversations/project-conversations.service';
import { parseProjectId } from '../utils/project-id.util';

const USER = { sub: 'u', at: 'token', bucket: 'a1b2c3' } as SessionUser;
const PROJECT_ID = 'projects/a1b2c3/q4';
const ENCODED = encodeURIComponent(PROJECT_ID);
const LOCATOR = `${PROJECT_ID}/conversations/gpt-4o__Hi__1`;
const PROJECT = parseProjectId(PROJECT_ID)!;

describe('ProjectConversationsController', () => {
  let app: INestApplication;
  const service = {
    listConversations: vi.fn(),
    createConversation: vi.fn(),
    getConversation: vi.fn(),
    saveConversation: vi.fn(),
    renameConversation: vi.fn(),
    deleteConversation: vi.fn(),
    assertOwner: vi.fn(),
    resolveCompletionLocator: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [ProjectConversationsController],
      providers: [
        { provide: ProjectConversationsService, useValue: service },
        { provide: ConversationCompletionsResponder, useValue: {} },
      ],
    })
      .overrideGuard(FeatureGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.use(
      (
        req: Express.Request & { user?: unknown },
        _res: unknown,
        next: () => void,
      ) => {
        req.user = USER;
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
  });

  afterEach(async () => {
    await app.close();
  });

  it('gates the controller behind FeatureGuard and projectsEnabled', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ProjectConversationsController),
    ).toEqual([FeatureGuard]);
    expect(
      Reflect.getMetadata(FEATURE_KEY_METADATA, ProjectConversationsController),
    ).toBe(FeatureKey.ProjectsEnabled);
  });

  it('lists with the limit and a no-store cache header', async () => {
    service.listConversations.mockResolvedValue({ items: [], hasMore: false });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/projects/${ENCODED}/conversations?limit=10&offset=20`)
      .expect(200);

    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(service.listConversations).toHaveBeenCalledWith(
      expect.objectContaining({ id: PROJECT_ID }),
      USER.at,
      10,
      20,
    );
  });

  it.each(['limit=101', 'offset=-1'])('rejects %s', async (query) => {
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${ENCODED}/conversations?${query}`)
      .expect(400);
    expect(service.listConversations).not.toHaveBeenCalled();
  });

  it('delegates get, save, rename and delete with the decoded conversation name', async () => {
    const name = 'gpt-4o__Hi there__1';
    const path = `/api/v1/projects/${ENCODED}/conversations/${encodeURIComponent(name)}`;
    service.getConversation.mockResolvedValue({ id: LOCATOR });
    service.saveConversation.mockResolvedValue({ id: LOCATOR });
    service.renameConversation.mockResolvedValue({ name: 'New' });

    await request(app.getHttpServer()).get(path).expect(200);
    await request(app.getHttpServer())
      .put(path)
      .send({ conversation: { id: LOCATOR } })
      .expect(200);
    await request(app.getHttpServer())
      .patch(path)
      .send({ newTitle: 'New' })
      .expect(200);
    await request(app.getHttpServer()).delete(path).expect(204);

    const project = expect.objectContaining({ id: PROJECT_ID });
    expect(service.getConversation).toHaveBeenCalledWith(
      project,
      name,
      USER.at,
      USER.bucket,
    );
    expect(service.saveConversation).toHaveBeenCalledWith(
      project,
      name,
      { id: LOCATOR },
      USER.at,
      USER.bucket,
    );
    expect(service.renameConversation).toHaveBeenCalledWith(
      project,
      name,
      'New',
      USER.at,
      USER.bucket,
    );
    expect(service.deleteConversation).toHaveBeenCalledWith(
      project,
      name,
      USER.at,
      USER.bucket,
    );
  });

  it('creates with the create body', async () => {
    service.createConversation.mockResolvedValue({ id: LOCATOR });

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${ENCODED}/conversations`)
      .send({ firstMessage: 'Hi', deploymentId: 'gpt-4o' })
      .expect(201);

    expect(service.createConversation).toHaveBeenCalledWith(
      expect.objectContaining({ id: PROJECT_ID }),
      expect.objectContaining({ firstMessage: 'Hi', deploymentId: 'gpt-4o' }),
      USER.at,
      USER.bucket,
    );
  });
});

describe('ProjectConversationsService', () => {
  const makeService = () => {
    const conversationService = {
      getConversation: vi.fn(),
      saveClientConversation: vi.fn(async () => ({ id: LOCATOR })),
      renameConversation: vi.fn(async () => ({ name: 'New' })),
    };
    const store = {
      saveConversation: vi.fn(
        async (_l: string, _t: string, body: unknown) => body,
      ),
      deleteConversation: vi.fn(async () => undefined),
    };
    const listService = {
      listProjectConversations: vi.fn(),
      evict: vi.fn(async () => undefined),
    };
    return {
      service: new ProjectConversationsService(
        conversationService as unknown as ConversationService,
        store as unknown as ProjectConversationStore,
        listService as unknown as ProjectConversationsListService,
      ),
      conversationService,
      store,
      listService,
    };
  };

  it('builds a project conversation body in the project folder', async () => {
    const { service, store } = makeService();

    const created = await service.createConversation(
      PROJECT,
      { firstMessage: 'Draft an article', deploymentId: 'gpt-4o' },
      'token',
      'a1b2c3',
    );

    expect(created.folderId).toBe(PROJECT_ID);
    expect(created.id).toMatch(
      /^projects\/a1b2c3\/q4\/conversations\/gpt-4o__Draft an article__/,
    );
    expect(store.saveConversation).toHaveBeenCalledWith(
      created.id,
      'token',
      created,
    );
  });

  it('evicts the cached title on save, rename and delete', async () => {
    const { service, listService, conversationService } = makeService();

    await service.saveConversation(
      PROJECT,
      'gpt-4o__Hi__1',
      {} as never,
      't',
      'a1b2c3',
    );
    await service.renameConversation(
      PROJECT,
      'gpt-4o__Hi__1',
      'New',
      't',
      'a1b2c3',
    );
    await service.deleteConversation(PROJECT, 'gpt-4o__Hi__1', 't', 'a1b2c3');

    expect(listService.evict).toHaveBeenCalledTimes(3);
    expect(listService.evict).toHaveBeenCalledWith(LOCATOR);
    expect(conversationService.renameConversation).toHaveBeenCalledWith(
      LOCATOR,
      'New',
      't',
      'a1b2c3',
    );
  });

  it('refuses every write outside the caller bucket', async () => {
    const { service, store } = makeService();
    const shared = parseProjectId('projects/z9y8x7/research')!;

    await expect(
      service.createConversation(
        shared,
        { firstMessage: 'Hi', deploymentId: 'gpt-4o' },
        't',
        'a1b2c3',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.deleteConversation(shared, 'x', 't', 'a1b2c3'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(store.saveConversation).not.toHaveBeenCalled();
    expect(store.deleteConversation).not.toHaveBeenCalled();
  });

  it('resolves a completion path only inside the addressed project', () => {
    const { service } = makeService();

    expect(
      service.resolveCompletionLocator(PROJECT, 'a1b2c3/q4/conversations/x'),
    ).toBe('projects/a1b2c3/q4/conversations/x');
    expect(() =>
      service.resolveCompletionLocator(PROJECT, 'a1b2c3/other/conversations/x'),
    ).toThrow();
    expect(() =>
      service.resolveCompletionLocator(PROJECT, 'a1b2c3/q4/conversations/a/b'),
    ).toThrow();
  });
});
