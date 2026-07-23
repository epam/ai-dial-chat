import { isAbsoluteUrl } from '@/src/utils/app/file';
import { mergeFeatures } from '@/src/utils/app/models';

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
import { NA_VERSION } from '@/src/constants/publication';

import { ApiUtils, parseEntityApiKey } from './api';

import { TiktokenEncoding } from 'tiktoken';

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

const fixDate = (date: number) => (date === 1672534800 ? 1740006000000 : date);

export function mapCoreEntityToDialModel(
  entity: CoreAIEntity<EntityType.Model | EntityType.Application>,
  isDefault: boolean,
): DialAIEntityModel {
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
  const id = ApiUtils.decodeApiUrl(entity.id);
  const { version: parsedVersion } = parseEntityApiKey(id, {
    parseVersion: true,
  });

  return {
    id: ApiUtils.decodeApiUrl(entity.id),
    reference: entity.reference,
    name: entity.display_name ?? entity.id,
    isDefault,
    version:
      entity.display_version ??
      (parsedVersion === NA_VERSION ? undefined : parsedVersion),
    description: entity.description,
    updatedAt: fixDate(entity.updated_at),
    createdAt: fixDate(entity.created_at),
    owner: entity.owner,
    iconUrl:
      entity.icon_url && !isAbsoluteUrl(entity.icon_url)
        ? ApiUtils.decodeApiUrl(entity.icon_url)
        : entity.icon_url,
    type: entity.object,
    topics: entity.description_keywords,
    applicationTypeSchemaId: entity.application_type_schema_id,
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
    features: mergeFeatures(entity.features),
    inputAttachmentTypes: entity.input_attachment_types,
    maxInputAttachments: entity.max_input_attachments,
    tokenizer: entity.tokenizer_model && {
      encoding: getTiktokenEncoding(entity.tokenizer_model),
      tokensPerMessage: getTokensPerMessage(entity.tokenizer_model),
    },
    ...(entity.function && {
      functionStatus: entity.function?.status,
    }),
    ...(entity.viewer_url && { viewerUrl: entity.viewer_url }),
    ...(entity.editor_url && { editorUrl: entity.editor_url }),
    ...(entity.mcp && { mcp: entity.mcp }),
  };
}
