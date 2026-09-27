import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateScheduledTaskBodyDto } from '../dto/create-scheduled-task.dto';

const BASE_BODY = {
  displayName: 'Daily summary of Cc {braces} and more',
  trigger: { date: '2026-07-24T09:00:00.000Z' },
  model: 'gpt-4.1-mini-2025-04-14',
  prompt: 'Summarize my inbox',
};

const invalidProperties = async (
  plain: Record<string, unknown>,
): Promise<string[]> => {
  const errors = await validate(
    plainToInstance(CreateScheduledTaskBodyDto, plain),
  );
  return errors.map((error) => error.property);
};

describe('CreateScheduledTaskBodyDto — text limits', () => {
  it('accepts a printable display name with letters the control-character check must not confuse', async () => {
    expect(await invalidProperties(BASE_BODY)).toEqual([]);
  });

  it('rejects a display name containing a line break', async () => {
    expect(
      await invalidProperties({ ...BASE_BODY, displayName: 'Daily\nsummary' }),
    ).toEqual(['displayName']);
  });

  it('rejects a display name over 256 characters', async () => {
    expect(
      await invalidProperties({ ...BASE_BODY, displayName: 'a'.repeat(257) }),
    ).toEqual(['displayName']);
  });

  it('rejects instructions over 50000 characters', async () => {
    expect(
      await invalidProperties({ ...BASE_BODY, prompt: 'a'.repeat(50001) }),
    ).toEqual(['prompt']);
  });
});
