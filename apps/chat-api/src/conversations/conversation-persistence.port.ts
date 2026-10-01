import type { ConversationResponseDto } from '../openapi/openapi-response.dto';

/** A stored conversation together with the storage version it was read at. */
export interface VersionedConversation {
  conversation: ConversationResponseDto;
  /** DIAL Core `ETag` of the read; `null` when Core returned none. */
  etag: string | null;
}

/** Re-read budget for a conditional conversation write that meets a concurrent change. */
export const CONDITIONAL_WRITE_ATTEMPTS = 3;

/** Outcome of {@link ConversationPersistencePort.updateConversation}. */
export enum ConditionalUpdateStatus {
  Saved = 'saved',
  /** The update returned `null`; nothing was written. */
  Skipped = 'skipped',
  /** Every attempt met a newer version. */
  Conflict = 'conflict',
}

export type ConditionalUpdateResult =
  | {
      status: ConditionalUpdateStatus.Saved;
      conversation: ConversationResponseDto;
    }
  | {
      status:
        ConditionalUpdateStatus.Skipped | ConditionalUpdateStatus.Conflict;
    };

/** Result of a conditional (`If-Match`) conversation write. */
export type ConditionalSaveResult =
  { isSaved: true; conversation: ConversationResponseDto } | { isSaved: false };

export interface ConversationPersistencePort {
  getConversation(
    conversationPath: string,
    token: string,
    bucket: string,
  ): Promise<ConversationResponseDto>;

  saveConversation(
    conversationPath: string,
    token: string,
    bucket: string,
    conversation: ConversationResponseDto,
  ): Promise<ConversationResponseDto>;

  /**
   * Reads the stored conversation (without display-name derivation) and its `ETag`.
   * Resolves `null` when the conversation does not exist.
   */
  readConversationWithEtag(
    conversationPath: string,
    token: string,
    bucket: string,
  ): Promise<VersionedConversation | null>;

  /**
   * Writes the conversation only if it is still at `etag`; a newer version (`412`)
   * resolves `{ isSaved: false }` instead of throwing.
   */
  saveConversationIfMatch(
    conversationPath: string,
    token: string,
    bucket: string,
    conversation: ConversationResponseDto,
    etag: string,
  ): Promise<ConditionalSaveResult>;

  /**
   * Read → `update` → conditional save, re-reading on a concurrent change. `update`
   * returns the body to save, or `null` to skip.
   */
  updateConversation(
    conversationPath: string,
    token: string,
    bucket: string,
    update: (
      stored: VersionedConversation | null,
    ) => ConversationResponseDto | null,
    initial?: VersionedConversation,
  ): Promise<ConditionalUpdateResult>;
}

export const CONVERSATION_PERSISTENCE = Symbol('CONVERSATION_PERSISTENCE');
