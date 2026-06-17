import { EntityType } from '@/src/types/common';
import { CoreAIEntity, DialAIEntityModel } from '@/src/types/models';

import { DEFAULT_MODEL_ID } from '@/src/constants/default-server-settings';

import { getEntities } from './get-entities';
import { logger } from './logger';
import { mapCoreEntityToDialModel } from './map-core-entity';

interface UpstreamTimings {
  modelsMs: number;
  applicationsMs: number;
  bothAwaitMs: number;
}

async function getAllEntities(accessToken: string, jobTitle: string) {
  const timings: UpstreamTimings = {
    modelsMs: 0,
    applicationsMs: 0,
    bothAwaitMs: 0,
  };

  const measure =
    (key: keyof Omit<UpstreamTimings, 'bothAwaitMs'>) =>
    async <T>(factory: () => Promise<T>): Promise<T> => {
      const start = performance.now();
      try {
        return await factory();
      } finally {
        timings[key] = performance.now() - start;
      }
    };

  const bothStart = performance.now();
  const [modelsResult, applicationsResult] = await Promise.allSettled([
    measure('modelsMs')(() =>
      getEntities<CoreAIEntity<EntityType.Model>[]>(
        EntityType.Model,
        accessToken,
        jobTitle,
      ),
    ),
    measure('applicationsMs')(() =>
      getEntities<CoreAIEntity<EntityType.Application>[]>(
        EntityType.Application,
        accessToken,
        jobTitle,
      ),
    ),
  ]);
  timings.bothAwaitMs = performance.now() - bothStart;

  const models: CoreAIEntity<EntityType.Model>[] =
    modelsResult.status === 'fulfilled'
      ? modelsResult.value
      : (logger.error(modelsResult.reason), []);

  const applications: CoreAIEntity<EntityType.Application>[] =
    applicationsResult.status === 'fulfilled'
      ? applicationsResult.value
      : (logger.error(applicationsResult.reason), []);

  return { models, applications, timings };
}

export const getSortedEntities = async (
  accessToken: string,
  jobTitle: string,
) => {
  const totalStart = performance.now();
  const entities: DialAIEntityModel[] = [];
  const { models, applications, timings } = await getAllEntities(
    accessToken,
    jobTitle,
  );

  const transformStart = performance.now();
  const preProcessedEntities = [...models, ...applications];
  let defaultModelReference = preProcessedEntities.find(
    (model) =>
      model.reference === DEFAULT_MODEL_ID || model.id === DEFAULT_MODEL_ID,
  )?.reference;

  for (const entity of preProcessedEntities) {
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

  const responseTimings = {
    ...timings,
    transformMs,
    totalMs,
  };

  logger.info(
    {
      ...responseTimings,
      modelsCount: models.length,
      applicationsCount: applications.length,
    },
    'getSortedEntities timing',
  );

  return { entities, timings: responseTimings };
};
