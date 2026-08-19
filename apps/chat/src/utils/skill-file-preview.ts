import type { Attachment } from '@epam/ai-dial-chat-shared';
import {
  getAttachmentTypeFromMime,
  inferMimeTypeFromPath,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import type { SkillFileTreeNode } from '@epam/ai-dial-skill-editor';

/**
 * In-memory bytes for a Skill supporting file, plus its MIME type when known
 * (e.g. from a browser upload's `File.type`).
 */
export interface SkillFileContent {
  /** The file's raw bytes. */
  bytes: Uint8Array;
  /**
   * MIME type from the original browser `File.type`. Omit for edit-mode ZIP
   * entries, which carry no MIME metadata — the type is then inferred from
   * the file's path.
   */
  mimeType?: string;
}

/**
 * Converts a Skill supporting file's in-memory bytes into the `Attachment`
 * shape the chat attachment-canvas pipeline expects, so it can be previewed
 * with `useOpenAttachmentCanvas` exactly like a chat attachment. The id is
 * the file's full relative path (not its basename), so two files with the
 * same name in different folders never collide.
 */
export const skillFileToAttachment = (
  node: SkillFileTreeNode,
  content: SkillFileContent,
): Attachment => {
  const contentType =
    content.mimeType || inferMimeTypeFromPath(node.path) || '';
  const file = new File(
    [new Uint8Array(content.bytes)],
    node.name,
    contentType ? { type: contentType } : undefined,
  );

  return {
    id: node.path,
    name: node.name,
    contentType,
    type: getAttachmentTypeFromMime(contentType),
    status: RequestStatus.Idle,
    file,
  };
};
