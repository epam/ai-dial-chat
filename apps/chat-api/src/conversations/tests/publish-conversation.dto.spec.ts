import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { PublishConversationDto } from '../dto/publish-conversation.dto';

const BASE_BODY = {
  folderPath: 'Organization/Data Science/Shared chats',
};

async function validateDto(plain: Record<string, unknown>) {
  const instance = plainToInstance(PublishConversationDto, plain);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
}

describe('PublishConversationDto — rules', () => {
  it('passes when rules is omitted', async () => {
    const errors = await validateDto(BASE_BODY);
    expect(errors).toHaveLength(0);
  });

  it('passes when rules is an empty array', async () => {
    const errors = await validateDto({ ...BASE_BODY, rules: [] });
    expect(errors).toHaveLength(0);
  });

  it('passes with a valid nested rule', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      rules: [
        { source: 'role', function: 'CONTAIN', targets: ['engineering'] },
      ],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects an empty targets array on a nested rule', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      rules: [{ source: 'role', function: 'CONTAIN', targets: [] }],
    });
    expect(errors.some((e) => e.property === 'rules')).toBe(true);
  });

  it('rejects more than 20 rules', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      rules: Array.from({ length: 21 }, () => ({
        source: 'role',
        function: 'CONTAIN',
        targets: ['engineering'],
      })),
    });
    expect(errors.some((e) => e.property === 'rules')).toBe(true);
  });
});
