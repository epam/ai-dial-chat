import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '../../auth/session/session.types';
import { ChatController } from '../chat.controller';
import { ChatService } from '../chat.service';
import { ChatCompletionDto, ChatMessageRole } from '../dto/chat-completion.dto';

const dto: ChatCompletionDto = {
  deployment: 'gpt-4',
  messages: [{ role: ChatMessageRole.User, content: 'Hello' }],
};

const mockReq = {
  user: { at: 'test-token' } as SessionUser,
} as unknown as Request;

describe('ChatController', () => {
  let controller: ChatController;
  let service: { sendCompletion: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    service = { sendCompletion: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [{ provide: ChatService, useValue: service }],
    }).compile();

    controller = module.get(ChatController);
  });

  afterEach(() => vi.clearAllMocks());

  it('delegates to ChatService', async () => {
    const response = { choices: [] };
    service.sendCompletion.mockResolvedValue(response);

    const result = await controller.sendCompletion(mockReq, dto);
    expect(result).toEqual(response);
    expect(service.sendCompletion).toHaveBeenCalledWith(dto, 'test-token');
  });

  it('propagates NotFoundException', async () => {
    service.sendCompletion.mockRejectedValue(new NotFoundException());
    await expect(controller.sendCompletion(mockReq, dto)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('propagates BadRequestException', async () => {
    service.sendCompletion.mockRejectedValue(new BadRequestException());
    await expect(controller.sendCompletion(mockReq, dto)).rejects.toThrow(
      BadRequestException,
    );
  });
});
