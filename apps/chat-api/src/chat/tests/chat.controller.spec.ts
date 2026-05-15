import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatController } from '../chat.controller';
import { ChatService } from '../chat.service';
import { ChatCompletionDto } from '../dto/chat-completion.dto';

const dto: ChatCompletionDto = {
  messages: [{ role: 'user', content: 'Hello' }],
};

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

    const result = await controller.sendCompletion('gpt-4', dto);
    expect(result).toEqual(response);
    expect(service.sendCompletion).toHaveBeenCalledWith('gpt-4', dto);
  });

  it('propagates NotFoundException', async () => {
    service.sendCompletion.mockRejectedValue(new NotFoundException());
    await expect(controller.sendCompletion('missing', dto)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('propagates BadRequestException', async () => {
    service.sendCompletion.mockRejectedValue(new BadRequestException());
    await expect(controller.sendCompletion('gpt-4', dto)).rejects.toThrow(
      BadRequestException,
    );
  });
});
