import {
  INestApplication,
  PreconditionFailedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeploymentsService } from '../../deployments/deployments.service';
import type { DeploymentsDetailsService } from '../../deployments/details/deployments-details.service';
import type { DialClientService } from '../../dial/dial-client.service';
import { ApplicationsController } from '../applications.controller';
import { ApplicationsService } from '../applications.service';

const ID = 'applications/test-bucket/loop__1.0.0';

const withEtag = (data: unknown, etag?: string) =>
  ({
    data,
    response: {
      status: 200,
      headers: new Headers(etag ? { ETag: etag } : {}),
    } as Response,
  }) as never;

const makeService = () => {
  const dialClient = {
    client: {
      getCustomApplication: vi.fn(),
      saveCustomApplication: vi.fn(),
    },
  } as unknown as DialClientService;
  const service = new ApplicationsService(
    dialClient,
    {
      del: vi.fn().mockResolvedValue(undefined),
      get: vi.fn(),
      set: vi.fn(),
    } as never,
    {
      invalidateListCache: vi.fn().mockResolvedValue(undefined),
    } as unknown as DeploymentsService,
    {
      invalidateDetailsCache: vi.fn().mockResolvedValue(undefined),
    } as unknown as DeploymentsDetailsService,
  );
  vi.mocked(dialClient.client.getCustomApplication).mockResolvedValue(
    withEtag({ display_name: 'Loop', application_properties: {} }, '"v1"'),
  );
  return { service, dialClient };
};

describe('ApplicationsService.updateApplication — If-Match', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('forwards If-Match to Core and returns the new version', async () => {
    const { service, dialClient } = makeService();
    vi.mocked(dialClient.client.saveCustomApplication).mockResolvedValue(
      withEtag({}, '"v2"'),
    );

    const result = await service.updateApplication(
      'u1',
      'token',
      ID,
      { name: 'Loop' },
      '"v1"',
    );

    const init = vi.mocked(dialClient.client.saveCustomApplication).mock
      .calls[0][2] as { headers: Record<string, string> };
    expect(init.headers['If-Match']).toBe('"v1"');
    expect(result.etag).toBe('"v2"');
  });

  it('saves unconditionally without If-Match, as before', async () => {
    const { service, dialClient } = makeService();
    vi.mocked(dialClient.client.saveCustomApplication).mockResolvedValue(
      withEtag({}),
    );

    const result = await service.updateApplication('u1', 'token', ID, {
      name: 'Loop',
    });

    const init = vi.mocked(dialClient.client.saveCustomApplication).mock
      .calls[0][2] as { headers: Record<string, string> };
    expect(init.headers).not.toHaveProperty('If-Match');
    expect(result.etag).toBeUndefined();
  });

  it('answers 412 when the stored version has moved on', async () => {
    const { service, dialClient } = makeService();
    vi.mocked(dialClient.client.saveCustomApplication).mockResolvedValue({
      error: {},
      response: { status: 412, headers: new Headers() } as Response,
    } as never);

    await expect(
      service.updateApplication('u1', 'token', ID, { name: 'Loop' }, '"v1"'),
    ).rejects.toBeInstanceOf(PreconditionFailedException);
  });
});

describe('ApplicationsController PATCH — If-Match (integration)', () => {
  let app: INestApplication;
  const updateApplication = vi.fn();

  beforeEach(async () => {
    updateApplication.mockReset().mockResolvedValue({ id: ID, etag: '"v2"' });
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationsController],
      providers: [
        { provide: ApplicationsService, useValue: { updateApplication } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(
      (
        req: Express.Request & { user?: unknown },
        _res: unknown,
        next: () => void,
      ) => {
        req.user = { sub: 'u1', at: 'token' };
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
    await app?.close();
  });

  it('passes the If-Match header through and answers with the new etag', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/applications/${encodeURIComponent(ID)}`)
      .set('If-Match', '"v1"')
      .send({ name: 'Loop' })
      .expect(200);

    expect(res.body.etag).toBe('"v2"');
    expect(updateApplication).toHaveBeenCalledWith(
      'u1',
      'token',
      ID,
      { name: 'Loop' },
      '"v1"',
    );
  });

  it('passes no version when the caller sends none', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/applications/${encodeURIComponent(ID)}`)
      .send({ name: 'Loop' })
      .expect(200);
    expect(updateApplication.mock.calls[0][4]).toBeUndefined();
  });

  it('reports a stale version as 412', async () => {
    updateApplication.mockRejectedValue(
      new PreconditionFailedException('changed'),
    );
    await request(app.getHttpServer())
      .patch(`/api/v1/applications/${encodeURIComponent(ID)}`)
      .set('If-Match', '"v1"')
      .send({ name: 'Loop' })
      .expect(412);
  });
});
