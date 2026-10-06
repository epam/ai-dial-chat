import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { SKILL_RESOURCE_URL_PATTERN } from '../../skills/constants/skill-resource.constants';
import { UpdateInstalledSkillDto } from '../dto/update-installed-skill.dto';

const validateDto = async (id: unknown) =>
  validate(
    plainToInstance(UpdateInstalledSkillDto, { id, isInstalled: true }),
    {
      whitelist: true,
      forbidNonWhitelisted: true,
    },
  );

const VALID_IDS = [
  'skills/my-bucket/analysis/revenue-skill',
  'skills/my-bucket/revenue-skill',
  'skills/my.bucket/a.b',
  'skills/b/__1.0.0__',
  'skills/b/folder/My Skill v1.2',
  'skills/b/a..b',
  'skills/..b/x',
];

const INVALID_IDS = [
  'skills/../x',
  'skills/./x',
  'skills/b/../x',
  'skills/b/./x',
  'skills/b/x/..',
  'skills/b/x/.',
  'skills//x',
  'skills/b/',
  'skills/b',
  'skills/%2e%2e/x',
  'skills/b/%2e%2e/x',
  'skills/b/x;y',
  'prompts/b/x',
];

describe('SKILL_RESOURCE_URL_PATTERN', () => {
  it.each(VALID_IDS)('matches the valid skill id %s', (value) => {
    expect(SKILL_RESOURCE_URL_PATTERN.test(value)).toBe(true);
  });

  it.each(INVALID_IDS)('does not match the unsafe skill id %s', (value) => {
    expect(SKILL_RESOURCE_URL_PATTERN.test(value)).toBe(false);
  });
});

describe('UpdateInstalledSkillDto', () => {
  it.each(VALID_IDS)('accepts the valid skill id %s', async (value) => {
    expect(await validateDto(value)).toHaveLength(0);
  });

  it.each(INVALID_IDS)('rejects the unsafe skill id %s', async (value) => {
    const errors = await validateDto(value);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('id');
  });
});
