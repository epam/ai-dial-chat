import { EntityType } from '@/src/types/common';

import {
  DIAL_API_HOST,
  DIAL_API_VERSION,
} from '../../constants/default-server-settings';

import { getApiHeaders } from './get-headers';

import fetch from 'node-fetch';

export async function getEntities<T>(
  type: EntityType,
  jwt: string,
  jobTitle: string | undefined,
): Promise<T> {
  const url = `${DIAL_API_HOST}/openai/${type}s?api-version=${DIAL_API_VERSION}`;
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
