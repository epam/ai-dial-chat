import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { KeysService } from '../../keys/keys.service';

const VALID_HEX = 'a'.repeat(64);
const VALID_HEX_2 = 'b'.repeat(64);

function buildModule(env: Record<string, string | undefined>) {
  return Test.createTestingModule({
    providers: [
      KeysService,
      {
        provide: ConfigService,
        useValue: {
          get: (key: string) => env[key],
        },
      },
    ],
  }).compile();
}

describe('KeysService', () => {
  it('accepts a valid 64-char hex active key', async () => {
    const module = await buildModule({
      AUTH_SESSION_SECRET: VALID_HEX,
    });
    const svc = module.get(KeysService);
    await module.init();
    expect(svc.activeKey).toBeInstanceOf(Uint8Array);
    expect(svc.activeKey).toHaveLength(32);
    expect(svc.previousKey).toBeUndefined();
  });

  it('throws on invalid key length', async () => {
    const module = await buildModule({
      AUTH_SESSION_SECRET: 'tooshort',
    });
    const svc = module.get(KeysService);
    expect(() => svc.onModuleInit()).toThrow();
  });

  it('previous key is optional — absent means undefined', async () => {
    const module = await buildModule({
      AUTH_SESSION_SECRET: VALID_HEX,
      AUTH_SESSION_PREV_SECRET: undefined,
    });
    const svc = module.get(KeysService);
    await module.init();
    expect(svc.previousKey).toBeUndefined();
  });

  it('accepts a valid previous key', async () => {
    const module = await buildModule({
      AUTH_SESSION_SECRET: VALID_HEX,
      AUTH_SESSION_PREV_SECRET: VALID_HEX_2,
    });
    const svc = module.get(KeysService);
    await module.init();
    expect(svc.previousKey).toBeInstanceOf(Uint8Array);
    expect(svc.previousKey).toHaveLength(32);
  });
});
