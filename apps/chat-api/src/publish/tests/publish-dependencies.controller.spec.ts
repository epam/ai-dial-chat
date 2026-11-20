import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishDependenciesService } from '../dependencies/publish-dependencies.service';
import { MAX_APPLICATION_VALUES_LENGTH } from '../dto/application-values-dependencies.dto';
import { ResourceDependencyType } from '../dto/resource-dependency.dto';
import { PublishDependenciesController } from '../publish-dependencies.controller';

const TEST_USER = { sub: 'user-123', at: 'test-access-token', bucket: 'b-1' };

const RESULT = {
  dependencies: [
    {
      id: 'prompts/b-1/Greeting',
      name: 'Greeting',
      type: ResourceDependencyType.Prompt,
      location: '',
    },
  ],
};

describe('PublishDependenciesController (integration)', () => {
  let app: INestApplication;
  let service: {
    getDependencies: ReturnType<typeof vi.fn>;
    getApplicationValueDependencies: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      getDependencies: vi.fn().mockResolvedValue(RESULT),
      getApplicationValueDependencies: vi.fn().mockResolvedValue(RESULT),
    };
    const module = await Test.createTestingModule({
      controllers: [PublishDependenciesController],
      providers: [{ provide: PublishDependenciesService, useValue: service }],
    }).compile();
    app = module.createNestApplication();
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
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it('returns 200 with the dependencies and passes the caller and entity to the service', async () => {
    const res = await request(app.getHttpServer())
      .get(
        '/api/v1/catalog/application/applications%2Fb-1%2FApp__1.0.0/publish-dependencies',
      )
      .expect(200);

    expect(res.body).toEqual(RESULT);
    expect(service.getDependencies).toHaveBeenCalledWith(
      TEST_USER.at,
      TEST_USER.sub,
      'application',
      'applications/b-1/App__1.0.0',
    );
  });

  it('returns 200 with an empty list when nothing is private', async () => {
    service.getDependencies.mockResolvedValue({ dependencies: [] });

    const res = await request(app.getHttpServer())
      .get('/api/v1/catalog/prompt/prompts%2Fb-1%2FHi/publish-dependencies')
      .expect(200);

    expect(res.body).toEqual({ dependencies: [] });
  });

  it('rejects an entity id containing a parent-directory segment with 400', async () => {
    await request(app.getHttpServer())
      .get(
        '/api/v1/catalog/application/applications%2Fb-1%2F..%2Fother/publish-dependencies',
      )
      .expect(400);

    expect(service.getDependencies).not.toHaveBeenCalled();
  });

  it('rejects an unknown entity type with 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/catalog/conversation/x/publish-dependencies')
      .expect(400);
  });

  describe('POST application-values/publish-dependencies', () => {
    const URL = '/api/v1/catalog/application-values/publish-dependencies';
    const BODY = {
      schemaId: 'https://schema/form',
      properties: { skills: [{ url: 'prompts/b-1/Hi' }] },
    };

    it('returns 200 with the dependencies and passes the caller and values to the service', async () => {
      const res = await request(app.getHttpServer())
        .post(URL)
        .send(BODY)
        .expect(200);

      expect(res.body).toEqual(RESULT);
      expect(service.getApplicationValueDependencies).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.sub,
        TEST_USER.bucket,
        BODY.schemaId,
        BODY.properties,
      );
      expect(service.getDependencies).not.toHaveBeenCalled();
    });

    it.each([
      ['a missing schemaId', { properties: { a: 1 } }],
      ['missing properties', { schemaId: 'https://schema/form' }],
      ['empty properties', { schemaId: 'https://schema/form', properties: {} }],
      [
        'array properties',
        { schemaId: 'https://schema/form', properties: [1] },
      ],
      [
        'oversized properties',
        {
          schemaId: 'https://schema/form',
          properties: { blob: 'x'.repeat(MAX_APPLICATION_VALUES_LENGTH) },
        },
      ],
      ['an unknown field', { ...BODY, extra: true }],
      [
        'a schemaId with a line break',
        { ...BODY, schemaId: 'https://schema/form\nforged log line' },
      ],
      ['a schemaId with a space', { ...BODY, schemaId: 'https://schema/a b' }],
    ])('rejects %s with 400', async (_name, body) => {
      await request(app.getHttpServer()).post(URL).send(body).expect(400);

      expect(service.getApplicationValueDependencies).not.toHaveBeenCalled();
    });
  });
});
