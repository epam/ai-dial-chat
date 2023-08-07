import { OPENAI_API_HOST, OPENAI_API_VERSION } from '../app/const';
import { getApiHeaders } from './getHeaders';

import fetch from 'node-fetch';

export async function getEntities<T = any[]>(
  type: string,
  key: string,
): Promise<T> {
  const url = `${OPENAI_API_HOST}/openai/${type}s?api-version=${OPENAI_API_VERSION}`;
  const errMsg = `Request for ${type}s returned an error`;
  const apiKey = key ? key : process.env.OPENAI_API_KEY;
  const response = await fetch(url, {
    headers: {
      ...(apiKey && getApiHeaders(apiKey)),
    },
  }).catch((error) => {
    throw new Error(`${errMsg}: ${error.message}`);
  });

  if (response.status !== 200) {
    throw new Error(`${errMsg} ${response.status}: ${await response.text()}`);
  }

  const json = (await response.json()) as { data: T };
  return json.data;
}
