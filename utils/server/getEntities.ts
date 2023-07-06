import { OpenAIEntityType } from '@/types/openai';

import { OPENAI_API_HOST, OPENAI_API_VERSION } from '../app/const';
import { getHeaders } from './getHeaders';

export async function getEntities(
  type: OpenAIEntityType,
  key: string,
): Promise<any[]> {
  const url = `${OPENAI_API_HOST}/openai/${type}s?api-version=${OPENAI_API_VERSION}`;
  const errMsg = `Request for ${type}s returned an error`;
  const apiKey = key ? key : process.env.OPENAI_API_KEY;

  const response = await fetch(url, {
    headers: {
      ...(apiKey && getHeaders(apiKey)),
    },
  }).catch((error) => {
    throw new Error(`${errMsg}: ${error.message}`);
  });

  if (response.status !== 200) {
    throw new Error(`${errMsg} ${response.status}: ${await response.text()}`);
  }

  const json = await response.json();
  return json.data;
}
