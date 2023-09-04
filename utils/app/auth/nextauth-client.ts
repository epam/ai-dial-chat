import { Client } from 'openid-client';

class NextClient {
  private static _client: Client | null = null;
  public static set client(clientLocal: Client | null) {
    NextClient._client = clientLocal;
  }
  public static get client(): Client | null {
    return NextClient._client;
  }
}

export default NextClient;
