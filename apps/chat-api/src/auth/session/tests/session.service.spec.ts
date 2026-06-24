import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { KeysService } from '../../keys/keys.service';
import { SessionService } from '../session.service';
import type { SessionPayload } from '../session.types';

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
  bucket: '',
};

async function buildService(
  activeHex: string,
  prevHex?: string,
  configOverrides: Record<string, string | boolean | undefined> = {},
): Promise<SessionService> {
  const module = await Test.createTestingModule({
    providers: [
      KeysService,
      SessionService,
      {
        provide: ConfigService,
        useValue: {
          get: (key: string) => {
            const map: Record<string, string | boolean | undefined> = {
              AUTH_SESSION_SECRET: activeHex,
              AUTH_SESSION_PREV_SECRET: prevHex,
              AUTH_SESSION_COOKIE_NAME: COOKIE_NAME,
              ...configOverrides,
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

  it('key rotation: tokens encrypted with old active key still decrypt after it becomes the previous key', async () => {
    // Before rotation: PREV_HEX is active.
    const beforeRotation = await buildService(PREV_HEX);
    const tokenEncryptedBeforeRotation =
      await beforeRotation.encrypt(samplePayload);

    // After rotation: ACTIVE_HEX becomes active, PREV_HEX moves to previous.
    const afterRotation = await buildService(ACTIVE_HEX, PREV_HEX);
    const result = await afterRotation.decrypt(tokenEncryptedBeforeRotation);
    expect(result).toEqual(samplePayload);

    // Tokens encrypted with the new active key also decrypt.
    const newToken = await afterRotation.encrypt(samplePayload);
    const result2 = await afterRotation.decrypt(newToken);
    expect(result2).toEqual(samplePayload);
  });

  it('decryptFromRequest reads relaxed cookie name when secure cookies are disabled', async () => {
    const svc = await buildService(ACTIVE_HEX, undefined, {
      AUTH_COOKIE_SECURE: false,
    });
    const token = await svc.encrypt(samplePayload);

    const result = await svc.decryptFromRequest({
      cookies: { 'chat.sess': token },
    } as never);

    expect(result).toEqual(samplePayload);
  });

  it('decryptFromRequest assembles chunked session cookie values', async () => {
    const svc = await buildService(ACTIVE_HEX);
    const token = await svc.encrypt({
      ...samplePayload,
      at: 'x'.repeat(5000),
    });

    const result = await svc.decryptFromRequest({
      cookies: {
        [`${COOKIE_NAME}.0`]: token.slice(0, 3800),
        [`${COOKIE_NAME}.1`]: token.slice(3800),
      },
    } as never);

    expect(result.at).toBe('x'.repeat(5000));
  });
});
