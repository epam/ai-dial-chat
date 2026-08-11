import type {
  DialModelDto,
  DialModelListResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { modelsApi } from './api-client';

export const getModels = (): Promise<DialModelListResponseDto> =>
  modelsApi.listModels();

export const getModel = (modelName: string): Promise<DialModelDto> =>
  modelsApi.getModel({ modelName });
