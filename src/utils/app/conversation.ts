import {
  OpenAIEntityAddon,
  OpenAIEntityApplicationType,
  OpenAIEntityAssistantType,
  OpenAIEntityModel,
  OpenAIEntityModelType,
} from '@/src/types/openai';

export const getAssitantModelId = (
  modelType:
    | OpenAIEntityModelType
    | OpenAIEntityApplicationType
    | OpenAIEntityAssistantType,
  defaultAssistantModelId: string,
  conversationAssistantModelId?: string,
): string | undefined => {
  return modelType === 'assistant'
    ? conversationAssistantModelId ?? defaultAssistantModelId
    : undefined;
};

export const getSelectedAddons = (
  selectedAddons: string[],
  addonsMap: Partial<Record<string, OpenAIEntityAddon>>,
  model?: OpenAIEntityModel,
) => {
  if (model && model.type !== 'application') {
    const preselectedAddons = model.selectedAddons ?? [];
    const addonsSet = new Set([...preselectedAddons, ...selectedAddons]);
    const mergedSelectedAddons = Array.from(addonsSet)
      .map((addon) => addonsMap[addon])
      .filter(Boolean) as OpenAIEntityAddon[];
    return mergedSelectedAddons;
  }
  return null;
};
