import type {
  DialToolsetDto,
  DialToolsetListResponseDto,
  MutatedToolsetDto,
  ToolsetAuthResultDto,
  ToolsetBodyDto,
  ToolsetLoginBodyDto,
  ToolsetLogoutBodyDto,
} from '@epam/ai-dial-chat-api-client';
import { toolsetsApi } from './api-client';

export const listToolsets = (): Promise<DialToolsetListResponseDto> =>
  toolsetsApi.listToolsets();

export const getToolset = (toolsetName: string): Promise<DialToolsetDto> =>
  toolsetsApi.getToolset({ toolsetName });

export const createToolset = (
  body: ToolsetBodyDto,
): Promise<MutatedToolsetDto> =>
  toolsetsApi.createToolset({ toolsetBodyDto: body });

export const updateToolset = (
  toolsetName: string,
  body: ToolsetBodyDto,
): Promise<MutatedToolsetDto> =>
  toolsetsApi.updateToolset({ toolsetName, toolsetBodyDto: body });

export const deleteToolset = (toolsetName: string): Promise<void> =>
  toolsetsApi.deleteToolset({ toolsetName });

export const loginToolset = (
  toolsetName: string,
  body: ToolsetLoginBodyDto,
): Promise<ToolsetAuthResultDto> =>
  toolsetsApi.loginToolset({ toolsetName, toolsetLoginBodyDto: body });

export const logoutToolset = (
  toolsetName: string,
  body: ToolsetLogoutBodyDto,
): Promise<ToolsetAuthResultDto> =>
  toolsetsApi.logoutToolset({ toolsetName, toolsetLogoutBodyDto: body });
