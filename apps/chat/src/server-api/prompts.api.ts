import type {
  CreatePromptDto,
  CreatePromptFolderDto,
  MovePromptDto,
  PromptFolderResponseDto,
  PromptListResponseDto,
  PromptResponseDto,
  PublicPromptListResponseDto,
  RenamePromptFolderDto,
  UpdatePromptDto,
} from '@epam/ai-dial-chat-api-client';
import { promptsApi } from './api-client';

/* ------------------------------------------------------------------ */
/* Personal prompts                                                     */
/* ------------------------------------------------------------------ */

export const listPrompts = (): Promise<PromptListResponseDto> =>
  promptsApi.listPrompts();

/**
 * `id` is the full `prompts/{bucket}/{path}` resource path — the caller's own
 * bucket for a personal prompt, or the owner bucket for a prompt shared with
 * the caller. DIAL Core authorises the read either way.
 */
export const getPrompt = (id: string): Promise<PromptResponseDto> =>
  promptsApi.getPrompt({ id });

export const createPrompt = (
  body: CreatePromptDto,
): Promise<PromptResponseDto> =>
  promptsApi.createPrompt({ createPromptDto: body });

export const updatePrompt = (
  id: string,
  body: UpdatePromptDto,
): Promise<PromptResponseDto> =>
  promptsApi.updatePrompt({ id, updatePromptDto: body });

export const deletePrompt = (id: string): Promise<void> =>
  promptsApi.deletePrompt({ id });

export const movePrompt = (
  id: string,
  body: MovePromptDto,
): Promise<PromptResponseDto> =>
  promptsApi.movePrompt({ id, movePromptDto: body });

/* ------------------------------------------------------------------ */
/* Organisation (public) prompts                                        */
/* ------------------------------------------------------------------ */

export const listPublicPrompts = (): Promise<PublicPromptListResponseDto> =>
  promptsApi.listPublicPrompts();

export const getPublicPrompt = (path: string): Promise<PromptResponseDto> =>
  promptsApi.getPublicPrompt({ path });

/* ------------------------------------------------------------------ */
/* Folders                                                              */
/* ------------------------------------------------------------------ */

export const createPromptFolder = (
  body: CreatePromptFolderDto,
): Promise<PromptFolderResponseDto> =>
  promptsApi.createPromptFolder({ createPromptFolderDto: body });

export const renamePromptFolder = (
  path: string,
  body: RenamePromptFolderDto,
): Promise<PromptFolderResponseDto> =>
  promptsApi.renamePromptFolder({ path, renamePromptFolderDto: body });

export const deletePromptFolder = (path: string): Promise<void> =>
  promptsApi.deletePromptFolder({ path });
