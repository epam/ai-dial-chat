import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  ACCEPTED_RESOURCE_VERSIONS,
  REJECTED_RESOURCE_VERSIONS,
} from '../../common/validators/resource-version.corpus';
import { ForkApplicationVersionDto } from '../dto/application-version.dto';

const validateDto = async (plain: Record<string, unknown>) =>
  validate(plainToInstance(ForkApplicationVersionDto, plain), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('ForkApplicationVersionDto — version', () => {
  it.each(ACCEPTED_RESOURCE_VERSIONS)('accepts version %s', async (version) => {
    const errors = await validateDto({ version });
    expect(errors.some((e) => e.property === 'version')).toBe(false);
  });

  it.each(REJECTED_RESOURCE_VERSIONS)(
    'rejects version "%s"',
    async (version) => {
      const errors = await validateDto({ version });
      expect(errors.some((e) => e.property === 'version')).toBe(true);
    },
  );
});
