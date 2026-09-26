import { mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { validate } from '../validation';

const promptKeys = [
  'TEXT_REFINEMENT_SKILL_DESCRIPTION_PROMPT',
  'TEXT_REFINEMENT_SKILL_INSTRUCTIONS_PROMPT',
  'TEXT_REFINEMENT_SCHEDULED_TASK_DESCRIPTION_PROMPT',
  'TEXT_REFINEMENT_SCHEDULED_TASK_INSTRUCTIONS_PROMPT',
  'CONVERSATION_NAMING_SYSTEM_PROMPT',
  'TRANSCRIPTION_PROMPT',
] as const;

const baseConfig = {
  DIAL_CORE_URL: 'https://dial-core.example.com',
  AUTH_SESSION_SECRET: 'a'.repeat(64),
  AUTH_CALLBACK_BASE_URL: 'http://localhost:5000',
};

describe('server prompt environment overrides', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('does not require any prompt override', () => {
    const config = validate(baseConfig);
    for (const key of promptKeys) expect(config[key]).toBeUndefined();
  });

  it.each(promptKeys)('preserves blank and nonblank values for %s', (key) => {
    for (const value of [
      '',
      ' \t\n ',
      '  ## تعليمات\nKeep {{name}} and $VALUE.\n',
    ]) {
      expect(validate({ ...baseConfig, [key]: value })[key]).toBe(value);
    }
  });

  it('loads quoted multiline and escaped-newline values from an actual env file', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dial-prompt-overrides-'));
    const envFilePath = join(directory, '.env');
    const prompt = '  ## تعليمات\nPreserve {{name}}, $VALUE and # Markdown.\n';
    for (const key of promptKeys) vi.stubEnv(key, undefined);
    writeFileSync(
      envFilePath,
      promptKeys
        .map(
          (key, index) =>
            `${key}="${index % 2 ? prompt.replaceAll('\n', '\\n') : prompt}"`,
        )
        .join('\n'),
    );

    try {
      const module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            envFilePath,
            validatePredefined: false,
            skipProcessEnv: true,
            validate: (raw) => {
              const validated = validate({ ...baseConfig, ...raw });
              return Object.fromEntries(
                promptKeys.map((key) => [key, validated[key]]),
              );
            },
          }),
        ],
      }).compile();
      try {
        const config = module.get(ConfigService);
        for (const key of promptKeys) expect(config.get(key)).toBe(prompt);
      } finally {
        await module.close();
      }
    } finally {
      unlinkSync(envFilePath);
      rmdirSync(directory);
    }
  });
});
