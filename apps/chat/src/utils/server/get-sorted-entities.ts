import { EntityType } from '@/src/types/common';
import { CoreAIEntity, DialAIEntityModel } from '@/src/types/models';

import {
  DEFAULT_MODEL_ID,
  DIAL_API_HOST,
} from '@/src/constants/default-server-settings';

import { getApiHeaders } from './get-headers';
import { logger } from './logger';
import { mapCoreEntityToDialModel } from './map-core-entity';

import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import fetch from 'node-fetch';

const httpAgent = new HttpAgent({ keepAlive: true });
const httpsAgent = new HttpsAgent({ keepAlive: true });

const selectKeepAliveAgent = (parsedUrl: { protocol: string }) =>
  parsedUrl.protocol === 'https:' ? httpsAgent : httpAgent;

async function getDeployments(accessToken: string, jobTitle: string) {
  const start = performance.now();
  // TODO: add ?interface_type=chat once the backend filter is fixed
  const url = `${DIAL_API_HOST}/v1/deployments`;
  const errMsg = 'Request for deployments returned an error';
  const response = await fetch(url, {
    headers: getApiHeaders({ jwt: accessToken, jobTitle }),
    agent: selectKeepAliveAgent,
  }).catch((error) => {
    throw new Error(`${errMsg}: ${error.message}`);
  });

  if (response.status !== 200) {
    throw new Error(`${errMsg} ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as Array<
    CoreAIEntity<EntityType.Model | EntityType.Application | EntityType.Toolset>
  >;
  // TODO: remove filter once backend supports object-type or interface_type filtering
  const deployments = data.filter(
    (e): e is CoreAIEntity<EntityType.Model | EntityType.Application> =>
      e.object !== EntityType.Toolset,
  );
  return { deployments, deploymentsMs: performance.now() - start };
}

export const getSortedEntities = async (
  accessToken: string,
  jobTitle: string,
) => {
  const totalStart = performance.now();
  const entities: DialAIEntityModel[] = [];

  let deployments: Array<
    CoreAIEntity<EntityType.Model> | CoreAIEntity<EntityType.Application>
  > = [];
  let deploymentsMs = 0;

  try {
    const result = await getDeployments(accessToken, jobTitle);
    deployments = result.deployments;
    deploymentsMs = result.deploymentsMs;
  } catch (error) {
    logger.error(error);
  }

  const transformStart = performance.now();
  let defaultModelReference = deployments.find(
    (model) =>
      model.reference === DEFAULT_MODEL_ID || model.id === DEFAULT_MODEL_ID,
  )?.reference;

  for (const entity of deployments) {
    if (
      entity.capabilities?.embeddings ||
      (entity.object === EntityType.Model &&
        entity.capabilities?.chat_completion !== true)
    ) {
      continue;
    }

    if (!defaultModelReference) {
      logger.warn(
        undefined,
        `Cannot find default model id("${DEFAULT_MODEL_ID}") in models listing. Recheck config for models in Core or change default model id to existing model.`,
      );
      defaultModelReference = entity.reference;
    }

    entities.push(
      mapCoreEntityToDialModel(
        entity,
        defaultModelReference === entity.reference,
      ),
    );
  }

  const transformMs = performance.now() - transformStart;
  const totalMs = performance.now() - totalStart;

  const timings = {
    deploymentsMs,
    transformMs,
    totalMs,
  };

  logger.info(
    {
      ...timings,
      modelsCount: deployments.filter((e) => e.object === EntityType.Model)
        .length,
      applicationsCount: deployments.filter(
        (e) => e.object === EntityType.Application,
      ).length,
    },
    'getSortedEntities timing',
  );

  return { entities, timings };
};
