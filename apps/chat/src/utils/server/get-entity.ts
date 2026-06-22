import { EntityType } from '@/src/types/common';
import { CoreAIEntity } from '@/src/types/models';

import { DIAL_API_HOST } from '@/src/constants/default-server-settings';

import { getApiHeaders } from './get-headers';

import fetch from 'node-fetch';

export async function getEntity(
  type: EntityType,
  reference: string,
  jwt: string,
  jobTitle: string,
): Promise<CoreAIEntity<EntityType.Model | EntityType.Application>> {
  const url = `${DIAL_API_HOST}/openai/${type}s/${encodeURIComponent(reference)}`;
  const errMsg = `Request for deployment "${reference}" returned an error`;

  const response = await fetch(url, {
    headers: getApiHeaders({ jwt, jobTitle }),
  }).catch((error) => {
    throw new Error(`${errMsg}: ${error.message}`);
  });

  if (response.status !== 200) {
    throw new Error(`${errMsg} ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<
    CoreAIEntity<EntityType.Model | EntityType.Application>
  >;
}
