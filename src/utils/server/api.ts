export enum ApiKeys {
  Files = 'files',
  Conversations = 'conversations',
  Prompts = 'prompts',
}

export const isValidEntityApiType = (apiKey: string) => {
  return Object.values(ApiKeys).includes(apiKey as ApiKeys);
};
