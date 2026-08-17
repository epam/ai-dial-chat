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
 * Reads a prompt from `bucket`, defaulting to the caller's own bucket. Pass the
 * owner bucket to read a prompt shared with the caller — a bare path would
 * resolve against the caller's bucket instead.
 */
export const getPrompt = (
  path: string,
  bucket?: string,
): Promise<PromptResponseDto> => promptsApi.getPrompt({ path, bucket });

export const createPrompt = (
  body: CreatePromptDto,
): Promise<PromptResponseDto> =>
  promptsApi.createPrompt({ createPromptDto: body });

export const updatePrompt = (
  path: string,
  body: UpdatePromptDto,
  bucket?: string,
): Promise<PromptResponseDto> =>
  promptsApi.updatePrompt({ path, updatePromptDto: body, bucket });

export const deletePrompt = (path: string): Promise<void> =>
  promptsApi.deletePrompt({ path });

export const movePrompt = (
  path: string,
  body: MovePromptDto,
  bucket?: string,
): Promise<PromptResponseDto> =>
  promptsApi.movePrompt({ path, movePromptDto: body, bucket });

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
