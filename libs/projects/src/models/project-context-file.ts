import type { Attachment, DisplayAttachment } from '@epam/ai-dial-chat-shared';

/** A context file already stored in the project, with no browser `File` behind it. */
export interface StoredProjectContextFile extends DisplayAttachment {
  /** Size in bytes, as stored in the project. */
  size: number;
  /** Marks the file as already stored rather than newly added. */
  isStored: true;
}

/** One context file of the project form: newly added (`Attachment`) or already stored. */
export type ProjectContextFile = Attachment | StoredProjectContextFile;
