import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type {
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import type { UserConfig } from '../dto/user-config.dto';
import { UserConfigController } from '../user-config.controller';
import { UserConfigService } from '../user-config.service';

const makeDialClient = () =>
  ({
    client: {
      downloadFile: vi.fn(),
      uploadFile: vi.fn(),
      deleteFile: vi.fn(),
    },
    baseUrl: 'http://localhost:3000',
    dialApiVersion: '2024-10-21',
  }) as unknown as DialClientService;

const makeSingleDownloadSpy = (
  service: UserConfigService,
  options: { ok: boolean; body?: string },
) =>
  vi.spyOn(service['dialClient'].client, 'downloadFile').mockResolvedValue({
    response: {
      ok: options.ok,
      text: async () => options.body ?? '',
    },
  } as never);

const makeUploadSpy = (service: UserConfigService) =>
  vi.spyOn(service['dialClient'].client, 'uploadFile').mockResolvedValue({
    response: { status: 200, text: async () => '' },
  } as never);

const getUploadedConfigAt = async (
  uploadSpy: ReturnType<typeof vi.spyOn>,
  callIndex: number,
) => {
  const formData = (uploadSpy.mock.calls[callIndex] as unknown[])[2] as {
    body: FormData;
  };
  const file = formData.body.get('file') as Blob;
  return JSON.parse(await file.text()) as UserConfig;
};

const v3Config = (overrides?: Partial<UserConfig>): UserConfig => ({
  version: 3,
  conversations: { pinnedIds: [] },
  toolsets: { installed: [] },
  deployments: { installed: [], selectedId: null },
  legacyMigrationDone: true,
  ...overrides,
});

const TEST_USER = {
  sid: 'test-sid',
  sub: 'test-sub',
  providerId: 'keycloak',
  at: 'test-access-token',
  bucket: 'test-bucket',
  claims: {},
  csrf: 'test-csrf',
};

describe('UserConfigController (integration)', () => {
  let app: INestApplication;
  let service: {
    readConfig: ReturnType<typeof vi.fn>;
    updatePin: ReturnType<typeof vi.fn>;
    updateInstalledToolset: ReturnType<typeof vi.fn>;
    updateInstalledDeployment: ReturnType<typeof vi.fn>;
    updateInstalledPrompt: ReturnType<typeof vi.fn>;
    updateSelectedDeployment: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      readConfig: vi.fn(),
      updatePin: vi.fn(),
      updateInstalledToolset: vi.fn(),
      updateInstalledDeployment: vi.fn(),
      updateInstalledPrompt: vi.fn(),
      updateSelectedDeployment: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserConfigController],
      providers: [{ provide: UserConfigService, useValue: service }],
    }).compile();

    app = module.createNestApplication();
    app.use(
      (req: ExpressRequest, _res: ExpressResponse, next: NextFunction) => {
        req.user = TEST_USER;
        next();
      },
    );
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

  describe('GET /user-config', () => {
    it('returns 200 with the v2 user config', async () => {
      const config = {
        version: 2,
        conversations: { pinnedIds: ['conv-1'] },
        toolsets: { installed: ['toolset-abc'] },
        deployments: { installed: [] },
      };
      service.readConfig.mockResolvedValue(config);

      const result = await request(app.getHttpServer())
        .get('/user-config')
        .expect(200);

      expect(result.body).toEqual(config);
      expect(service.readConfig).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
      );
    });
  });

  describe('PATCH /user-config/pins', () => {
    it('returns 204 for a valid pin request', async () => {
      service.updatePin.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .patch('/user-config/pins')
        .send({
          path: 'conversations/test-bucket/gpt-4o__Hello__uuid',
          isPinned: true,
        })
        .expect(204);

      expect(service.updatePin).toHaveBeenCalledWith(
        'conversations/test-bucket/gpt-4o__Hello__uuid',
        true,
        TEST_USER.at,
        TEST_USER.bucket,
      );
    });

    it('returns 204 for a valid unpin request', async () => {
      service.updatePin.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .patch('/user-config/pins')
        .send({
          path: 'conversations/test-bucket/gpt-4o__Hello__uuid',
          isPinned: false,
        })
        .expect(204);

      expect(service.updatePin).toHaveBeenCalledWith(
        'conversations/test-bucket/gpt-4o__Hello__uuid',
        false,
        TEST_USER.at,
        TEST_USER.bucket,
      );
    });

    it('returns 400 when path is missing', async () => {
      await request(app.getHttpServer())
        .patch('/user-config/pins')
        .send({ isPinned: true })
        .expect(400);
    });

    it('returns 400 when isPinned is missing', async () => {
      await request(app.getHttpServer())
        .patch('/user-config/pins')
        .send({ path: 'conversations/test-bucket/some-id' })
        .expect(400);
    });

    it('returns 400 when isPinned is not a boolean', async () => {
      await request(app.getHttpServer())
        .patch('/user-config/pins')
        .send({ path: 'conversations/test-bucket/some-id', isPinned: 'yes' })
        .expect(400);
    });

    it('returns 400 when body is empty', async () => {
      await request(app.getHttpServer())
        .patch('/user-config/pins')
        .send({})
        .expect(400);
    });
  });

  describe('PATCH /user-config/toolsets', () => {
    it('returns 204 for a valid install request', async () => {
      service.updateInstalledToolset.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .patch('/user-config/toolsets')
        .send({ id: 'toolset-abc', isInstalled: true })
        .expect(204);

      expect(service.updateInstalledToolset).toHaveBeenCalledWith(
        'toolset-abc',
        true,
        TEST_USER.at,
        TEST_USER.bucket,
      );
    });

    it('returns 204 for a valid uninstall request', async () => {
      service.updateInstalledToolset.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .patch('/user-config/toolsets')
        .send({ id: 'toolset-abc', isInstalled: false })
        .expect(204);

      expect(service.updateInstalledToolset).toHaveBeenCalledWith(
        'toolset-abc',
        false,
        TEST_USER.at,
        TEST_USER.bucket,
      );
    });

    it('returns 400 when id is missing', async () => {
      await request(app.getHttpServer())
        .patch('/user-config/toolsets')
        .send({ isInstalled: true })
        .expect(400);
    });

    it('returns 400 when isInstalled is not a boolean', async () => {
      await request(app.getHttpServer())
        .patch('/user-config/toolsets')
        .send({ id: 'toolset-abc', isInstalled: 'yes' })
        .expect(400);
    });

    it('returns 400 when body is empty', async () => {
      await request(app.getHttpServer())
        .patch('/user-config/toolsets')
        .send({})
        .expect(400);
    });
  });

  describe('PATCH /user-config/deployments', () => {
    it('returns 204 for a valid install request', async () => {
      service.updateInstalledDeployment.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .patch('/user-config/deployments')
        .send({ id: 'deployment-xyz', isInstalled: true })
        .expect(204);

      expect(service.updateInstalledDeployment).toHaveBeenCalledWith(
        'deployment-xyz',
        true,
        TEST_USER.at,
        TEST_USER.bucket,
      );
    });

    it('returns 204 for a valid uninstall request', async () => {
      service.updateInstalledDeployment.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .patch('/user-config/deployments')
        .send({ id: 'deployment-xyz', isInstalled: false })
        .expect(204);

      expect(service.updateInstalledDeployment).toHaveBeenCalledWith(
        'deployment-xyz',
        false,
        TEST_USER.at,
        TEST_USER.bucket,
      );
    });

    it('returns 400 when id is missing', async () => {
      await request(app.getHttpServer())
        .patch('/user-config/deployments')
        .send({ isInstalled: true })
        .expect(400);
    });

    it('returns 400 when isInstalled is not a boolean', async () => {
      await request(app.getHttpServer())
        .patch('/user-config/deployments')
        .send({ id: 'deployment-xyz', isInstalled: 'yes' })
        .expect(400);
    });

    it('returns 400 when body is empty', async () => {
      await request(app.getHttpServer())
        .patch('/user-config/deployments')
        .send({})
        .expect(400);
    });
  });

  describe('PATCH /user-config/prompts', () => {
    it('returns 204 and forwards a nested prompt path containing spaces', async () => {
      service.updateInstalledPrompt.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .patch('/user-config/prompts')
        .send({ id: 'Work/AI/tone of voice', isInstalled: true })
        .expect(204);

      expect(service.updateInstalledPrompt).toHaveBeenCalledWith(
        'Work/AI/tone of voice',
        true,
        TEST_USER.at,
        TEST_USER.bucket,
      );
    });

    it('returns 204 for an unfavorite request', async () => {
      service.updateInstalledPrompt.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .patch('/user-config/prompts')
        .send({ id: 'summarize', isInstalled: false })
        .expect(204);

      expect(service.updateInstalledPrompt).toHaveBeenCalledWith(
        'summarize',
        false,
        TEST_USER.at,
        TEST_USER.bucket,
      );
    });

    it('returns 400 for a traversal path', async () => {
      await request(app.getHttpServer())
        .patch('/user-config/prompts')
        .send({ id: '../other-bucket/secret', isInstalled: true })
        .expect(400);

      expect(service.updateInstalledPrompt).not.toHaveBeenCalled();
    });

    it('returns 400 when id is missing', async () => {
      await request(app.getHttpServer())
        .patch('/user-config/prompts')
        .send({ isInstalled: true })
        .expect(400);
    });

    it('returns 400 when isInstalled is not a boolean', async () => {
      await request(app.getHttpServer())
        .patch('/user-config/prompts')
        .send({ id: 'summarize', isInstalled: 'yes' })
        .expect(400);
    });
  });

  describe('PATCH /user-config/deployments/selected', () => {
    it('returns 204 for a valid id', async () => {
      service.updateSelectedDeployment.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .patch('/user-config/deployments/selected')
        .send({ id: 'gpt-4o' })
        .expect(204);

      expect(service.updateSelectedDeployment).toHaveBeenCalledWith(
        'gpt-4o',
        TEST_USER.at,
        TEST_USER.bucket,
      );
    });

    it('returns 204 for null id (clear selection)', async () => {
      service.updateSelectedDeployment.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .patch('/user-config/deployments/selected')
        .send({ id: null })
        .expect(204);

      expect(service.updateSelectedDeployment).toHaveBeenCalledWith(
        null,
        TEST_USER.at,
        TEST_USER.bucket,
      );
    });

    it('returns 204 for empty body (id defaults to null)', async () => {
      service.updateSelectedDeployment.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .patch('/user-config/deployments/selected')
        .send({})
        .expect(204);

      expect(service.updateSelectedDeployment).toHaveBeenCalledWith(
        null,
        TEST_USER.at,
        TEST_USER.bucket,
      );
    });
  });
});

describe('PATCH /api/v1/user-config/toolsets — real service', () => {
  let app: INestApplication;
  let realService: UserConfigService;

  beforeEach(async () => {
    realService = new UserConfigService(makeDialClient());

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserConfigController],
      providers: [{ provide: UserConfigService, useValue: realService }],
    }).compile();

    app = module.createNestApplication();
    app.use(
      (req: ExpressRequest, _res: ExpressResponse, next: NextFunction) => {
        req.user = TEST_USER;
        next();
      },
    );
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

  it('is idempotent when installing an already-installed toolset id', async () => {
    /*
     * `legacyMigrationDone: true` (v3Config) short-circuits the legacy
     * installation-file consolidation in readConfig, so each request writes
     * back exactly once — matching the pattern in
     * user-config.service.spec.ts's "does not duplicate" unit test.
     */
    makeSingleDownloadSpy(realService, {
      ok: true,
      body: JSON.stringify(
        v3Config({ toolsets: { installed: ['toolset-abc'] } }),
      ),
    });
    const uploadSpy = makeUploadSpy(realService);

    await request(app.getHttpServer())
      .patch('/user-config/toolsets')
      .send({ id: 'toolset-abc', isInstalled: true })
      .expect(204);
    await request(app.getHttpServer())
      .patch('/user-config/toolsets')
      .send({ id: 'toolset-abc', isInstalled: true })
      .expect(204);

    expect(uploadSpy).toHaveBeenCalledTimes(2);
    const firstUpload = await getUploadedConfigAt(uploadSpy, 0);
    const secondUpload = await getUploadedConfigAt(uploadSpy, 1);
    for (const uploaded of [firstUpload, secondUpload]) {
      expect(
        uploaded.toolsets.installed.filter((id) => id === 'toolset-abc'),
      ).toHaveLength(1);
    }
  });

  it('is a no-op when uninstalling a toolset id that is not installed', async () => {
    makeSingleDownloadSpy(realService, {
      ok: true,
      body: JSON.stringify(v3Config()),
    });
    const uploadSpy = makeUploadSpy(realService);

    await request(app.getHttpServer())
      .patch('/user-config/toolsets')
      .send({ id: 'toolset-missing', isInstalled: false })
      .expect(204);

    const uploaded = await getUploadedConfigAt(uploadSpy, 0);
    expect(uploaded.toolsets.installed).toHaveLength(0);
  });
});
