import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { KeysService } from './keys.service';
import { SessionService } from './session.service';
import type { SessionPayload } from './session.types';

const ACTIVE_HEX = 'a'.repeat(64);
const PREV_HEX = 'b'.repeat(64);
const OTHER_HEX = 'c'.repeat(64);

const COOKIE_NAME = '__Host-chat.sess';

const samplePayload: SessionPayload = {
  v: 1,
  sid: 'test-sid',
  providerId: 'keycloak',
  sub: 'user-1',
  at: 'access-token',
  rt: 'refresh-token',
  at_exp: 9999999999,
  rt_exp: 9999999999,
  iat: 1715596400,
  csrf: 'csrf-token',
  claims: { email: 'u@example.com' },
};

async function buildService(
  activeHex: string,
  prevHex?: string,
): Promise<SessionService> {
  const module = await Test.createTestingModule({
    providers: [
      KeysService,
      SessionService,
      {
        provide: ConfigService,
        useValue: {
          get: (key: string) => {
            const map: Record<string, string | undefined> = {
              AUTH_SESSION_SECRET: activeHex,
              AUTH_SESSION_PREV_SECRET: prevHex,
              AUTH_SESSION_COOKIE_NAME: COOKIE_NAME,
            };
            return map[key];
          },
        },
      },
    ],
  }).compile();
  await module.init();
  return module.get(SessionService);
}

describe('SessionService', () => {
  it('encrypt → decrypt round-trip returns original payload', async () => {
    const svc = await buildService(ACTIVE_HEX);
    const token = await svc.encrypt(samplePayload);
    const result = await svc.decrypt(token);
    expect(result).toEqual(samplePayload);
  });

  it('tampered ciphertext throws UnauthorizedException', async () => {
    const svc = await buildService(ACTIVE_HEX);
    const token = await svc.encrypt(samplePayload);
    const tampered = token.slice(0, -4) + 'XXXX';
    await expect(svc.decrypt(tampered)).rejects.toThrow(UnauthorizedException);
  });

  it('payload encrypted with previous key decrypts successfully', async () => {
    const prevSvc = await buildService(PREV_HEX);
    const tokenEncryptedWithPrev = await prevSvc.encrypt(samplePayload);

    const svc = await buildService(ACTIVE_HEX, PREV_HEX);
    const result = await svc.decrypt(tokenEncryptedWithPrev);
    expect(result).toEqual(samplePayload);
  });

  it('payload encrypted with unknown key throws UnauthorizedException', async () => {
    const otherSvc = await buildService(OTHER_HEX);
    const token = await otherSvc.encrypt(samplePayload);

    const svc = await buildService(ACTIVE_HEX, PREV_HEX);
    await expect(svc.decrypt(token)).rejects.toThrow(UnauthorizedException);
  });
});
