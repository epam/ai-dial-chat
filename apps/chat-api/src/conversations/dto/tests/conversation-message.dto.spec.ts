import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  ConversationMessageDto,
  ConversationMessageRole,
} from '../conversation-message.dto';

const BASE_MESSAGE = {
  role: ConversationMessageRole.Assistant,
  content: 'Hello',
  timestamp: '2026-01-01T00:00:00.000Z',
};

const validateDto = async (plain: Record<string, unknown>) => {
  const instance = plainToInstance(ConversationMessageDto, plain);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
};

describe('ConversationMessageDto — custom_content.reasoning_summaries', () => {
  it('validates successfully when reasoning_summaries is absent (backward compatibility)', async () => {
    const errors = await validateDto(BASE_MESSAGE);
    expect(errors).toHaveLength(0);
  });

  it('validates successfully with a well-formed reasoning_summaries entry', async () => {
    const errors = await validateDto({
      ...BASE_MESSAGE,
      custom_content: {
        reasoning_summaries: [
          {
            itemId: 'rs_1',
            outputIndex: 0,
            summaryIndex: 0,
            text: 'Checking sources',
          },
        ],
      },
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a reasoning_summaries entry missing required fields', async () => {
    const errors = await validateDto({
      ...BASE_MESSAGE,
      custom_content: {
        reasoning_summaries: [{ text: 'no key fields' }],
      },
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a negative outputIndex/summaryIndex', async () => {
    const errors = await validateDto({
      ...BASE_MESSAGE,
      custom_content: {
        reasoning_summaries: [
          { itemId: 'rs_1', outputIndex: -1, summaryIndex: 0, text: 'x' },
        ],
      },
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});
