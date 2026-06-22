import { ApplicationStatus } from '@/src/types/applications';
import { EntityType } from '@/src/types/common';
import {
  DialAIEntity,
  DialAIEntityFeatures,
  DialAIEntityModel,
  ModelsMap,
} from '@/src/types/models';
import { ToolsetModel } from '@/src/types/toolsets';

import { Conversation, Role } from '@epam/ai-dial-shared';

export const doesModelAllowSystemPrompt = (
  model: DialAIEntityModel | undefined,
) => !!model?.features?.systemPrompt;

export const doesModelAllowTemperature = (
  model: DialAIEntityModel | undefined,
) => !!model?.features?.temperature;

export const doesModelHaveSettings = (model: DialAIEntityModel | undefined) => {
  return (
    model &&
    model.type !== EntityType.Application && // custom settings in future
    (doesModelAllowSystemPrompt(model) || doesModelAllowTemperature(model))
  );
};

export const doesModelHaveConfiguration = (model?: DialAIEntity): boolean => {
  return !!model?.features?.configuration;
};

export const checkIsNotAllowedModelUtil = (
  conv: Conversation,
  modelsMap: ModelsMap,
): boolean => {
  if (
    !!conv.replay?.isReplay &&
    conv.replay?.replayAsIs &&
    conv.replay?.replayUserMessagesStack &&
    conv.replay.replayUserMessagesStack.length > 0 &&
    conv.replay.replayUserMessagesStack[0].model
  ) {
    return conv.replay.replayUserMessagesStack.some(
      (message) =>
        message.role === Role.User &&
        message.model?.id &&
        !modelsMap[message.model.id],
    );
  }

  if (!conv.model || !conv.model.id) {
    return true;
  }

  const modelInMap = modelsMap[conv.model.id];

  if (!modelInMap) {
    return true;
  }

  const isNotDeployedCustomApp =
    modelInMap.type === EntityType.Application &&
    modelInMap.functionStatus &&
    modelInMap.functionStatus !== ApplicationStatus.DEPLOYED;

  if (isNotDeployedCustomApp) {
    return true;
  }

  return false;
};

export const mergeFeatures = (
  features: Record<string, boolean | undefined> | undefined,
): DialAIEntityFeatures => {
  const {
    system_prompt: systemPrompt = true,
    temperature = true,
    truncate_prompt: truncatePrompt = false,
    url_attachments: urlAttachments = false,
    folder_attachments: folderAttachments = false,
    allow_resume: allowResume = true,
    configuration = false,
    tools = true,
    assistant_attachments_in_request: assistantAttachmentsInRequest = false,
    mcp = false,
    chat_completion = true,
    responses_api = false,
    ...otherFeatures
  } = features || {};
  return {
    systemPrompt,
    temperature,
    truncatePrompt,
    urlAttachments,
    folderAttachments,
    allowResume,
    configuration,
    tools,
    assistantAttachmentsInRequest,
    mcp,
    chat_completion,
    responses_api,
    ...otherFeatures,
  };
};

export const filterHiddenEntities = <
  T extends DialAIEntityModel | ToolsetModel,
>(
  entities: T[],
  hiddenEntityTag?: string,
): T[] => {
  return entities.filter(
    (entity) => !entity.topics?.some((topic) => topic === hiddenEntityTag),
  );
};

export const shouldShowHiddenEntities = (
  hiddenEntityTag?: string,
  showHidden?: boolean,
) => !hiddenEntityTag || !hiddenEntityTag.length || showHidden;

export const doesAgentSupportMcp = (
  entity?: DialAIEntityModel,
): entity is DialAIEntityModel => !!entity?.mcp || !!entity?.features?.mcp;

export const doesAgentHaveChatCompletion = (
  entity?: DialAIEntityModel,
): entity is DialAIEntityModel => !!entity?.features?.chat_completion;
