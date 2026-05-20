import type {
  DialModel,
  DialModelListResponse,
} from '@epam/ai-dial-chat-shared';
import { ApiEndpoints, get } from './base';

export const getModels = (): Promise<DialModelListResponse> =>
  get<DialModelListResponse>(ApiEndpoints.MODELS);

export const getModel = (modelName: string): Promise<DialModel> =>
  get<DialModel>(`${ApiEndpoints.MODELS}/${encodeURIComponent(modelName)}`);
