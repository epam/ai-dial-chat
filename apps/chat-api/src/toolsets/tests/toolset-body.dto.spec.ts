import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  ToolsetAuthType,
  ToolsetBodyDto,
  ToolsetTransport,
} from '../dto/toolset-body.dto';

const BASE_BODY = {
  name: 'My toolset',
  endpoint: 'https://my-toolset.example.com/mcp',
  transport: ToolsetTransport.Http,
  authSettings: { authenticationType: ToolsetAuthType.None },
};

async function validateDto(plain: Record<string, unknown>) {
  const instance = plainToInstance(ToolsetBodyDto, plain);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
}

describe('ToolsetBodyDto — intro', () => {
  it('passes when intro is omitted', async () => {
    const errors = await validateDto(BASE_BODY);
    expect(errors).toHaveLength(0);
  });

  it('passes when intro is an empty string', async () => {
    const errors = await validateDto({ ...BASE_BODY, intro: '' });
    expect(errors).toHaveLength(0);
  });

  it('passes when intro is exactly 90 characters', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      intro: 'a'.repeat(90),
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects intro longer than 90 characters', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      intro: 'a'.repeat(91),
    });
    expect(errors.some((e) => e.property === 'intro')).toBe(true);
  });
});
