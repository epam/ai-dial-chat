import type { DialModel, DialModelListResponse } from '@epam/chat-shared';
import { get } from './base';

export const getModels = (): Promise<DialModelListResponse> =>
  get<DialModelListResponse>('/api/v1/models');

export const getModel = (modelName: string): Promise<DialModel> =>
  get<DialModel>(`/api/v1/models/${encodeURIComponent(modelName)}`);
