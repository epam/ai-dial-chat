import { Client } from 'openid-client';

class NextClient {
  public static set client(clientLocal: Client | null) {
    (globalThis as unknown as any)._client = clientLocal;
  }
  public static get client(): Client | null {
    return (globalThis as unknown as any)._client;
  }
}

export default NextClient;
