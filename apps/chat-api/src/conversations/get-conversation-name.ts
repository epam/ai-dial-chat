import { prepareEntityName } from './prepare-entity-name';

export const getConversationName = (defaultName: string, prompt?: string) => {
  return prepareEntityName(prompt) || prepareEntityName(defaultName);
};
