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

@Injectable()
export class ConversationTitlesService {
  private readonly logger = new Logger(ConversationTitlesService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly titleCache: ConversationTitleCacheService,
  ) {}

  async getConversationTitles(
    ids: string[],
    token: string,
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
        try {
          const summary = await this.titleCache.load(
            token,
            resource.id,
            async () => {
              const { data, error, response } =
                await this.dialClient.client.getConversation(
                  resource.bucket,
                  resource.path,
                  {
                    headers: getBearerAuthHeaders(token),
                    signal: AbortSignal.timeout(10_000),
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
                  typeof conversation.name === 'string'
                    ? conversation.name
                    : undefined,
                llmNamingDone: conversation.llmNamingDone,
              };
            },
          );
          return summary
            ? {
                id: resource.requestedId,
                title: resolveListDisplayTitle(resource.pathTitle, summary),
              }
            : undefined;
        } catch (error) {
          const failure = this.mapReadFailure(error);
          if (failure instanceof UnauthorizedException) throw failure;
          if (failure.getStatus() !== 403 && failure.getStatus() !== 404) {
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
          this.logger.debug(
            'Conversation title unavailable; retaining metadata title',
          );
          return undefined;
        }
      }),
    );
    const resolved = items.filter((item) => item !== undefined);
    if (resolved.length === 0 && batchFailure) throw batchFailure;
    return { items: resolved };
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
