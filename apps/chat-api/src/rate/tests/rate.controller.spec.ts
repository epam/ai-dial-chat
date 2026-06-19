import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageRating } from '../../domain/message-rating';
import { RateController } from '../rate.controller';
import { RateService } from '../rate.service';

const TEST_USER = {
  at: 'test-access-token',
};

const VALID_BODY = {
  conversationId: 'bucket/conv-id',
  responseId: 'msg-456',
  modelId: 'anthropic.claude-v3-sonnet',
  rate: MessageRating.Like,
};

describe('RateController (integration)', () => {
  let app: INestApplication;
  let service: { rateMessage: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    service = { rateMessage: vi.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RateController],
      providers: [{ provide: RateService, useValue: service }],
    }).compile();

    app = module.createNestApplication();
    app.use(
      (req: { user: typeof TEST_USER }, _res: unknown, next: () => void) => {
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
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  describe('POST /rate', () => {
    it('returns 204 for a valid body', async () => {
      await request(app.getHttpServer())
        .post('/rate')
        .send(VALID_BODY)
        .expect(204);
    });

    it('passes the access token and dto to the service', async () => {
      await request(app.getHttpServer())
        .post('/rate')
        .send(VALID_BODY)
        .expect(204);

      expect(service.rateMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: VALID_BODY.conversationId,
          responseId: VALID_BODY.responseId,
          modelId: VALID_BODY.modelId,
          rate: VALID_BODY.rate,
        }),
        TEST_USER.at,
      );
    });

    it('returns 400 when conversationId is missing', async () => {
      await request(app.getHttpServer())
        .post('/rate')
        .send({
          responseId: VALID_BODY.responseId,
          modelId: VALID_BODY.modelId,
          rate: VALID_BODY.rate,
        })
        .expect(400);
    });

    it('returns 400 when responseId is missing', async () => {
      await request(app.getHttpServer())
        .post('/rate')
        .send({
          conversationId: VALID_BODY.conversationId,
          modelId: VALID_BODY.modelId,
          rate: VALID_BODY.rate,
        })
        .expect(400);
    });

    it('returns 400 when modelId is missing', async () => {
      await request(app.getHttpServer())
        .post('/rate')
        .send({
          conversationId: VALID_BODY.conversationId,
          responseId: VALID_BODY.responseId,
          rate: VALID_BODY.rate,
        })
        .expect(400);
    });

    it('returns 400 when rate is an invalid value', async () => {
      await request(app.getHttpServer())
        .post('/rate')
        .send({ ...VALID_BODY, rate: 0 })
        .expect(400);
    });

    it('returns 400 when body is empty', async () => {
      await request(app.getHttpServer()).post('/rate').send({}).expect(400);
    });

    it('accepts optional comment field', async () => {
      await request(app.getHttpServer())
        .post('/rate')
        .send({ ...VALID_BODY, comment: 'Response was helpful' })
        .expect(204);
    });
  });
});
