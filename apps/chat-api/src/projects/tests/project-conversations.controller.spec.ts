import {
  ForbiddenException,
  INestApplication,
  NotFoundException,
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
import type { DialClientService } from '../../dial/dial-client.service';
import { ProjectAccessService } from '../access/project-access.service';
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
    resolveConversations: vi.fn(),
    createConversation: vi.fn(),
    getConversation: vi.fn(),
    saveConversation: vi.fn(),
    renameConversation: vi.fn(),
    deleteConversation: vi.fn(),
    resolveCompletionLocator: vi.fn(),
    markViewed: vi.fn(),
  };
  const access = {
    assertCanWrite: vi.fn(async () => undefined),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [ProjectConversationsController],
      providers: [
        { provide: ProjectConversationsService, useValue: service },
        { provide: ConversationCompletionsResponder, useValue: {} },
        { provide: ProjectAccessService, useValue: access },
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

  it('lists every conversation with a no-store cache header', async () => {
    service.listConversations.mockResolvedValue({ items: [] });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/projects/${ENCODED}/conversations`)
      .expect(200);

    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(service.listConversations).toHaveBeenCalledWith(
      expect.objectContaining({ id: PROJECT_ID }),
      USER.at,
      USER.bucket,
    );
  });

  it('resolves titles of the named conversations', async () => {
    const names = ['gpt-4o__Hi__1', 'gpt-4o__Bye__2'];
    service.resolveConversations.mockResolvedValue({ items: [] });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/projects/${ENCODED}/conversations/titles`)
      .send({ names })
      .expect(200);

    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(service.resolveConversations).toHaveBeenCalledWith(
      expect.objectContaining({ id: PROJECT_ID }),
      names,
      USER.at,
      USER.bucket,
    );
  });

  it.each([
    ['no names', { names: [] }],
    ['a traversal name', { names: ['..'] }],
    ['an unknown field', { names: ['gpt-4o__Hi__1'], limit: 1 }],
  ])('rejects a titles body with %s', async (_label, body) => {
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${ENCODED}/conversations/titles`)
      .send(body)
      .expect(400);
    expect(service.resolveConversations).not.toHaveBeenCalled();
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

  it('marks a conversation viewed with 204 for the session user', async () => {
    const name = 'gpt-4o__Hi there__1';
    service.markViewed.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .patch(
        `/api/v1/projects/${ENCODED}/conversations/${encodeURIComponent(name)}/viewed`,
      )
      .expect(204);

    expect(service.markViewed).toHaveBeenCalledWith(
      expect.objectContaining({ id: PROJECT_ID }),
      name,
      USER.at,
      USER.bucket,
    );
  });

  it.each([
    ['a traversal in the conversation name', encodeURIComponent('../secret')],
    ['an encoded slash in the conversation name', encodeURIComponent('a/b')],
  ])('rejects %s on the viewed route', async (_case, name) => {
    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${ENCODED}/conversations/${name}/viewed`)
      .expect(400);
    expect(service.markViewed).not.toHaveBeenCalled();
  });

  it('rejects an invalid project id on the viewed route', async () => {
    await request(app.getHttpServer())
      .patch(
        `/api/v1/projects/${encodeURIComponent('projects/a1b2c3/../x')}/conversations/c/viewed`,
      )
      .expect((res) => expect([400, 404]).toContain(res.status));
    expect(service.markViewed).not.toHaveBeenCalled();
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
  const makeService = (sharedPermissions: string[] = ['READ']) => {
    const getSharedResources = vi.fn(async () => ({
      data: {
        resources: [
          {
            nodeType: 'ITEM',
            url: 'projects/z9y8x7/research',
            permissions: sharedPermissions,
          },
        ],
      },
      error: undefined,
      response: { status: 200 },
    }));
    const dialClient = {
      client: { getSharedResources },
    } as unknown as DialClientService;
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
      readConversationWithEtag: vi.fn(
        async (): Promise<{
          conversation: { updatedAt?: number };
          etag: string | null;
        } | null> => ({ conversation: { updatedAt: 500 }, etag: 'sha256:1' }),
      ),
    };
    const readState = {
      getProjectReadState: vi.fn(
        async (): Promise<{
          readBefore: number;
          versions: Map<string, string>;
        } | null> => ({ readBefore: 100, versions: new Map() }),
      ),
      markProjectConversationViewed: vi.fn(async () => undefined),
      removeProjectConversation: vi.fn(async () => undefined),
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
        readState as never,
        new ProjectAccessService(dialClient),
      ),
      getSharedResources,
      conversationService,
      store,
      listService,
      readState,
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

  it("stores the conversation's current version as viewed by the caller", async () => {
    const { service, readState } = makeService();

    await service.markViewed(PROJECT, 'gpt-4o__Hi__1', 'token', 'reader');

    expect(readState.markProjectConversationViewed).toHaveBeenCalledWith(
      PROJECT_ID,
      LOCATOR,
      'sha256:1',
      'token',
      'reader',
    );
  });

  it('answers 404 and writes nothing when the conversation is missing', async () => {
    const { service, store, readState } = makeService();
    store.readConversationWithEtag.mockResolvedValue(null);

    await expect(
      service.markViewed(PROJECT, 'gpt-4o__Hi__1', 'token', 'reader'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(readState.markProjectConversationViewed).not.toHaveBeenCalled();
  });

  it('drops a deleted conversation from the read state, without failing on a read-state error', async () => {
    const { service, readState } = makeService();
    readState.removeProjectConversation.mockRejectedValue(new Error('down'));

    await expect(
      service.deleteConversation(PROJECT, 'gpt-4o__Hi__1', 'token', 'a1b2c3'),
    ).resolves.toBeUndefined();
    expect(readState.removeProjectConversation).toHaveBeenCalledWith(
      PROJECT_ID,
      LOCATOR,
      'token',
      'a1b2c3',
    );
  });

  it('keeps a read chat read after the owner renames it', async () => {
    const { service, store, readState } = makeService();
    readState.getProjectReadState.mockResolvedValue({
      readBefore: 100,
      versions: new Map([[LOCATOR, 'sha256:1']]),
    });
    store.readConversationWithEtag
      .mockResolvedValueOnce({
        conversation: { updatedAt: 500 },
        etag: 'sha256:1',
      })
      .mockResolvedValueOnce({
        conversation: { updatedAt: 600 },
        etag: 'sha256:2',
      });

    await service.renameConversation(
      PROJECT,
      'gpt-4o__Hi__1',
      'New',
      'token',
      'a1b2c3',
    );

    expect(readState.markProjectConversationViewed).toHaveBeenCalledWith(
      PROJECT_ID,
      LOCATOR,
      'sha256:2',
      'token',
      'a1b2c3',
    );
  });

  it('leaves an unread chat unread after a rename', async () => {
    const { service, readState } = makeService();

    await service.renameConversation(
      PROJECT,
      'gpt-4o__Hi__1',
      'New',
      'token',
      'a1b2c3',
    );

    expect(readState.markProjectConversationViewed).not.toHaveBeenCalled();
  });

  it('refuses every write by a view-only recipient', async () => {
    const { service, store } = makeService(['READ']);
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

  it('lets a recipient with WRITE create a chat and delete one the owner started', async () => {
    const { service, store, getSharedResources } = makeService([
      'READ',
      'WRITE',
    ]);
    const shared = parseProjectId('projects/z9y8x7/research');
    if (shared == null) throw new Error('Invalid project id');

    const created = await service.createConversation(
      shared,
      { firstMessage: 'Hi', deploymentId: 'gpt-4o' },
      't',
      'a1b2c3',
    );
    await service.deleteConversation(shared, 'gpt-4o__Owner__1', 't', 'a1b2c3');

    expect(created.id).toMatch(/^projects\/z9y8x7\/research\/conversations\//);
    expect(store.deleteConversation).toHaveBeenCalledWith(
      'projects/z9y8x7/research/conversations/gpt-4o__Owner__1',
      't',
    );
    expect(getSharedResources).toHaveBeenCalledTimes(2);
  });

  it('refuses a write to an organization project without asking DIAL Core', async () => {
    const { service, store, getSharedResources } = makeService();
    const organization = parseProjectId('projects/public/handbook');
    if (organization == null) throw new Error('Invalid project id');

    await expect(
      service.createConversation(
        organization,
        { firstMessage: 'Hi', deploymentId: 'gpt-4o' },
        't',
        'a1b2c3',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(getSharedResources).not.toHaveBeenCalled();
    expect(store.saveConversation).not.toHaveBeenCalled();
  });

  it('writes an owned project without asking DIAL Core for permissions', async () => {
    const { service, getSharedResources } = makeService();

    await service.deleteConversation(PROJECT, 'x', 't', 'a1b2c3');

    expect(getSharedResources).not.toHaveBeenCalled();
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
