import type { PromptResponseDto } from '@epam/ai-dial-chat-api-client';
import type { ExportFolder } from '@epam/ai-dial-chat-shared';
import { formatDateYMD } from './date';

/** A prompt record as it appears inside a downloaded prompt file. */
export interface ExportedPrompt {
  /** Prompt path within the prompts namespace, doubling as its stable id. */
  id: string;
  /** Display name. */
  name: string;
  /** Description, empty when the prompt has none. */
  description: string;
  /** Prompt text, `{{variable}}` placeholders included verbatim. */
  content: string;
  /** Parent folder path; absent for a root-level prompt. */
  folderId?: string;
}

/** Versioned JSON envelope produced by a prompt download. */
export interface PromptExportFormat {
  /** Format version discriminator, shared with the conversation export envelope. */
  version: 5;
  /** Exported prompts. */
  prompts: ExportedPrompt[];
  /** Folders the exported prompts belong to, outermost first. */
  folders: ExportFolder[];
}

/*
 * Each folder's id is its own full path rather than an opaque key, so the chain
 * is reproducible from the prompt's `folderId` alone and a re-import can rebuild
 * the nesting without inventing identifiers.
 */
const buildFolderChain = (folderId: string): ExportFolder[] => {
  const segments = folderId.split('/').filter(Boolean);
  return segments.map((name, index) => {
    const parentPath = segments.slice(0, index).join('/');
    return {
      id: segments.slice(0, index + 1).join('/'),
      name,
      ...(parentPath ? { folderId: parentPath } : undefined),
    };
  });
};

/** Builds the download envelope for a single prompt, including its folder chain. */
export const buildPromptExportEnvelope = (
  prompt: PromptResponseDto,
): PromptExportFormat => ({
  version: 5,
  prompts: [
    {
      id: prompt.id,
      name: prompt.name,
      description: prompt.description ?? '',
      content: prompt.content,
      ...(prompt.folderId ? { folderId: prompt.folderId } : undefined),
    },
  ],
  folders: buildFolderChain(prompt.folderId),
});

/** Serializes a prompt export envelope into a pretty-printed JSON blob. */
export const serializePromptExport = (envelope: PromptExportFormat): Blob =>
  new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });

/** Anything outside this set is collapsed so the prompt name stays a single file-name segment. */
const FILE_NAME_UNSAFE_PATTERN = /[^a-zA-Z0-9._-]+/g;

/** Builds a prompt's download file name, e.g. `2026-08-12_ai_dial_prompt_summarize.json`. */
export const buildPromptExportFileName = (
  promptName: string,
  appName: string,
  date: Date = new Date(),
): string => {
  const safeName = promptName.replace(FILE_NAME_UNSAFE_PATTERN, '_');
  return `${formatDateYMD(date)}_${appName}_prompt_${safeName}.json`;
};
