import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatController } from '../chat.controller';
import { ChatService } from '../chat.service';

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

  describe('POST /chat/completions/:deployment', () => {
    it('returns 200 with valid body', async () => {
      const response = { choices: [{ message: { content: 'Hi!' } }] };
      service.sendCompletion.mockResolvedValue(response);

      const result = await request(app.getHttpServer())
        .post('/chat/completions/gpt-4')
        .send({ messages: [{ role: 'user', content: 'Hello' }] })
        .expect(201);

      expect(result.body).toEqual(response);
      expect(service.sendCompletion).toHaveBeenCalledWith('gpt-4', {
        messages: [{ role: 'user', content: 'Hello' }],
      });
    });

    it('returns 400 for invalid body', async () => {
      await request(app.getHttpServer())
        .post('/chat/completions/gpt-4')
        .send({ messages: 'not-an-array' })
        .expect(400);
    });

    it('returns 400 for invalid role in message', async () => {
      await request(app.getHttpServer())
        .post('/chat/completions/gpt-4')
        .send({ messages: [{ role: 'invalid', content: 'hi' }] })
        .expect(400);
    });

    it('returns 404 for unknown deployment', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      service.sendCompletion.mockRejectedValue(new NotFoundException());

      await request(app.getHttpServer())
        .post('/chat/completions/unknown')
        .send({ messages: [{ role: 'user', content: 'Hello' }] })
        .expect(404);
    });

    it('returns 503 when DIAL Core is unreachable', async () => {
      const { ServiceUnavailableException } = await import('@nestjs/common');
      service.sendCompletion.mockRejectedValue(
        new ServiceUnavailableException(),
      );

      await request(app.getHttpServer())
        .post('/chat/completions/gpt-4')
        .send({ messages: [{ role: 'user', content: 'Hello' }] })
        .expect(503);
    });
  });
});
