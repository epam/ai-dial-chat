import type {
  CreateToolsetBodyDto,
  DialToolsetDto,
  DialToolsetListResponseDto,
  MutatedToolsetDto,
  ResourceFoldersResponseDto,
  ResourceIdResponseDto,
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
  body: CreateToolsetBodyDto,
): Promise<MutatedToolsetDto> =>
  toolsetsApi.createToolset({ createToolsetBodyDto: body });

/** Lists one level of the caller's toolset folders; an empty `path` is the root. */
export const listToolsetFolders = (
  path: string,
): Promise<ResourceFoldersResponseDto> =>
  toolsetsApi.listToolsetFolders({ path });

/** Moves an own toolset into `folderPath`; resolves with its new id. */
export const moveToolset = (
  toolsetName: string,
  folderPath: string,
): Promise<ResourceIdResponseDto> =>
  toolsetsApi.moveToolset({ toolsetName, moveResourceDto: { folderPath } });

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
