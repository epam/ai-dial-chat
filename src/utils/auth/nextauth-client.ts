import { Client } from 'openid-client';

export interface RefreshToken {
  isRefreshing: boolean;
  token: any | undefined;
}

const globalObj = globalThis as unknown as any;

class NextClient {
  public static setClient(
    clientLocal: Client | null,
    provider: { id: string },
  ) {
    globalObj._client = globalObj._client || {};

    globalObj._client[provider.id] = clientLocal;
  }
  public static getClient(providerId: string): Client | null {
    return globalObj._client[providerId] || null;
  }

  public static getRefreshToken(userId: string): RefreshToken | undefined {
    globalObj._refreshTokenMap = globalObj._refreshTokenMap || {};

    return globalObj._refreshTokenMap[userId];
  }
  public static setIsRefreshTokenStart(
    userId: string,
    refreshToken: RefreshToken,
  ): void {
    globalObj._refreshTokenMap[userId] = refreshToken;
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
