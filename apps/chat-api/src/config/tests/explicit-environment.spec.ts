import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EXPLICIT_ENVIRONMENT_PROPERTY,
  ExplicitEnvironment,
  attachExplicitEnvironment,
  collectExplicitEnvironment,
} from '../explicit-environment';
import { validate } from '../validation';

const REQUIRED_ENV = {
  DIAL_CORE_URL: 'https://dial-core.example.com',
  AUTH_SESSION_SECRET: 'a'.repeat(64),
  AUTH_CALLBACK_BASE_URL: 'http://localhost:5000',
};

describe('collectExplicitEnvironment', () => {
  it('returns every name whose raw value is defined', () => {
    const names = collectExplicitEnvironment({
      SCHEDULED_TASKS_ENABLED: 'false',
      USAGE_LIMITS_WARNING_THRESHOLD_PERCENT: '75',
      ABSENT: undefined,
    });

    expect([...names].sort()).toEqual([
      'SCHEDULED_TASKS_ENABLED',
      'USAGE_LIMITS_WARNING_THRESHOLD_PERCENT',
    ]);
  });

  it('counts an empty string as present', () => {
    expect(
      collectExplicitEnvironment({ SCHEDULED_TASKS_ENABLED: '' }).has(
        'SCHEDULED_TASKS_ENABLED',
      ),
    ).toBe(true);
  });

  it('does not keep a reference to the raw object', () => {
    const raw: Record<string, unknown> = { A: '1' };
    const names = collectExplicitEnvironment(raw);
    raw['B'] = '2';

    expect(names.has('B')).toBe(false);
  });
});

describe('ExplicitEnvironment', () => {
  it('answers from an explicit name list', () => {
    const environment = ExplicitEnvironment.of(['PROJECTS_ENABLED']);

    expect(environment.isExplicit('PROJECTS_ENABLED')).toBe(true);
    expect(environment.isExplicit('SCHEDULED_TASKS_ENABLED')).toBe(false);
  });

  it('reads the names validate() attached to the validated config', () => {
    const validated = attachExplicitEnvironment(
      { SCHEDULED_TASKS_ENABLED: false, PROJECTS_ENABLED: true },
      collectExplicitEnvironment({ PROJECTS_ENABLED: 'true' }),
    );
    const environment = ExplicitEnvironment.fromConfigService(
      new ConfigService(validated),
    );

    expect(environment.isExplicit('PROJECTS_ENABLED')).toBe(true);
    expect(environment.isExplicit('SCHEDULED_TASKS_ENABLED')).toBe(false);
  });

  it('treats every held value as explicit when nothing was captured', () => {
    const environment = ExplicitEnvironment.fromConfigService(
      new ConfigService({ PROJECTS_ENABLED: 'true' }),
    );

    expect(environment.isExplicit('PROJECTS_ENABLED')).toBe(true);
    expect(environment.isExplicit('SCHEDULED_TASKS_ENABLED')).toBe(false);
  });
});

describe('explicit presence through ConfigModule', () => {
  let directory: string;
  let processEnvBefore: NodeJS.ProcessEnv;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'chat-api-explicit-env-'));
    /* ConfigModule copies validated values into process.env; restore it. */
    processEnvBefore = { ...process.env };
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    for (const name of Object.keys(process.env)) {
      if (!(name in processEnvBefore)) {
        delete process.env[name];
      }
    }
    Object.assign(process.env, processEnvBefore);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    rmSync(directory, { recursive: true, force: true });
  });

  it('marks a .env value and a process value as explicit and a class default as not', async () => {
    const envFile = join(directory, '.env');
    writeFileSync(
      envFile,
      [
        ...Object.entries(REQUIRED_ENV).map(
          ([name, value]) => `${name}=${value}`,
        ),
        'PROJECTS_ENABLED=true',
        '',
      ].join('\n'),
    );
    vi.stubEnv('USAGE_LIMITS_WARNING_THRESHOLD_PERCENT', '75');
    vi.stubEnv('SCHEDULED_TASKS_ENABLED', undefined);

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ envFilePath: [envFile], validate })],
      providers: [
        {
          provide: ExplicitEnvironment,
          inject: [ConfigService],
          useFactory: ExplicitEnvironment.fromConfigService,
        },
      ],
    }).compile();

    const environment = moduleRef.get(ExplicitEnvironment);
    const configService = moduleRef.get(ConfigService);

    expect(environment.isExplicit('PROJECTS_ENABLED')).toBe(true);
    expect(
      environment.isExplicit('USAGE_LIMITS_WARNING_THRESHOLD_PERCENT'),
    ).toBe(true);
    expect(environment.isExplicit('SCHEDULED_TASKS_ENABLED')).toBe(false);
    /* The typed default is still what ConfigService returns. */
    expect(configService.get('SCHEDULED_TASKS_ENABLED')).toBe(false);
    /* The captured names never reach the process environment. */
    expect(process.env[EXPLICIT_ENVIRONMENT_PROPERTY]).toBeUndefined();

    await moduleRef.close();
  });
});
