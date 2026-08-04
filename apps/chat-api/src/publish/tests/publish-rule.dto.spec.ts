import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { PublishRuleDto } from '../dto/publish-rule.dto';

const VALID_RULE = {
  source: 'roles',
  function: 'CONTAIN',
  targets: ['engineering', 'support'],
};

async function validateDto(plain: Record<string, unknown>) {
  const instance = plainToInstance(PublishRuleDto, plain);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
}

describe('PublishRuleDto', () => {
  it('passes for a valid EQUAL rule', async () => {
    const errors = await validateDto({
      source: 'title',
      function: 'EQUAL',
      targets: ['Internal Tools'],
    });
    expect(errors).toHaveLength(0);
  });

  it('passes for a valid multi-target CONTAIN rule', async () => {
    const errors = await validateDto(VALID_RULE);
    expect(errors).toHaveLength(0);
  });

  it('passes for a valid REGEX rule with one target', async () => {
    const errors = await validateDto({
      source: 'dial_roles',
      function: 'REGEX',
      targets: ['^eng-.*$'],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid function enum value', async () => {
    const errors = await validateDto({ ...VALID_RULE, function: 'MATCHES' });
    expect(errors.some((e) => e.property === 'function')).toBe(true);
  });

  it('rejects an empty source string', async () => {
    const errors = await validateDto({ ...VALID_RULE, source: '' });
    expect(errors.some((e) => e.property === 'source')).toBe(true);
  });

  it('rejects an empty targets array', async () => {
    const errors = await validateDto({ ...VALID_RULE, targets: [] });
    expect(errors.some((e) => e.property === 'targets')).toBe(true);
  });

  it('rejects a target that is an empty string', async () => {
    const errors = await validateDto({
      ...VALID_RULE,
      targets: ['engineering', ''],
    });
    expect(errors.some((e) => e.property === 'targets')).toBe(true);
  });

  it('rejects more than 20 targets', async () => {
    const errors = await validateDto({
      ...VALID_RULE,
      targets: Array.from({ length: 21 }, (_, i) => `target-${i}`),
    });
    expect(errors.some((e) => e.property === 'targets')).toBe(true);
  });

  it('rejects a source longer than 200 characters', async () => {
    const errors = await validateDto({
      ...VALID_RULE,
      source: 'a'.repeat(201),
    });
    expect(errors.some((e) => e.property === 'source')).toBe(true);
  });

  it('rejects a target longer than 200 characters', async () => {
    const errors = await validateDto({
      ...VALID_RULE,
      targets: ['a'.repeat(201)],
    });
    expect(errors.some((e) => e.property === 'targets')).toBe(true);
  });

  it('rejects malformed field types', async () => {
    const errors = await validateDto({
      source: 123,
      function: 'CONTAIN',
      targets: 'engineering',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts an unrecognized source not present in any allowlist', async () => {
    const errors = await validateDto({
      ...VALID_RULE,
      source: 'not_a_configured_source',
    });
    expect(errors).toHaveLength(0);
  });
});
