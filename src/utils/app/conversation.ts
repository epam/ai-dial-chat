import { Conversation, Message, MessageSettings } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { OpenAIEntityAddon, OpenAIEntityModel } from '@/src/types/openai';

export const getAssitantModelId = (
  modelType: EntityType,
  defaultAssistantModelId: string,
  conversationAssistantModelId?: string,
): string | undefined => {
  return modelType === EntityType.Assistant
    ? conversationAssistantModelId ?? defaultAssistantModelId
    : undefined;
};

export const getSelectedAddons = (
  selectedAddons: string[],
  addonsMap: Partial<Record<string, OpenAIEntityAddon>>,
  model?: OpenAIEntityModel,
) => {
  if (model && model.type !== EntityType.Application) {
    const preselectedAddons = model.selectedAddons ?? [];
    const addonsSet = new Set([...preselectedAddons, ...selectedAddons]);
    const mergedSelectedAddons = Array.from(addonsSet)
      .map((addon) => addonsMap[addon])
      .filter(Boolean) as OpenAIEntityAddon[];
    return mergedSelectedAddons;
  }
  return null;
};

export const isSettingsChanged = (
  conversation: Conversation,
  newSettings: MessageSettings,
) => {
  const isChanged = Object.keys(newSettings).some((key) => {
    const convSetting = conversation[key as keyof Conversation];
    const newSetting = newSettings[key as keyof MessageSettings];

    if (Array.isArray(convSetting) && Array.isArray(newSetting)) {
      if (convSetting.length !== newSetting.length) {
        return true;
      }

      const sortedConvSetting = [...convSetting].sort();
      const sortedNewSetting = [...newSetting].sort();

      const isArraysEqual: boolean = sortedConvSetting.every(
        (value, index) => value === sortedNewSetting[index],
      );
      return !isArraysEqual;
    }

    return (
      conversation[key as keyof Conversation] !==
      newSettings[key as keyof MessageSettings]
    );
  });

  return isChanged;
};

export const getNewConversationName = (
  conversation: Conversation,
  message: Message,
  updatedMessages: Message[],
) => {
  if (
    conversation.replay.isReplay ||
    updatedMessages.length !== 2 ||
    conversation.isNameChanged
  ) {
    return conversation.name;
  }
  const content = message.content.trim();
  if (content.length > 0) {
    return content.length > 160 ? content.substring(0, 160) + '...' : content;
  } else if (message.custom_content?.attachments?.length) {
    const files = message.custom_content.attachments;
    return files[0].title;
  }

  return conversation.name;
};
