import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/environment.config';

@Injectable()
export class KeysService implements OnModuleInit {
  private _activeKey!: Uint8Array;
  private _previousKey: Uint8Array | undefined;

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  onModuleInit(): void {
    const activeHex = this.config.get('AUTH_SESSION_SECRET', { infer: true });
    this._activeKey = this.parseHexKey(activeHex, 'AUTH_SESSION_SECRET');

    const prevHex = this.config.get('AUTH_SESSION_PREV_SECRET', {
      infer: true,
    });
    if (prevHex) {
      this._previousKey = this.parseHexKey(
        prevHex,
        'AUTH_SESSION_PREV_SECRET',
      );
    }
  }

  get activeKey(): Uint8Array {
    return this._activeKey;
  }

  get previousKey(): Uint8Array | undefined {
    return this._previousKey;
  }

  private parseHexKey(hex: string, varName: string): Uint8Array {
    if (!/^[0-9a-f]{64}$/i.test(hex)) {
      throw new Error(
        `${varName} must be a 64-character hex string (32 bytes)`,
      );
    }
    const bytes = Buffer.from(hex, 'hex');
    if (bytes.length !== 32) {
      throw new Error(`${varName} decoded to ${bytes.length} bytes, expected 32`);
    }
    return new Uint8Array(bytes);
  }
}
