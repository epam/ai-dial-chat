import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationController } from '../conversation.controller';
import { ConversationService } from '../conversation.service';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('ConversationController (integration)', () => {
  let app: INestApplication;
  let service: { createConversation: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    service = { createConversation: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationController],
      providers: [{ provide: ConversationService, useValue: service }],
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

  describe('POST /conversations', () => {
    it('returns 201 with the created conversation for a valid body', async () => {
      const conversation = {
        id: '11111111-1111-1111-1111-111111111111',
        messages: [
          {
            id: '22222222-2222-2222-2222-222222222222',
            role: 'user',
            content: 'Hello',
            timestamp: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
      };
      service.createConversation.mockReturnValue(conversation);

      const result = await request(app.getHttpServer())
        .post('/conversations')
        .send({ firstMessage: 'Hello' })
        .expect(201);

      expect(result.body).toEqual(conversation);
      expect(service.createConversation).toHaveBeenCalledWith('Hello');
    });

    it('returns 400 when firstMessage is an empty string', async () => {
      await request(app.getHttpServer())
        .post('/conversations')
        .send({ firstMessage: '' })
        .expect(400);
    });

    it('returns 400 when body is empty', async () => {
      await request(app.getHttpServer())
        .post('/conversations')
        .send({})
        .expect(400);
    });

    it('returns 400 when firstMessage exceeds 4000 characters', async () => {
      await request(app.getHttpServer())
        .post('/conversations')
        .send({ firstMessage: 'a'.repeat(4001) })
        .expect(400);
    });

    it('returns 201 with a valid conversation shape from the real service', async () => {
      const realService = new ConversationService();
      const realModule: TestingModule = await Test.createTestingModule({
        controllers: [ConversationController],
        providers: [ConversationService],
      }).compile();

      const realApp = realModule.createNestApplication();
      realApp.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true }),
      );
      await realApp.init();

      const result = await request(realApp.getHttpServer())
        .post('/conversations')
        .send({ firstMessage: 'Hello from integration' })
        .expect(201);

      expect(result.body.id).toMatch(UUID_REGEX);
      expect(result.body.messages).toHaveLength(1);
      expect(result.body.messages[0].content).toBe('Hello from integration');

      await realApp.close();
      void realService;
    });
  });
});
