import type {
  ResourceFoldersResponseDto,
  UpdatePromptDto,
} from '@epam/ai-dial-chat-api-client';
import type { ResourceSaveAdapter } from '../../models/resource-save';
import {
  listPrompts,
  movePrompt,
  updatePrompt,
} from '../../server-api/prompts.api';

/**
 * Lists the folders directly under `path` (plain text, `''` for the root) of
 * the caller's prompts. The prompt listing returns every folder at once, each
 * id being its plain path, so one level is the folders right below `path`.
 */
export const listPromptFolders = async (
  path: string,
): Promise<ResourceFoldersResponseDto> => {
  const { folders } = await listPrompts();
  const prefix = path ? `${path}/` : '';
  return {
    folders: folders
      .filter(
        (folder) =>
          folder.id.startsWith(prefix) &&
          folder.id.length > prefix.length &&
          !folder.id.slice(prefix.length).includes('/'),
      )
      .map((folder) => ({ name: folder.name, path: folder.id })),
  };
};

/** Parameters for {@link createPromptSaveAdapter}. */
export interface PromptSaveAdapterParams {
  /** Full id of the edited prompt. */
  promptId: string;
  /** The edited values. */
  body: UpdatePromptDto;
}

/** Save operations for a prompt: unversioned, so it is updated in place and then moved when its folder changes. */
export const createPromptSaveAdapter = ({
  promptId,
  body,
}: PromptSaveAdapterParams): ResourceSaveAdapter => ({
  publishEntityType: 'prompt',
  isVersioned: false,
  // A rename changes the prompt's id, so the id the update returns is the one moved next.
  saveInPlace: () => updatePrompt(promptId, body),
  move: (id, folderPath) =>
    movePrompt(id, { targetFolderId: folderPath.join('/') }),
});
