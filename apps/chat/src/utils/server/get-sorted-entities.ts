import { JWT } from 'next-auth/jwt';

import { EntityType } from '@/src/types/common';
import {
  CoreAIEntity,
  DialAIEntityModel,
  TokenizerModel,
} from '@/src/types/models';

import {
  MAX_PROMPT_TOKENS_DEFAULT_PERCENT,
  MAX_PROMPT_TOKENS_DEFAULT_VALUE,
} from '@/src/constants/default-server-settings';

import { getEntities } from './get-entities';
import { logger } from './logger';

import { TiktokenEncoding } from '@dqbd/tiktoken';

const getTiktokenEncoding = (
  tokenizerModel: TokenizerModel,
): TiktokenEncoding | undefined => {
  switch (tokenizerModel) {
    case TokenizerModel.GPT_35_TURBO_0301:
    case TokenizerModel.GPT_4_0314:
      return 'cl100k_base';
    default:
      return undefined;
  }
};

const getTokensPerMessage = (
  tokenizerModel: TokenizerModel,
): number | undefined => {
  switch (tokenizerModel) {
    case TokenizerModel.GPT_35_TURBO_0301:
      return 4;
    case TokenizerModel.GPT_4_0314:
      return 3;
    default:
      return undefined;
  }
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

  const preProcessedEntities = [...models, ...applications, ...assistants];
  const defaultModelId =
    preProcessedEntities.find((model) => model.id === process.env.DEFAULT_MODEL)
      ?.id || preProcessedEntities[0].id;

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
      const resTotalTokens = entity.limits?.max_total_tokens;
      const resPromptTokens = entity.limits?.max_prompt_tokens;
      const resCompletionTokens = entity.limits?.max_completion_tokens;

      maxTotalTokens =
        resTotalTokens ??
        (resPromptTokens && resCompletionTokens
          ? resPromptTokens + resCompletionTokens
          : undefined);

      maxResponseTokens =
        resCompletionTokens ??
        (maxTotalTokens
          ? Math.min(
              MAX_PROMPT_TOKENS_DEFAULT_VALUE,
              Math.floor(
                (MAX_PROMPT_TOKENS_DEFAULT_PERCENT * maxTotalTokens) / 100,
              ),
            )
          : undefined);

      maxRequestTokens =
        resPromptTokens ??
        (maxTotalTokens && maxResponseTokens
          ? maxTotalTokens - maxResponseTokens
          : undefined);
    }

    entities.push({
      id: entity.id,
      name: entity.display_name ?? entity.id,
      isDefault: defaultModelId === entity.id,
      version: entity.display_version,
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
              isMaxRequestTokensCustom:
                typeof entity.limits?.max_prompt_tokens === 'undefined',
            }
          : undefined,
      features: entity.features && {
        systemPrompt: entity.features?.system_prompt || false,
        truncatePrompt: entity.features?.truncate_prompt || false,
      },
      inputAttachmentTypes: entity.input_attachment_types,
      maxInputAttachments: entity.max_input_attachments,
      tokenizer: entity.tokenizer_model && {
        encoding: getTiktokenEncoding(entity.tokenizer_model),
        tokensPerMessage: getTokensPerMessage(entity.tokenizer_model),
      },
    });
  }

  return entities;
};
