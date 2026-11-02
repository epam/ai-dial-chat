import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { DialClientService } from '../../dial/dial-client.service';
import { LIST_DISPLAY_NAME_READ_BATCH_SIZE } from '../constants/conversation.constants';
import { ConversationTitlesResponseDto } from '../dto/conversation-titles.dto';
import { parseConversationResourceId } from '../utils/conversation-resource-id';
import { resolveListDisplayTitle } from '../utils/conversation.utils';
import {
  ConversationTitleCacheService,
  ConversationTitleSummary,
} from './conversation-title-cache.service';

const TITLE_READ_TIMEOUT_MS = 10_000;

export type ConversationTitleResource = NonNullable<
  ReturnType<typeof parseConversationResourceId>
>;

export enum ConversationTitleOutcomeKind {
  Title = 'title',
  /** Core answered 403/404; which of the two is never exposed. */
  Unavailable = 'unavailable',
  Failed = 'failed',
}

export type ConversationTitleOutcome =
  | { kind: ConversationTitleOutcomeKind.Title; title: string }
  | { kind: ConversationTitleOutcomeKind.Unavailable }
  | {
      kind: ConversationTitleOutcomeKind.Failed;
      failure: HttpException;
      /** The per-read deadline elapsed rather than Core answering. */
      isTimeout: boolean;
    };

@Injectable()
export class ConversationTitlesService {
  private readonly logger = new Logger(ConversationTitlesService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly titleCache: ConversationTitleCacheService,
  ) {}

  /**
   * `signal` is the caller's ownership of the shared reads: aborting it
   * detaches this request, and cancels reads no other consumer still needs.
   */
  async getConversationTitles(
    ids: string[],
    token: string,
    signal?: AbortSignal,
  ): Promise<ConversationTitlesResponseDto> {
    if (ids.length < 1 || ids.length > LIST_DISPLAY_NAME_READ_BATCH_SIZE) {
      throw new BadRequestException(
        'Expected between 1 and 25 conversation IDs',
      );
    }
    const resources = [...new Set(ids)].map((id) => {
      const resource = parseConversationResourceId(id);
      if (!resource)
        throw new BadRequestException('Invalid conversation resource URL');
      return { ...resource, requestedId: id };
    });
    let batchFailure: HttpException | undefined;
    const items = await Promise.all(
      resources.map(async (resource) => {
        let outcome: ConversationTitleOutcome;
        try {
          outcome = await this.resolveTitle(resource, token, signal);
        } catch (error) {
          /* The caller left; nobody reads this response. */
          if (signal?.aborted) return undefined;
          throw error;
        }
        if (outcome.kind === ConversationTitleOutcomeKind.Title) {
          return { id: resource.requestedId, title: outcome.title };
        }
        if (outcome.kind === ConversationTitleOutcomeKind.Failed) {
          const { failure } = outcome;
          if (failure instanceof UnauthorizedException) throw failure;
          const upstreamFailure =
            failure.getStatus() === 429
              ? new ServiceUnavailableException(
                  'DIAL Core title reads are rate limited',
                )
              : failure.getStatus() >= 500
                ? failure
                : new BadGatewayException('DIAL Core rejected a title read');
          if (
            !batchFailure ||
            upstreamFailure instanceof ServiceUnavailableException
          )
            batchFailure = upstreamFailure;
        }
        return undefined;
      }),
    );
    const resolved = items.filter((item) => item !== undefined);
    if (resolved.length === 0 && batchFailure) throw batchFailure;
    return { items: resolved };
  }

  /**
   * Resolves one display title through the shared cache. Rejects only when
   * `signal` aborts; every upstream result is classified instead.
   */
  async resolveTitle(
    resource: ConversationTitleResource,
    token: string,
    signal?: AbortSignal,
  ): Promise<ConversationTitleOutcome> {
    try {
      const summary = await this.titleCache.load(
        token,
        resource.id,
        (readSignal) => this.readSummary(resource, token, readSignal),
        signal,
      );
      if (!summary) return { kind: ConversationTitleOutcomeKind.Unavailable };
      return {
        kind: ConversationTitleOutcomeKind.Title,
        title: resolveListDisplayTitle(resource.pathTitle, summary),
      };
    } catch (error) {
      if (signal?.aborted) throw error;
      const failure = this.mapReadFailure(error);
      this.logger.debug(
        'Conversation title unavailable; retaining metadata title',
      );
      if (failure.getStatus() === 403 || failure.getStatus() === 404) {
        return { kind: ConversationTitleOutcomeKind.Unavailable };
      }
      return {
        kind: ConversationTitleOutcomeKind.Failed,
        failure,
        isTimeout: error instanceof Error && error.name === 'TimeoutError',
      };
    }
  }

  private async readSummary(
    resource: ConversationTitleResource,
    token: string,
    signal: AbortSignal,
  ): Promise<ConversationTitleSummary> {
    const { data, error, response } =
      await this.dialClient.client.getConversation(
        resource.bucket,
        resource.path,
        {
          headers: getBearerAuthHeaders(token),
          signal: AbortSignal.any([
            signal,
            AbortSignal.timeout(TITLE_READ_TIMEOUT_MS),
          ]),
        },
      );
    if (error != null || !data || response?.ok === false) {
      return handleDialSdkError(
        error,
        'conversations.getConversationTitles',
        undefined,
        response,
      );
    }
    const conversation = data as ConversationTitleSummary;
    return {
      name:
        typeof conversation.name === 'string' ? conversation.name : undefined,
      llmNamingDone: conversation.llmNamingDone,
    };
  }

  private mapReadFailure(error: unknown): HttpException {
    try {
      return handleDialSdkError(error, 'conversations.getConversationTitles');
    } catch (failure) {
      return failure instanceof HttpException
        ? failure
        : new BadGatewayException();
    }
  }
}
