import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatController } from '../chat.controller';
import { ChatService } from '../chat.service';

const TEST_USER = { at: 'test-access-token', bucket: 'test-bucket' };

describe('ChatController (integration)', () => {
  let app: INestApplication;
  let service: { sendCompletion: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    service = { sendCompletion: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [{ provide: ChatService, useValue: service }],
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

  describe('POST /chat/completions', () => {
    const VALID_BODY = {
      deployment: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
    };

    it('returns 200 with valid body', async () => {
      const response = { choices: [{ message: { content: 'Hi!' } }] };
      service.sendCompletion.mockResolvedValue(response);

      const result = await request(app.getHttpServer())
        .post('/chat/completions')
        .send(VALID_BODY)
        .expect(201);

      expect(result.body).toEqual(response);
      expect(service.sendCompletion).toHaveBeenCalledWith(
        VALID_BODY,
        'test-access-token',
      );
    });

    it('returns 400 when deployment is missing', async () => {
      await request(app.getHttpServer())
        .post('/chat/completions')
        .send({ messages: [{ role: 'user', content: 'Hello' }] })
        .expect(400);
    });

    it('returns 400 for invalid messages type', async () => {
      await request(app.getHttpServer())
        .post('/chat/completions')
        .send({ deployment: 'gpt-4', messages: 'not-an-array' })
        .expect(400);
    });

    it('returns 400 for invalid role in message', async () => {
      await request(app.getHttpServer())
        .post('/chat/completions')
        .send({
          deployment: 'gpt-4',
          messages: [{ role: 'invalid', content: 'hi' }],
        })
        .expect(400);
    });

    it('returns 404 for unknown deployment', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      service.sendCompletion.mockRejectedValue(new NotFoundException());

      await request(app.getHttpServer())
        .post('/chat/completions')
        .send(VALID_BODY)
        .expect(404);
    });

    it('returns 503 when DIAL Core is unreachable', async () => {
      const { ServiceUnavailableException } = await import('@nestjs/common');
      service.sendCompletion.mockRejectedValue(
        new ServiceUnavailableException(),
      );

      await request(app.getHttpServer())
        .post('/chat/completions')
        .send(VALID_BODY)
        .expect(503);
    });
  });
});
