import { OpenAIEntityModel } from './openai';

export type ModelsMap = Partial<Record<string, OpenAIEntityModel>>;

export const enum ModelsListingStatuses {
  UNINITIALIZED = 'UNINITIALIZED',
  LOADING = 'LOADING',
  LOADED = 'LOADED',
}
