import {
  OPENAI_API_HOST,
  OPENAI_API_VERSION,
} from '../../constants/default-settings';
import { getApiHeaders } from './get-headers';

import fetch from 'node-fetch';

export async function getEntities<
  P extends 'model' | 'assistant' | 'application' | 'addon',
  T = any[],
>(type: P, jwt: string, jobTitle: string | undefined): Promise<T> {
  const url = `${OPENAI_API_HOST}/openai/${type}s?api-version=${OPENAI_API_VERSION}`;
  const errMsg = `Request for ${type}s returned an error`;
  const response = await fetch(url, {
    headers: getApiHeaders({ jwt, jobTitle }),
  }).catch((error) => {
    throw new Error(`${errMsg}: ${error.message}`);
  });

  if (response.status !== 200) {
    throw new Error(`${errMsg} ${response.status}: ${await response.text()}`);
  }

  const json = (await response.json()) as { data: T };
  return json.data;
}
