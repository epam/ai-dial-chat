import { JWT } from 'next-auth/jwt';

import { EntityType } from '@/src/types/common';
import {
  CoreAIEntity,
  DialAIEntityModel,
  TokenizerModel,
} from '@/src/types/models';

import {
  DEFAULT_MODEL_ID,
  MAX_PROMPT_TOKENS_DEFAULT_PERCENT,
  MAX_PROMPT_TOKENS_DEFAULT_VALUE,
} from '@/src/constants/default-server-settings';

import { isAbsoluteUrl } from '../app/file';
import { ApiUtils } from './api';
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

async function getAllEntities(accessToken: string, jobTitle: string) {
  const [modelsResult, applicationsResult, assistantsResult] =
    await Promise.allSettled([
      getEntities<CoreAIEntity<EntityType.Model>[]>(
        EntityType.Model,
        accessToken,
        jobTitle,
      ),
      getEntities<CoreAIEntity<EntityType.Application>[]>(
        EntityType.Application,
        accessToken,
        jobTitle,
      ),
      getEntities<CoreAIEntity<EntityType.Assistant>[]>(
        EntityType.Assistant,
        accessToken,
        jobTitle,
      ),
    ]);

  const models: CoreAIEntity<EntityType.Model>[] =
    modelsResult.status === 'fulfilled'
      ? modelsResult.value
      : (logger.error(modelsResult.reason), []);

  const applications: CoreAIEntity<EntityType.Application>[] =
    applicationsResult.status === 'fulfilled'
      ? applicationsResult.value
      : (logger.error(applicationsResult.reason), []);

  const assistants: CoreAIEntity<EntityType.Assistant>[] =
    assistantsResult.status === 'fulfilled'
      ? assistantsResult.value
      : (logger.error(assistantsResult.reason), []);

  return { models, applications, assistants };
}

export const getSortedEntities = async (token: JWT | null) => {
  const entities: DialAIEntityModel[] = [];
  const accessToken = token?.access_token as string;
  const jobTitle = token?.jobTitle as string;
  const { models, applications, assistants } = await getAllEntities(
    accessToken,
    jobTitle,
  );

  const preProcessedEntities = [...models, ...applications, ...assistants];
  let defaultModelId = preProcessedEntities.find(
    (model) => model.id === DEFAULT_MODEL_ID,
  )?.id;

  for (const entity of [...models, ...applications, ...assistants]) {
    if (
      entity.capabilities?.embeddings ||
      (entity.object === EntityType.Model &&
        entity.capabilities?.chat_completion !== true)
    ) {
      continue;
    }

    if (!defaultModelId) {
      logger.warn(
        undefined,
        `Cannot find default model id("${DEFAULT_MODEL_ID}") in models listing. Recheck config for models in Core or change default model id to existing model.`,
      );
      defaultModelId = entity.id;
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
      id: ApiUtils.decodeApiUrl(entity.id),
      reference: entity.reference,
      name: entity.display_name ?? entity.id,
      isDefault: defaultModelId === entity.id,
      version: entity.display_version,
      description: entity.description,
      iconUrl:
        entity.icon_url && !isAbsoluteUrl(entity.icon_url)
          ? ApiUtils.decodeApiUrl(entity.icon_url)
          : entity.icon_url,
      type: entity.object,
      selectedAddons: entity.addons,
      topics: entity.description_keywords,
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
        systemPrompt: entity.features.system_prompt ?? false,
        truncatePrompt: entity.features.truncate_prompt ?? false,
        urlAttachments: entity.features.url_attachments ?? false,
        folderAttachments: entity.features.folder_attachments ?? false,
        allowResume: entity.features.allow_resume ?? true,
      },
      inputAttachmentTypes: entity.input_attachment_types,
      maxInputAttachments: entity.max_input_attachments,
      tokenizer: entity.tokenizer_model && {
        encoding: getTiktokenEncoding(entity.tokenizer_model),
        tokensPerMessage: getTokensPerMessage(entity.tokenizer_model),
      },
      ...(entity.function && {
        functionStatus: entity.function?.status,
      }),
    });
  }

  return entities;
};
