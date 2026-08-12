import {
  BadGatewayException,
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureGuard } from '../../app-config/feature-flags/feature.guard';
import { ClientChannelController } from '../client-channel.controller';
import { ClientChannelService } from '../client-channel.service';

const TEST_USER = { at: 'test-access-token' };

const streamOf = (chunks: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[index]));
      index += 1;
    },
  });
};

async function buildApp(service: unknown): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [ClientChannelController],
    providers: [{ provide: ClientChannelService, useValue: service }],
  })
    .overrideGuard(FeatureGuard)
    .useValue({ canActivate: () => true })
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

describe('ClientChannelController (integration)', () => {
  let app: INestApplication;
  let service: {
    subscribe: ReturnType<typeof vi.fn>;
    report: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      subscribe: vi.fn(),
      report: vi.fn().mockResolvedValue(undefined),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
    };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  describe('POST /api/v1/client-channel/subscribe', () => {
    it('streams the upstream events and echoes the channel id header', async () => {
      service.subscribe.mockResolvedValue({
        stream: streamOf(['data: {"id":"1"}\n\n']),
        channelId: 'channel-1',
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/client-channel/subscribe')
        .expect(200);

      expect(res.headers['x-dial-client-channel-id']).toBe('channel-1');
      expect(res.headers['content-type']).toContain('text/event-stream');
      expect(res.text).toContain('data: {"id":"1"}');
    });

    it('forwards an inbound reconnect channel id to the service', async () => {
      service.subscribe.mockResolvedValue({
        stream: streamOf([]),
        channelId: 'channel-1',
      });

      await request(app.getHttpServer())
        .post('/api/v1/client-channel/subscribe')
        .set('X-DIAL-CLIENT-CHANNEL-ID', 'previous-channel')
        .expect(200);

      expect(service.subscribe).toHaveBeenCalledWith(
        TEST_USER.at,
        'previous-channel',
        expect.anything(),
      );
    });

    it('returns 502 when the service rejects the subscription', async () => {
      service.subscribe.mockRejectedValue(
        new BadGatewayException('DIAL Core rejected the subscription'),
      );

      await request(app.getHttpServer())
        .post('/api/v1/client-channel/subscribe')
        .expect(502);
    });

    it('returns 400 when the reconnect channel id header is present but invalid', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/client-channel/subscribe')
        .set('X-DIAL-CLIENT-CHANNEL-ID', 'bad;channel')
        .expect(400);
      expect(service.subscribe).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/client-channel/report', () => {
    const validBody = { id: 'event-1', result: 'success' };

    it('returns 200 and forwards the report to the service', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/client-channel/report')
        .set('X-DIAL-CLIENT-CHANNEL-ID', 'channel-1')
        .send(validBody)
        .expect(200);

      expect(service.report).toHaveBeenCalledWith(
        TEST_USER.at,
        'channel-1',
        expect.objectContaining(validBody),
      );
    });

    it('returns 400 when the channel id header is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/client-channel/report')
        .send(validBody)
        .expect(400);
      expect(service.report).not.toHaveBeenCalled();
    });

    it('returns 400 when the channel id header contains invalid characters', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/client-channel/report')
        .set('X-DIAL-CLIENT-CHANNEL-ID', 'bad;channel')
        .send(validBody)
        .expect(400);
      expect(service.report).not.toHaveBeenCalled();
    });

    it('returns 400 when result is not success/denied', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/client-channel/report')
        .set('X-DIAL-CLIENT-CHANNEL-ID', 'channel-1')
        .send({ id: 'event-1', result: 'maybe' })
        .expect(400);
      expect(service.report).not.toHaveBeenCalled();
    });

    it('returns 502 when the service throws', async () => {
      service.report.mockRejectedValue(
        new BadGatewayException('DIAL Core returned an error response'),
      );
      await request(app.getHttpServer())
        .post('/api/v1/client-channel/report')
        .set('X-DIAL-CLIENT-CHANNEL-ID', 'channel-1')
        .send(validBody)
        .expect(502);
    });
  });

  describe('POST /api/v1/client-channel/unsubscribe', () => {
    it('returns 200 and forwards to the service', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/client-channel/unsubscribe')
        .set('X-DIAL-CLIENT-CHANNEL-ID', 'channel-1')
        .expect(200);

      expect(service.unsubscribe).toHaveBeenCalledWith(
        TEST_USER.at,
        'channel-1',
      );
    });

    it('returns 400 when the channel id header is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/client-channel/unsubscribe')
        .expect(400);
      expect(service.unsubscribe).not.toHaveBeenCalled();
    });
  });
});

describe('ClientChannelController — FeatureGuard wiring', () => {
  let app: INestApplication;
  let service: {
    subscribe: ReturnType<typeof vi.fn>;
    report: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      subscribe: vi
        .fn()
        .mockResolvedValue({ stream: streamOf([]), channelId: 'channel-1' }),
      report: vi.fn().mockResolvedValue(undefined),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientChannelController],
      providers: [{ provide: ClientChannelService, useValue: service }],
    })
      .overrideGuard(FeatureGuard)
      .useValue({ canActivate: () => false })
      .compile();

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
    await app.init();
    await app.listen(0, '127.0.0.1');
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it('rejects subscribe when the feature is disabled for this user', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/client-channel/subscribe')
      .expect(403);
    expect(service.subscribe).not.toHaveBeenCalled();
  });

  it('rejects report when the feature is disabled for this user', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/client-channel/report')
      .set('X-DIAL-CLIENT-CHANNEL-ID', 'channel-1')
      .send({ id: 'event-1', result: 'success' })
      .expect(403);
    expect(service.report).not.toHaveBeenCalled();
  });

  it('still allows unsubscribe when the feature is disabled, so a client can always clean up', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/client-channel/unsubscribe')
      .set('X-DIAL-CLIENT-CHANNEL-ID', 'channel-1')
      .expect(200);
    expect(service.unsubscribe).toHaveBeenCalledWith(TEST_USER.at, 'channel-1');
  });
});
