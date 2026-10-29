import { createHash } from 'crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { DialClientService } from '../../dial/dial-client.service';
import { ConversationResponseDto } from '../../openapi/openapi-response.dto';
import { ProjectCreateErrorCode } from '../../projects/types/project-create-error-code.enum';
import {
  parseProjectConversationLocator,
  type ParsedProjectConversationLocator,
} from '../../projects/utils/project-conversation-id.util';
import { projectPayloadTooLarge } from '../../projects/utils/project-create-error.util';
import type {
  ConditionalSaveResult,
  VersionedConversation,
} from '../conversation-persistence.port';
import {
  getConversationTitleFromName,
  resolveListDisplayTitle,
} from '../utils/conversation.utils';

/**
 * Attempts of a conditional project conversation write. Core can only
 * condition a project file write on the project's aggregate ETag, so a `412`
 * usually means another file changed in between, and the store re-checks
 * this file's hash and tries again.
 */
export const PROJECT_CONVERSATION_WRITE_ATTEMPTS = 5;

/* Core reads `*` as "any version of an existing project" (design Open Questions). */
const ANY_VERSION = '*';

/** A project conversation file as read from Core. */
interface StoredProjectConversation {
  conversation: ConversationResponseDto;
  /** `"sha256:{hex}"` of the stored bytes — this conversation's version token. */
  contentHash: string;
}

/* `openapi-fetch` resolves an empty-bodied error with `error: undefined`, so the status decides. */
const isFailed = (error: unknown, response: Response | undefined): boolean =>
  error != null || response == null || response.status >= 400;

/** The version token of a project conversation: a hash of its stored bytes, quoted like an entity tag. */
export const hashProjectConversation = (bytes: string): string =>
  `"sha256:${createHash('sha256').update(bytes, 'utf8').digest('hex')}"`;

const requireLocator = (locator: string): ParsedProjectConversationLocator => {
  const parsed = parseProjectConversationLocator(locator);
  if (!parsed) throw new NotFoundException('Conversation not found');
  return parsed;
};

/**
 * Persistence of conversations stored as `conversations/{name}` inside a
 * project (a DIAL Core complex resource). `ConversationPersistenceService`
 * routes every project locator here, so streaming, background generation and
 * naming work unforked.
 *
 * Core's `If-Match` on a project file checks the whole project's ETag, so the
 * version token handed to callers is a content hash of this file instead
 * ({@link hashProjectConversation}): a write to another file in the project
 * does not look like a conflict on this one. Logs carry outcomes and byte
 * counts only, never a project name, conversation name or content.
 */
@Injectable()
export class ProjectConversationStore {
  private readonly logger = new Logger(ProjectConversationStore.name);

  constructor(private readonly dialClient: DialClientService) {}

  /**
   * Reads the stored body with its content-hash version. Throws
   * `NotFoundException` when it does not exist.
   * @param locator - `projects/{bucket}/{projectPath}/conversations/{name}`
   * @param token - caller's bearer token
   */
  async getStoredConversation(
    locator: string,
    token: string,
  ): Promise<{
    conversation: ConversationResponseDto;
    subPath: string;
    etag: string | null;
  }> {
    const parsed = requireLocator(locator);
    const stored = await this.read(parsed, token);
    if (!stored) throw new NotFoundException('Conversation not found');
    return {
      conversation: stored.conversation,
      subPath: parsed.filePath,
      etag: stored.contentHash,
    };
  }

  /**
   * Reads the conversation with its display name derived exactly as for a
   * top-level conversation, plus the stored version it came from.
   * @param locator - project conversation locator
   * @param token - caller's bearer token
   */
  async getConversationWithStoredVersion(
    locator: string,
    token: string,
  ): Promise<{
    conversation: ConversationResponseDto;
    stored: VersionedConversation;
  }> {
    const parsed = requireLocator(locator);
    const { conversation, etag } = await this.getStoredConversation(
      locator,
      token,
    );
    const resolvedName = resolveListDisplayTitle(
      getConversationTitleFromName(parsed.name, false),
      conversation,
    );
    return {
      conversation:
        resolvedName === conversation.name
          ? conversation
          : { ...conversation, name: resolvedName },
      stored: { conversation, etag },
    };
  }

  /**
   * Reads the stored body and its content-hash version; `null` when missing.
   * @param locator - project conversation locator
   * @param token - caller's bearer token
   */
  async readConversationWithEtag(
    locator: string,
    token: string,
  ): Promise<VersionedConversation | null> {
    const stored = await this.read(requireLocator(locator), token);
    return stored
      ? { conversation: stored.conversation, etag: stored.contentHash }
      : null;
  }

  /**
   * Writes the body with `If-Match: *`, whatever version is stored.
   * @param locator - project conversation locator
   * @param token - caller's bearer token
   * @param conversation - full body to write
   */
  async saveConversation(
    locator: string,
    token: string,
    conversation: ConversationResponseDto,
  ): Promise<ConversationResponseDto> {
    const parsed = requireLocator(locator);
    const body = this.withIdentity(parsed, conversation);
    const status = await this.write(parsed, token, body, ANY_VERSION);
    if (status === 412) {
      /* Unreachable with `*`; surfaced rather than retried so it is not silent. */
      return handleDialSdkError(
        undefined,
        'projects.conversations.save',
        this.logger,
        { status: 409 },
      );
    }
    return body;
  }

  /**
   * Writes the body only while the stored bytes still hash to `etag`. Each
   * attempt reads the project's aggregate ETag from its metadata, then the
   * file for the hash, then writes conditioned on that ETag; Core's `412`
   * (another file changed in between) starts the next attempt. The file's own
   * download ETag is not the one Core's `If-Match` checks, and reading the
   * metadata first means any write after it fails the condition.
   * @param locator - project conversation locator
   * @param token - caller's bearer token
   * @param conversation - full body to write
   * @param etag - content hash of the version the body was derived from
   */
  async saveConversationIfMatch(
    locator: string,
    token: string,
    conversation: ConversationResponseDto,
    etag: string,
  ): Promise<ConditionalSaveResult> {
    const parsed = requireLocator(locator);
    const body = this.withIdentity(parsed, conversation);
    for (
      let attempt = 0;
      attempt < PROJECT_CONVERSATION_WRITE_ATTEMPTS;
      attempt++
    ) {
      const projectEtag = await this.readProjectEtag(parsed, token);
      const stored = await this.read(parsed, token);
      if (!stored || stored.contentHash !== etag) {
        this.logger.debug('Conditional project conversation write: conflict');
        return { isSaved: false };
      }
      const status = await this.write(
        parsed,
        token,
        body,
        projectEtag ?? ANY_VERSION,
      );
      if (status !== 412) return { isSaved: true, conversation: body };
      this.logger.debug(
        `Conditional project conversation write: project changed, attempt ${attempt + 1}`,
      );
    }
    this.logger.warn(
      `Conditional project conversation write gave up after ${PROJECT_CONVERSATION_WRITE_ATTEMPTS} attempts`,
    );
    return { isSaved: false };
  }

  /**
   * Deletes the conversation file with `If-Match: *`. A missing file is `404`.
   * @param locator - project conversation locator
   * @param token - caller's bearer token
   */
  async deleteConversation(locator: string, token: string): Promise<void> {
    const parsed = requireLocator(locator);
    const context = 'projects.conversations.delete';
    try {
      const { error, response } =
        await this.dialClient.client.deleteProjectFile(
          parsed.project.bucket,
          encodeDialResourcePath(parsed.project.path),
          encodeDialResourcePath(parsed.filePath),
          {
            headers: {
              ...getBearerAuthHeaders(token),
              'If-Match': ANY_VERSION,
            },
          },
        );
      if (isFailed(error, response)) {
        if (response?.status === 404) {
          throw new NotFoundException('Conversation not found');
        }
        handleDialSdkError(error, context, this.logger, response);
      }
    } catch (error) {
      handleDialSdkError(error, context, this.logger);
    }
  }

  /* The body's `id` is its locator and its `folderId` the project id, whatever the caller sent. */
  private withIdentity(
    parsed: ParsedProjectConversationLocator,
    conversation: ConversationResponseDto,
  ): ConversationResponseDto {
    return {
      ...conversation,
      id: parsed.locator,
      folderId: parsed.project.id,
    };
  }

  /** The project's aggregate ETag from its metadata — the version Core's `If-Match` on a project file checks. */
  private async readProjectEtag(
    parsed: ParsedProjectConversationLocator,
    token: string,
  ): Promise<string | null> {
    const context = 'projects.conversations.read';
    try {
      const { data, error, response } =
        await this.dialClient.client.listProjectMetadata(
          parsed.project.bucket,
          encodeDialResourcePath(parsed.project.path),
          { headers: getBearerAuthHeaders(token) },
        );
      if (isFailed(error, response) || data == null) {
        if (response?.status === 404) {
          throw new NotFoundException('Project not found');
        }
        return handleDialSdkError(error, context, this.logger, response);
      }
      return (data as { etag?: string | null }).etag ?? null;
    } catch (error) {
      return handleDialSdkError(error, context, this.logger);
    }
  }

  private async read(
    parsed: ParsedProjectConversationLocator,
    token: string,
  ): Promise<StoredProjectConversation | null> {
    const context = 'projects.conversations.read';
    let text: string;
    try {
      const { data, error, response } =
        (await this.dialClient.client.downloadProjectFile(
          parsed.project.bucket,
          encodeDialResourcePath(parsed.project.path),
          encodeDialResourcePath(parsed.filePath),
          { headers: getBearerAuthHeaders(token), parseAs: 'text' },
        )) as { data?: unknown; error?: unknown; response: Response };
      if (isFailed(error, response)) {
        if (response?.status === 404) return null;
        return handleDialSdkError(error, context, this.logger, response);
      }
      text = typeof data === 'string' ? data : '';
    } catch (error) {
      return handleDialSdkError(error, context, this.logger);
    }

    let conversation: unknown;
    try {
      conversation = JSON.parse(text);
    } catch {
      conversation = null;
    }
    if (
      conversation == null ||
      typeof conversation !== 'object' ||
      Array.isArray(conversation)
    ) {
      this.logger.error(
        `Stored project conversation is not a JSON object (${Buffer.byteLength(text)} bytes)`,
      );
      return handleDialSdkError(
        new Error('Stored project conversation is not a JSON object'),
        context,
        this.logger,
        { status: 502 },
      );
    }
    return {
      conversation: conversation as ConversationResponseDto,
      contentHash: hashProjectConversation(text),
    };
  }

  /** One file write; resolves Core's status, `412` included, and throws on any other failure. */
  private async write(
    parsed: ParsedProjectConversationLocator,
    token: string,
    conversation: ConversationResponseDto,
    ifMatch: string,
  ): Promise<number> {
    const context = 'projects.conversations.write';
    const bytes = JSON.stringify(conversation);
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([bytes], { type: 'application/json' }),
      parsed.name,
    );
    let status: number;
    try {
      const { error, response } =
        await this.dialClient.client.uploadProjectFile(
          parsed.project.bucket,
          encodeDialResourcePath(parsed.project.path),
          encodeDialResourcePath(parsed.filePath),
          {
            headers: { ...getBearerAuthHeaders(token), 'If-Match': ifMatch },
            body: formData as unknown as { file: string },
          },
        );
      status = response?.status ?? 0;
      if (status === 412) return status;
      if (isFailed(error, response)) {
        if (status === 413) {
          throw projectPayloadTooLarge(
            ProjectCreateErrorCode.ProjectStorageFull,
            'The project has no room for this conversation',
          );
        }
        if (status === 404) {
          throw new NotFoundException('Project not found');
        }
        return handleDialSdkError(error, context, this.logger, response);
      }
    } catch (error) {
      return handleDialSdkError(error, context, this.logger);
    }
    this.logger.debug(
      `Project conversation written (${Buffer.byteLength(bytes)} bytes)`,
    );
    return status;
  }
}
