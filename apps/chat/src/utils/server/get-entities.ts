import { EntityType } from '@/src/types/common';

import {
  DIAL_API_HOST,
  DIAL_API_VERSION,
} from '@/src/constants/default-server-settings';

import { getApiHeaders } from './get-headers';

import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import fetch from 'node-fetch';

// Singleton keep-alive agents so sockets to DIAL Core are pooled and reused
// across requests, removing per-request TCP/TLS handshake overhead.
const httpAgent = new HttpAgent({ keepAlive: true });
const httpsAgent = new HttpsAgent({ keepAlive: true });

const selectKeepAliveAgent = (parsedUrl: { protocol: string }) =>
  parsedUrl.protocol === 'https:' ? httpsAgent : httpAgent;

export async function getEntities<T>(
  type: EntityType,
  jwt: string,
  jobTitle: string,
): Promise<T> {
  const url = `${DIAL_API_HOST}/openai/${type}s?api-version=${DIAL_API_VERSION}`;
  const errMsg = `Request for ${type}s returned an error`;
  const response = await fetch(url, {
    headers: getApiHeaders({ jwt, jobTitle }),
    agent: selectKeepAliveAgent,
  }).catch((error) => {
    throw new Error(`${errMsg}: ${error.message}`);
  });

  if (response.status !== 200) {
    throw new Error(`${errMsg} ${response.status}: ${await response.text()}`);
  }

  const json = (await response.json()) as { data: T };
  return json.data;
}
