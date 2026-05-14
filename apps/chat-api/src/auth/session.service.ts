import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { CompactEncrypt, compactDecrypt } from 'jose';
import type { EnvironmentVariables } from '../config/environment.config';
import { KeysService } from './keys.service';
import type { SessionPayload } from './session.types';

@Injectable()
export class SessionService {
  constructor(
    private readonly keys: KeysService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async encrypt(payload: SessionPayload): Promise<string> {
    const plaintext = new TextEncoder().encode(JSON.stringify(payload));
    return new CompactEncrypt(plaintext)
      .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
      .encrypt(this.keys.activeKey);
  }

  async decrypt(token: string): Promise<SessionPayload> {
    const keysToTry: Uint8Array[] = [this.keys.activeKey];
    if (this.keys.previousKey) {
      keysToTry.push(this.keys.previousKey);
    }

    for (const key of keysToTry) {
      try {
        const { plaintext } = await compactDecrypt(token, key);
        return JSON.parse(
          new TextDecoder().decode(plaintext),
        ) as SessionPayload;
      } catch {
        // try next key
      }
    }

    throw new UnauthorizedException('Invalid or expired session');
  }

  async decryptFromRequest(req: Request): Promise<SessionPayload> {
    const cookieName = this.config.get('AUTH_SESSION_COOKIE_NAME', {
      infer: true,
    }) as string;
    const token: string | undefined = (req.cookies as Record<string, string>)[
      cookieName
    ];
    if (!token) {
      throw new UnauthorizedException('No session cookie');
    }
    return this.decrypt(token);
  }
}
