import { ApplicationStatus } from '@/src/types/applications';
import { EntityType } from '@/src/types/common';
import {
  DialAIEntity,
  DialAIEntityFeatures,
  DialAIEntityModel,
  ModelsMap,
} from '@/src/types/models';

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
  features: Record<string, boolean | undefined>,
): DialAIEntityFeatures => {
  const {
    system_prompt: systemPrompt = true,
    temperature = true,
    truncate_prompt: truncatePrompt = false,
    url_attachments: urlAttachments = false,
    folder_attachments: folderAttachments = false,
    allow_resume: allowResume = true,
    configuration = false,
    toolsSupported = true,
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
    toolsSupported,
    ...otherFeatures,
  };
};
