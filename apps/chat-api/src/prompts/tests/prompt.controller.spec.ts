import {
  BadGatewayException,
  ConflictException,
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
import { PromptController } from '../prompt.controller';
import { PromptService } from '../prompt.service';

const TEST_USER = {
  sid: 'sess-1',
  sub: 'user-123',
  providerId: 'oidc',
  claims: {},
  at: 'test-access-token',
  bucket: 'test-bucket',
  csrf: 'csrf-token',
};

const promptDto = {
  id: 'my-prompt',
  name: 'My Prompt',
  description: 'A description',
  content: 'Hello {{name}}',
  folderId: '',
  createdAt: 1000,
  updatedAt: 2000,
};

const folderDto = { id: 'AI', name: 'AI' };

const listDto = {
  prompts: [promptDto],
  folders: [folderDto],
  sharedWithMe: [],
};

async function buildApp(
  service: unknown,
  injectUser = true,
): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [PromptController],
    providers: [{ provide: PromptService, useValue: service }],
  }).compile();

  const app = module.createNestApplication();
  if (injectUser) {
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
  }
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

describe('PromptController (integration)', () => {
  let app: INestApplication;
  let service: {
    listPrompts: ReturnType<typeof vi.fn>;
    getPrompt: ReturnType<typeof vi.fn>;
    createPrompt: ReturnType<typeof vi.fn>;
    updatePrompt: ReturnType<typeof vi.fn>;
    deletePrompt: ReturnType<typeof vi.fn>;
    listPublicPrompts: ReturnType<typeof vi.fn>;
    getPublicPrompt: ReturnType<typeof vi.fn>;
    createFolder: ReturnType<typeof vi.fn>;
    renameFolder: ReturnType<typeof vi.fn>;
    deleteFolder: ReturnType<typeof vi.fn>;
    movePrompt: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      listPrompts: vi.fn().mockResolvedValue(listDto),
      getPrompt: vi.fn().mockResolvedValue(promptDto),
      createPrompt: vi.fn().mockResolvedValue(promptDto),
      updatePrompt: vi.fn().mockResolvedValue(promptDto),
      deletePrompt: vi.fn().mockResolvedValue(undefined),
      listPublicPrompts: vi.fn().mockResolvedValue(listDto),
      getPublicPrompt: vi.fn().mockResolvedValue(promptDto),
      createFolder: vi.fn().mockResolvedValue(folderDto),
      renameFolder: vi.fn().mockResolvedValue(folderDto),
      deleteFolder: vi.fn().mockResolvedValue(undefined),
      movePrompt: vi.fn().mockResolvedValue(promptDto),
    };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  /* ------------------------------------------------------------------ */
  /* GET /api/v1/prompts                                                  */
  /* ------------------------------------------------------------------ */

  describe('GET /api/v1/prompts', () => {
    it('returns all personal prompts when no path query is given', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/prompts')
        .expect(200);

      expect(res.body).toEqual(listDto);
      expect(service.listPrompts).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
      );
      expect(service.getPrompt).not.toHaveBeenCalled();
    });

    it('returns a single prompt when path query is given', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/prompts/item?path=my-prompt')
        .expect(200);

      expect(res.body).toEqual(promptDto);
      expect(service.getPrompt).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        'my-prompt',
      );
      expect(service.listPrompts).not.toHaveBeenCalled();
    });

    it('reads from the bucket query when one is given, not the caller bucket', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/prompts/item?path=Shared/greeting&bucket=owner-bucket')
        .expect(200);

      expect(service.getPrompt).toHaveBeenCalledWith(
        TEST_USER.at,
        'owner-bucket',
        'Shared/greeting',
      );
    });

    it('returns 400 for an unsafe bucket query', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/prompts/item?path=my-prompt&bucket=../other')
        .expect(400);

      expect(service.getPrompt).not.toHaveBeenCalled();
    });

    it('returns 404 when getPrompt throws NotFoundException', async () => {
      service.getPrompt.mockRejectedValue(new NotFoundException());
      await request(app.getHttpServer())
        .get('/api/v1/prompts/item?path=missing')
        .expect(404);
    });

    it('returns 401 when the service throws UnauthorizedException', async () => {
      service.listPrompts.mockRejectedValue(new UnauthorizedException());
      await request(app.getHttpServer()).get('/api/v1/prompts').expect(401);
    });

    it('returns 502 when the service throws BadGatewayException', async () => {
      service.listPrompts.mockRejectedValue(new BadGatewayException());
      await request(app.getHttpServer()).get('/api/v1/prompts').expect(502);
    });

    it('returns 503 when the service throws ServiceUnavailableException', async () => {
      service.listPrompts.mockRejectedValue(new ServiceUnavailableException());
      await request(app.getHttpServer()).get('/api/v1/prompts').expect(503);
    });
  });

  /* ------------------------------------------------------------------ */
  /* POST /api/v1/prompts                                                 */
  /* ------------------------------------------------------------------ */

  describe('POST /api/v1/prompts', () => {
    const validBody = { name: 'My Prompt', content: 'Hello {{name}}' };

    it('creates a prompt and returns 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/prompts')
        .send(validBody)
        .expect(201);

      expect(res.body).toEqual(promptDto);
      expect(service.createPrompt).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        validBody,
      );
    });

    it('returns 400 when name is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/prompts')
        .send({ content: 'Hello' })
        .expect(400);

      expect(service.createPrompt).not.toHaveBeenCalled();
    });

    it('returns 400 when name contains a forward slash', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/prompts')
        .send({ name: 'some/path', content: 'Hi' })
        .expect(400);

      expect(service.createPrompt).not.toHaveBeenCalled();
    });

    it('returns 400 when content is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/prompts')
        .send({ name: 'My Prompt' })
        .expect(400);

      expect(service.createPrompt).not.toHaveBeenCalled();
    });

    it('returns 409 when the service throws ConflictException', async () => {
      service.createPrompt.mockRejectedValue(new ConflictException());
      await request(app.getHttpServer())
        .post('/api/v1/prompts')
        .send(validBody)
        .expect(409);
    });

    it('returns 502 when the service throws BadGatewayException', async () => {
      service.createPrompt.mockRejectedValue(new BadGatewayException());
      await request(app.getHttpServer())
        .post('/api/v1/prompts')
        .send(validBody)
        .expect(502);
    });
  });

  /* ------------------------------------------------------------------ */
  /* PUT /api/v1/prompts                                                  */
  /* ------------------------------------------------------------------ */

  describe('PUT /api/v1/prompts', () => {
    it('updates a prompt and returns 200', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/prompts?path=my-prompt')
        .send({ content: 'Updated content' })
        .expect(200);

      expect(res.body).toEqual(promptDto);
      expect(service.updatePrompt).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        'my-prompt',
        { content: 'Updated content' },
      );
    });

    it('returns 404 when the service throws NotFoundException', async () => {
      service.updatePrompt.mockRejectedValue(new NotFoundException());
      await request(app.getHttpServer())
        .put('/api/v1/prompts?path=missing')
        .send({ content: 'Hi' })
        .expect(404);
    });

    it('returns 409 when the rename target already exists', async () => {
      service.updatePrompt.mockRejectedValue(new ConflictException());
      await request(app.getHttpServer())
        .put('/api/v1/prompts?path=my-prompt')
        .send({ name: 'other' })
        .expect(409);
    });

    it('returns 502 when the service throws BadGatewayException', async () => {
      service.updatePrompt.mockRejectedValue(new BadGatewayException());
      await request(app.getHttpServer())
        .put('/api/v1/prompts?path=my-prompt')
        .send({ content: 'Hi' })
        .expect(502);
    });
  });

  /* ------------------------------------------------------------------ */
  /* DELETE /api/v1/prompts                                               */
  /* ------------------------------------------------------------------ */

  describe('DELETE /api/v1/prompts', () => {
    it('deletes a prompt and returns 204', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/prompts?path=my-prompt')
        .expect(204);

      expect(service.deletePrompt).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        'my-prompt',
      );
    });

    it('returns 404 when the service throws NotFoundException', async () => {
      service.deletePrompt.mockRejectedValue(new NotFoundException());
      await request(app.getHttpServer())
        .delete('/api/v1/prompts?path=missing')
        .expect(404);
    });

    it('returns 502 when the service throws BadGatewayException', async () => {
      service.deletePrompt.mockRejectedValue(new BadGatewayException());
      await request(app.getHttpServer())
        .delete('/api/v1/prompts?path=my-prompt')
        .expect(502);
    });
  });

  /* ------------------------------------------------------------------ */
  /* GET /api/v1/prompts/public                                           */
  /* ------------------------------------------------------------------ */

  describe('GET /api/v1/prompts/public', () => {
    it('returns all public prompts when no path is given', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/prompts/public')
        .expect(200);

      expect(res.body).toEqual(listDto);
      expect(service.listPublicPrompts).toHaveBeenCalledWith(TEST_USER.at);
      expect(service.getPublicPrompt).not.toHaveBeenCalled();
    });

    it('returns a single public prompt when path is given', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/prompts/public/item?path=org-prompt')
        .expect(200);

      expect(res.body).toEqual(promptDto);
      expect(service.getPublicPrompt).toHaveBeenCalledWith(
        TEST_USER.at,
        'org-prompt',
      );
    });

    it('returns 404 when getPublicPrompt throws NotFoundException', async () => {
      service.getPublicPrompt.mockRejectedValue(new NotFoundException());
      await request(app.getHttpServer())
        .get('/api/v1/prompts/public/item?path=missing')
        .expect(404);
    });

    it('returns 502 when the service throws BadGatewayException', async () => {
      service.listPublicPrompts.mockRejectedValue(new BadGatewayException());
      await request(app.getHttpServer())
        .get('/api/v1/prompts/public')
        .expect(502);
    });
  });

  /* ------------------------------------------------------------------ */
  /* POST /api/v1/prompts/folders                                         */
  /* ------------------------------------------------------------------ */

  describe('POST /api/v1/prompts/folders', () => {
    const validBody = { name: 'AI' };

    it('creates a folder and returns 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/prompts/folders')
        .send(validBody)
        .expect(201);

      expect(res.body).toEqual(folderDto);
      expect(service.createFolder).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        validBody,
      );
    });

    it('returns 400 when name is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/prompts/folders')
        .send({})
        .expect(400);

      expect(service.createFolder).not.toHaveBeenCalled();
    });

    it('returns 400 when name contains a forward slash', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/prompts/folders')
        .send({ name: 'a/b' })
        .expect(400);

      expect(service.createFolder).not.toHaveBeenCalled();
    });

    it('returns 409 when the service throws ConflictException', async () => {
      service.createFolder.mockRejectedValue(new ConflictException());
      await request(app.getHttpServer())
        .post('/api/v1/prompts/folders')
        .send(validBody)
        .expect(409);
    });

    it('returns 502 when the service throws BadGatewayException', async () => {
      service.createFolder.mockRejectedValue(new BadGatewayException());
      await request(app.getHttpServer())
        .post('/api/v1/prompts/folders')
        .send(validBody)
        .expect(502);
    });
  });

  /* ------------------------------------------------------------------ */
  /* PUT /api/v1/prompts/folders                                          */
  /* ------------------------------------------------------------------ */

  describe('PUT /api/v1/prompts/folders', () => {
    const validBody = { name: 'Machine Learning' };

    it('renames a folder and returns 200', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/prompts/folders?path=AI')
        .send(validBody)
        .expect(200);

      expect(res.body).toEqual(folderDto);
      expect(service.renameFolder).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        'AI',
        validBody,
      );
    });

    it('returns 400 when name contains a forward slash', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/prompts/folders?path=AI')
        .send({ name: 'a/b' })
        .expect(400);

      expect(service.renameFolder).not.toHaveBeenCalled();
    });

    it('returns 404 when the service throws NotFoundException', async () => {
      service.renameFolder.mockRejectedValue(new NotFoundException());
      await request(app.getHttpServer())
        .put('/api/v1/prompts/folders?path=missing')
        .send(validBody)
        .expect(404);
    });

    it('returns 409 when the service throws ConflictException', async () => {
      service.renameFolder.mockRejectedValue(new ConflictException());
      await request(app.getHttpServer())
        .put('/api/v1/prompts/folders?path=AI')
        .send(validBody)
        .expect(409);
    });
  });

  /* ------------------------------------------------------------------ */
  /* DELETE /api/v1/prompts/folders                                       */
  /* ------------------------------------------------------------------ */

  describe('DELETE /api/v1/prompts/folders', () => {
    it('deletes a folder and returns 204', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/prompts/folders?path=AI')
        .expect(204);

      expect(service.deleteFolder).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        'AI',
      );
    });

    it('returns 404 when the service throws NotFoundException', async () => {
      service.deleteFolder.mockRejectedValue(new NotFoundException());
      await request(app.getHttpServer())
        .delete('/api/v1/prompts/folders?path=missing')
        .expect(404);
    });

    it('returns 502 when the service throws BadGatewayException', async () => {
      service.deleteFolder.mockRejectedValue(new BadGatewayException());
      await request(app.getHttpServer())
        .delete('/api/v1/prompts/folders?path=AI')
        .expect(502);
    });
  });

  /* ------------------------------------------------------------------ */
  /* POST /api/v1/prompts/move                                            */
  /* ------------------------------------------------------------------ */

  describe('POST /api/v1/prompts/move', () => {
    const validBody = { targetFolderId: 'work' };

    it('moves a prompt and returns 200', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/prompts/move?path=my-prompt')
        .send(validBody)
        .expect(200);

      expect(res.body).toEqual(promptDto);
      expect(service.movePrompt).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        'my-prompt',
        validBody,
      );
    });

    it('accepts an empty string targetFolderId (move to root)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/prompts/move?path=work/my-prompt')
        .send({ targetFolderId: '' })
        .expect(200);

      expect(service.movePrompt).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        'work/my-prompt',
        { targetFolderId: '' },
      );
    });

    it('returns 400 when targetFolderId is missing from the body', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/prompts/move?path=my-prompt')
        .send({})
        .expect(400);

      expect(service.movePrompt).not.toHaveBeenCalled();
    });

    it('returns 404 when the service throws NotFoundException', async () => {
      service.movePrompt.mockRejectedValue(new NotFoundException());
      await request(app.getHttpServer())
        .post('/api/v1/prompts/move?path=missing')
        .send(validBody)
        .expect(404);
    });

    it('returns 409 when the service throws ConflictException', async () => {
      service.movePrompt.mockRejectedValue(new ConflictException());
      await request(app.getHttpServer())
        .post('/api/v1/prompts/move?path=my-prompt')
        .send(validBody)
        .expect(409);
    });

    it('returns 502 when the service throws BadGatewayException', async () => {
      service.movePrompt.mockRejectedValue(new BadGatewayException());
      await request(app.getHttpServer())
        .post('/api/v1/prompts/move?path=my-prompt')
        .send(validBody)
        .expect(502);
    });
  });

  describe('prompt path validation', () => {
    it.each([
      ['GET', '/api/v1/prompts/item'],
      ['PUT', '/api/v1/prompts'],
      ['DELETE', '/api/v1/prompts'],
      ['GET', '/api/v1/prompts/public/item'],
      ['PUT', '/api/v1/prompts/folders'],
      ['DELETE', '/api/v1/prompts/folders'],
      ['POST', '/api/v1/prompts/move'],
    ])('returns 400 for %s %s without path', async (method, url) => {
      await request(app.getHttpServer())
        [method.toLowerCase() as 'get'](url)
        .send(method === 'POST' ? { targetFolderId: '' } : {})
        .expect(400);
    });

    it.each([
      '../outside',
      'Work/../../outside',
      '/absolute',
      'Work//prompt',
      'Work\\prompt',
    ])('returns 400 for unsafe prompt path %s', async (path) => {
      await request(app.getHttpServer())
        .get('/api/v1/prompts/item')
        .query({ path })
        .expect(400);

      expect(service.getPrompt).not.toHaveBeenCalled();
    });

    it('returns 400 for a traversal folderId', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/prompts')
        .send({ name: 'safe-name', content: 'content', folderId: '../outside' })
        .expect(400);

      expect(service.createPrompt).not.toHaveBeenCalled();
    });
  });
});
