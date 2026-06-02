import { Token } from '@/src/types/auth';

import { Client, Issuer } from 'openid-client';

export interface RefreshToken {
  isRefreshing: boolean;
  token: Token | undefined;
}

interface ProviderMeta {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalObj = globalThis as unknown as any;

class NextClient {
  public static setClient(
    clientLocal: Client | null,
    provider: { id: string },
  ) {
    globalObj._client = globalObj._client || {};

    globalObj._client[provider.id] = clientLocal;
  }
  static getClient(providerId: string): Client | null {
    globalObj._client = globalObj._client || {};

    return globalObj._client[providerId] || null;
  }

  public static setProviderMeta(providerId: string, meta: ProviderMeta): void {
    globalObj._providerMeta = globalObj._providerMeta || {};
    globalObj._providerMeta[providerId] = meta;
  }

  public static async getOrDiscoverClient(
    providerId: string,
  ): Promise<Client | null> {
    const cached = this.getClient(providerId);
    if (cached) return cached;

    const meta: ProviderMeta | undefined =
      globalObj._providerMeta?.[providerId];
    if (!meta) return null;

    try {
      const issuer = await Issuer.discover(meta.issuerUrl);
      const client = new issuer.Client({
        client_id: meta.clientId,
        client_secret: meta.clientSecret,
      });
      globalObj._client = globalObj._client || {};
      globalObj._client[providerId] = client;
      return client;
    } catch {
      return null;
    }
  }

  public static getRefreshToken(userId: string): RefreshToken | undefined {
    globalObj._refreshTokenMap = globalObj._refreshTokenMap || {};

    return globalObj._refreshTokenMap[userId];
  }

  public static setIsRefreshTokenStart(
    userId: string,
    refreshToken: RefreshToken,
  ): void {
    globalObj._refreshTokenMap = globalObj._refreshTokenMap || {};
    globalObj._refreshTokenMap[userId] = refreshToken;
  }

  /**
   * Resets the refreshing state for a user after a failed refresh attempt,
   * preserving the last known token so subsequent waiters can retry.
   */
  public static resetRefreshingState(userId: string): void {
    if (!globalObj._refreshTokenMap) return;
    const existing: RefreshToken | undefined =
      globalObj._refreshTokenMap[userId];
    if (existing) {
      globalObj._refreshTokenMap[userId] = {
        isRefreshing: false,
        token: existing.token,
      };
    }
  }

  public static delay(): Promise<undefined> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(undefined);
      }, 50);
    });
  }
}

export default NextClient;
