import { Controller, Get, VersioningType } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { Public } from '../../common/decorators/public.decorator';
import {
  applyPublicOperationSecurity,
  createOpenApiDocument,
} from '../openapi.config';

@Public()
@Controller('open')
class OpenController {
  @Get()
  getOpen() {
    return 'open';
  }
}

@Controller({ path: 'mixed', version: '1' })
class MixedController {
  @Public()
  @Get('public')
  getMixedPublic() {
    return 'public';
  }

  @Get('private')
  getMixedPrivate() {
    return 'private';
  }
}

const buildDocument = async (): Promise<OpenAPIObject> => {
  const moduleRef = await Test.createTestingModule({
    controllers: [OpenController, MixedController],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });
  await app.init();
  const document = createOpenApiDocument(app, 5000);
  await app.close();
  return document;
};

describe('createOpenApiDocument security', () => {
  it('registers the session cookie scheme under the `session` key next to `bearer`', async () => {
    const document = await buildDocument();
    const schemes = document.components?.securitySchemes ?? {};

    expect(Object.keys(schemes).sort()).toEqual(['bearer', 'session']);
    expect(schemes['session']).toMatchObject({
      type: 'apiKey',
      in: 'cookie',
      name: '__Host-chat.sess',
    });
    expect(schemes['bearer']).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
  });

  it('requires a session cookie OR a bearer token by default', async () => {
    const document = await buildDocument();

    expect(document.security).toEqual([{ session: [] }, { bearer: [] }]);
    expect(
      document.paths['/api/v1/mixed/private']?.get?.security,
    ).toBeUndefined();
  });

  it('opts @Public() handlers and controllers out with an empty requirement', async () => {
    const document = await buildDocument();
    const classPublic = document.paths['/api/open']?.get;
    const methodPublic = document.paths['/api/v1/mixed/public']?.get;

    expect(classPublic?.security).toEqual([]);
    expect(methodPublic?.security).toEqual([]);
    expect(classPublic).not.toHaveProperty('x-public');
    expect(methodPublic).not.toHaveProperty('x-public');
  });

  it('strips a non-true marker without opting the operation out', () => {
    const document = {
      openapi: '3.0.0',
      info: { title: 't', version: '1' },
      paths: { '/x': { get: { responses: {}, 'x-public': false } } },
    } as unknown as OpenAPIObject;

    applyPublicOperationSecurity(document);

    expect(document.paths['/x']?.get).toEqual({ responses: {} });
  });
});
