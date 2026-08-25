import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UnpublishConversationDto } from '../dto/unpublish-conversation.dto';

const validateBody = async (plain: Record<string, unknown>) => {
  const instance = plainToInstance(UnpublishConversationDto, plain);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
};

describe('UnpublishConversationDto', () => {
  it('accepts a plain folderPath', async () => {
    await expect(
      validateBody({ folderPath: 'Organization/Shared chats' }),
    ).resolves.toHaveLength(0);
  });

  it('accepts an empty folderPath, which targets the public root', async () => {
    await expect(validateBody({ folderPath: '' })).resolves.toHaveLength(0);
  });

  it('rejects a folderPath containing a path traversal segment', async () => {
    const errors = await validateBody({ folderPath: '../../etc/passwd' });
    expect(errors.some((error) => error.property === 'folderPath')).toBe(true);
  });

  it('rejects a missing folderPath', async () => {
    const errors = await validateBody({});
    expect(errors.some((error) => error.property === 'folderPath')).toBe(true);
  });

  /* Conversations have no version concept, so the DTO must not silently accept one. */
  it('rejects a version field', async () => {
    const errors = await validateBody({
      folderPath: 'Organization',
      version: '1.0.0',
    });
    expect(errors.some((error) => error.property === 'version')).toBe(true);
  });

  it('rejects a rules array, which unpublish must never forward', async () => {
    const errors = await validateBody({
      folderPath: 'Organization',
      rules: [],
    });
    expect(errors.some((error) => error.property === 'rules')).toBe(true);
  });
});
