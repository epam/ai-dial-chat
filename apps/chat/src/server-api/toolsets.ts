import type {
  DialToolsetDto,
  DialToolsetListResponseDto,
} from '@epam/chat-api-client';
import { toolsetsApi } from './api-client';

export const listToolsets = (): Promise<DialToolsetListResponseDto> =>
  toolsetsApi.listToolsets();

export const getToolset = (toolsetName: string): Promise<DialToolsetDto> =>
  toolsetsApi.getToolset({ toolsetName });
