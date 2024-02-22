import { JWT } from 'next-auth/jwt';

import { EntityType } from '@/src/types/common';
import { CoreAIEntity, DialAIEntityModel } from '@/src/types/openai';

import { getEntities } from './get-entities';
import { logger } from './logger';

const getPromptTokens = (
  currentTokensValue: number | undefined,
  tokens2: number | undefined,
  totalTokens: number | undefined,
  partOfTotalTokens: number,
): number | undefined => {
  if (currentTokensValue) {
    return currentTokensValue;
  }

  if (tokens2 && totalTokens) {
    return totalTokens - tokens2;
  }

  if (totalTokens) {
    return Math.floor(totalTokens * partOfTotalTokens);
  }

  return undefined;
};

export const getSortedEntities = async (token: JWT | null) => {
  const entities: DialAIEntityModel[] = [];
  const accessToken = token?.access_token as string;
  const jobTitle = token?.jobTitle as string;
  const models = await getEntities<CoreAIEntity<EntityType.Model>[]>(
    EntityType.Model,
    accessToken,
    jobTitle,
  ).catch((error) => {
    logger.error(error.message);
    return [];
  });

  const applications = await getEntities<
    CoreAIEntity<EntityType.Application>[]
  >(EntityType.Application, accessToken, jobTitle).catch((error) => {
    logger.error(error.message);
    return [];
  });
  const assistants = await getEntities<CoreAIEntity<EntityType.Assistant>[]>(
    EntityType.Assistant,
    accessToken,
    jobTitle,
  ).catch((error) => {
    logger.error(error.message);
    return [];
  });

  for (const entity of [...models, ...applications, ...assistants]) {
    if (
      entity.capabilities?.embeddings ||
      (entity.object === EntityType.Model &&
        entity.capabilities?.chat_completion !== true)
    ) {
      continue;
    }

    let maxRequestTokens;
    let maxResponseTokens;
    let maxTotalTokens;

    if (entity.object === EntityType.Model) {
      maxRequestTokens = getPromptTokens(
        entity.limits?.max_prompt_tokens,
        entity.limits?.max_completion_tokens,
        entity.limits?.max_total_tokens,
        3 / 4,
      );
      maxResponseTokens = getPromptTokens(
        entity.limits?.max_completion_tokens,
        entity.limits?.max_prompt_tokens,
        entity.limits?.max_total_tokens,
        1 / 4,
      );
      maxTotalTokens =
        entity.limits?.max_total_tokens ??
        (maxResponseTokens && maxRequestTokens
          ? maxResponseTokens + maxRequestTokens
          : undefined);
    }

    entities.push({
      id: entity.id,
      name: entity.display_name ?? entity.id,
      description: entity.description,
      iconUrl: entity.icon_url,
      type: entity.object,
      selectedAddons: entity.addons,
      limits:
        maxRequestTokens && maxResponseTokens && maxTotalTokens
          ? {
              maxRequestTokens,
              maxResponseTokens,
              maxTotalTokens,
            }
          : undefined,
      inputAttachmentTypes: entity.input_attachment_types,
      maxInputAttachments: entity.max_input_attachments,
    });
  }

  return entities;
};
