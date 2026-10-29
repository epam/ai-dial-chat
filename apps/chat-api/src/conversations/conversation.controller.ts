import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Logger,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiExtraModels,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { ApiDialCoreErrors } from '../common/dial/api-dial-core-errors.decorator';
import {
  SSE_DRAIN_TIMEOUT_MS,
  SSE_KEEPALIVE_PAYLOAD,
  startSseResponse,
  waitForDrain,
  writeSseChunk,
} from '../common/utils/sse';
import {
  ConversationMetadataDto,
  ConversationResponseDto,
} from '../openapi/openapi-response.dto';
import {
  SseSubscriptionKind,
  trackSseSubscription,
} from '../telemetry/runtime-metrics';
import { ConversationService } from './conversation.service';
import { AttachGenerationDto } from './dto/attach-generation.dto';
import { ConversationListResponseDto } from './dto/conversation-list.dto';
import { ConversationModelHiddenErrorDto } from './dto/conversation-model-hidden-error.dto';
import { ConversationPathDto } from './dto/conversation-path.dto';
import {
  ConversationTitlesBodyDto,
  ConversationTitlesResponseDto,
} from './dto/conversation-titles.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { DeleteAllConversationsBodyDto } from './dto/delete-all-conversations-body.dto';
import { DeleteConversationsBodyDto } from './dto/delete-conversations-body.dto';
import { ConversationDeletionResultDto } from './dto/delete-conversations.dto';
import {
  DuplicateConversationErrorDto,
  DuplicateConversationResponseDto,
} from './dto/duplicate-conversation.dto';
import { GenerateTitleResponseDto } from './dto/generate-title.dto';
import { GetConversationMetadataDto } from './dto/get-conversation-metadata.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import {
  RenameConversationBodyDto,
  RenameConversationResponseDto,
} from './dto/rename-conversation.dto';
import {
  SaveConversationBodyDto,
  SaveConversationQueryDto,
} from './dto/save-conversation.dto';
import { SendCompletionDto } from './dto/send-completion.dto';
import { StopCompletionDto } from './dto/stop-completion.dto';
import {
  CONVERSATION_TITLE_STREAM_ERROR_EXAMPLE,
  CONVERSATION_TITLE_STREAM_EVENT_MODELS,
  CONVERSATION_TITLE_STREAM_EXAMPLE,
  CONVERSATION_TITLE_STREAM_MAX_ID_BYTES,
  CONVERSATION_TITLE_STREAM_MAX_IDS,
  StreamConversationTitlesBodyDto,
} from './dto/stream-conversation-titles.dto';
import { WatchConversationBodyDto } from './dto/watch-conversation.dto';
import {
  ConversationCompletionsResponder,
  SSE_KEEPALIVE_INTERVAL_MS,
} from './streaming/conversation-completions.responder';
import { TIMEZONE_HEADER, TIMEZONE_MAX_LENGTH } from './utils/timezone-header';

@ApiTags('conversations')
@Controller({ path: 'conversations', version: '1' })
export class ConversationController {
  private readonly logger = new Logger(ConversationController.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly completionsResponder: ConversationCompletionsResponder,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create a new conversation',
    description:
      'Creates a new conversation with an initial user message and returns it with a server-assigned ID.',
  })
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 201,
    description: 'Conversation created successfully',
    type: ConversationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid request body — firstMessage or deploymentId missing or out of range',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  createConversation(@Req() req: Request, @Body() dto: CreateConversationDto) {
    const { at, bucket } = req.user as SessionUser;
    return this.conversationService.createConversation(
      dto.firstMessage,
      at,
      bucket,
      dto.deploymentId,
      dto.custom_content,
    );
  }

  @Get('list')
  @ApiOperation({
    summary: 'List conversations',
    description:
      'Returns a flat conversation list for the authenticated user. Without limit or nextToken, follows all personal and public DIAL Core metadata pages with recursive=true, merges shared conversations, and sorts the complete result by latest activity. Explicit pagination parameters request one page per bucket. Never reads conversation bodies; unresolved display titles are marked isTitlePending for background resolution.',
  })
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'Paginated list of conversation metadata',
    type: ConversationListResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid query params' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 502, description: 'DIAL Core error' })
  @ApiResponse({ status: 503, description: 'DIAL Core unreachable' })
  listConversations(
    @Req() req: Request,
    @Query() query: ListConversationsQueryDto,
  ) {
    const { at, bucket } = req.user as SessionUser;
    return this.conversationService.listConversations(
      at,
      bucket,
      query.limit,
      query.nextToken,
    );
  }

  @Post('titles')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Resolve conversation display titles',
    description:
      'Returns cached or freshly read display titles for up to 25 full conversation resource URLs. Uses the current session permissions. Individual missing, forbidden, or unavailable resources are omitted; conversation messages are never returned.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resolved conversation titles',
    type: ConversationTitlesResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid IDs or batch size; expected 1–25 full conversation resource URLs',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated or DIAL Core rejected the session token',
  })
  @ApiResponse({ status: 403, description: 'Invalid CSRF token' })
  @ApiResponse({
    status: 502,
    description:
      'No titles resolved because DIAL Core returned upstream errors',
  })
  @ApiResponse({
    status: 503,
    description:
      'No titles resolved because DIAL Core is unavailable or the bounded read queue is full',
  })
  async getConversationTitles(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: ConversationTitlesBodyDto,
  ): Promise<ConversationTitlesResponseDto> {
    const { at } = req.user as SessionUser;
    /* A disconnect detaches this request from the shared title reads. */
    const clientAbort = new AbortController();
    const handleClose = () => {
      if (!res.writableEnded) clientAbort.abort();
    };
    res.on('close', handleClose);
    try {
      return await this.conversationService.getConversationTitles(
        dto.ids,
        at,
        clientAbort.signal,
      );
    } finally {
      res.off('close', handleClose);
    }
  }

  @Post('titles/stream')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'streamConversationTitles',
    summary: 'Stream conversation display titles via SSE',
    description: `Opens a finite SSE stream that emits one \`data:\` JSON event per distinct requested ID as soon as its title read settles — \`title\`, \`unavailable\` (missing or forbidden), or \`item_error\` — then exactly one terminal \`done\` or \`error\` event. Each event payload is a \`ConversationTitleStreamEventDto\`. Reads share the process-wide title cache and read limit with \`getConversationTitles\`; up to ${CONVERSATION_TITLE_STREAM_MAX_IDS} IDs (${CONVERSATION_TITLE_STREAM_MAX_ID_BYTES} bytes serialized) are admitted in request order. \`done\` with \`reason: budget\` means the 45-second admission window ended; IDs without an outcome may be requested again. A response that ends without a terminal event was interrupted. Conversation messages are never returned.`,
  })
  @ApiExtraModels(...CONVERSATION_TITLE_STREAM_EVENT_MODELS)
  @ApiResponse({
    status: 200,
    description:
      'SSE stream of ConversationTitleStreamEventDto payloads. Failures after headers are sent are reported by a terminal `error` event, never by the HTTP status.',
    content: {
      'text/event-stream': {
        schema: { type: 'string' },
        examples: {
          complete: {
            summary: 'A later ID resolves first; the stream completes',
            value: CONVERSATION_TITLE_STREAM_EXAMPLE,
          },
          fatal: {
            summary: 'DIAL Core becomes unavailable after an item outcome',
            value: CONVERSATION_TITLE_STREAM_ERROR_EXAMPLE,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: `Invalid IDs or count; expected 1–${CONVERSATION_TITLE_STREAM_MAX_IDS} full conversation resource URLs`,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Invalid CSRF token' })
  @ApiResponse({
    status: 413,
    description: `Serialized IDs exceed ${CONVERSATION_TITLE_STREAM_MAX_ID_BYTES} bytes`,
  })
  @ApiResponse({
    status: 503,
    description: 'Too many concurrent title streams on this instance',
  })
  async streamConversationTitles(
    @Req() req: Request,
    @Res() res: Response,
    @Body() dto: StreamConversationTitlesBodyDto,
  ): Promise<void> {
    const { at } = req.user as SessionUser;
    const admission = this.conversationService.admitConversationTitleStream(
      dto.ids,
    );
    await this.conversationService.streamConversationTitles(admission, at, res);
  }

  @Get('metadata')
  @ApiOperation({ summary: 'Get metadata for a conversation' })
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'Conversation metadata',
    type: ConversationMetadataDto,
  })
  @ApiResponse({ status: 400, description: 'Missing or invalid path' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 502, description: 'DIAL Core error' })
  @ApiResponse({ status: 503, description: 'DIAL Core unreachable' })
  getConversationMetadata(
    @Req() req: Request,
    @Query() query: GetConversationMetadataDto,
  ) {
    const { at, bucket } = req.user as SessionUser;
    return this.conversationService.getConversationMetadata(
      query.path,
      at,
      bucket,
      query.permissions,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get a conversation by path' })
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'Conversation retrieved',
    type: ConversationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Missing or invalid path' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 502, description: 'DIAL Core error' })
  @ApiResponse({ status: 503, description: 'DIAL Core unreachable' })
  getConversation(@Req() req: Request, @Query() query: ConversationPathDto) {
    const { at, bucket } = req.user as SessionUser;
    return this.conversationService.getConversation(query.path, at, bucket);
  }

  @Put()
  @ApiOperation({ summary: 'Save (overwrite) a conversation by path' })
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'Conversation saved',
    type: ConversationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Missing or invalid path or body' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 502, description: 'DIAL Core error' })
  @ApiResponse({
    status: 503,
    description:
      'DIAL Core unreachable, or the conversation kept changing while it has a pending background answer; retry shortly',
  })
  saveConversation(
    @Req() req: Request,
    @Query() query: SaveConversationQueryDto,
    @Body() body: SaveConversationBodyDto,
  ) {
    const { at, bucket } = req.user as SessionUser;
    return this.conversationService.saveClientConversation(
      query.path,
      at,
      bucket,
      body.conversation,
    );
  }

  @Post('completions')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Stream a chat completion',
    description:
      'Appends the user message to the conversation history, streams a completion from DIAL Core as SSE, persists the result, and returns the raw event stream. Backend owns persistence.',
  })
  @ApiHeader({
    name: TIMEZONE_HEADER,
    required: false,
    description:
      'Current browser IANA timezone forwarded to DIAL Core for date- and time-sensitive tools.',
    schema: {
      type: 'string',
      maxLength: TIMEZONE_MAX_LENGTH,
      pattern: '^[A-Za-z0-9._+-]+(?:/[A-Za-z0-9._+-]+)*$',
      example: 'Europe/Warsaw',
    },
  })
  @ApiDialCoreErrors()
  @ApiResponse({ status: 200, description: 'SSE stream of completion chunks' })
  @ApiResponse({
    status: 400,
    description: 'Invalid request body or X-Timezone header',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description:
      'Insufficient permissions on conversation, or (`code: conversationModelHidden`) the requested model is hidden through HIDDEN_ENTITY_TAGS',
    type: ConversationModelHiddenErrorDto,
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({
    status: 409,
    description:
      'Another generation is already active for this conversation and principal, or the conversation has a pending background answer (started by any instance or session)',
  })
  @ApiResponse({ status: 502, description: 'DIAL Core error' })
  @ApiResponse({ status: 503, description: 'DIAL Core unreachable' })
  streamCompletion(
    @Req() req: Request,
    @Res() res: Response,
    @Body() dto: SendCompletionDto,
    @Headers(TIMEZONE_HEADER) timezoneHeader: string | string[] | undefined,
  ): Promise<void> {
    return this.completionsResponder.streamCompletion(
      req,
      res,
      dto,
      timezoneHeader,
      dto.path,
    );
  }

  @Post('completions/stop')
  @ApiOperation({ summary: 'Stop an active generation' })
  @ApiResponse({ status: 204, description: 'Generation stopped successfully' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 503,
    description:
      'The stopped state of a background generation could not be saved; the generation keeps running and Stop can be retried',
  })
  @ApiResponse({
    status: 404,
    description:
      'No active generation found for this principal for the given path and generationId',
  })
  stopCompletion(
    @Req() req: Request,
    @Res() res: Response,
    @Body() dto: StopCompletionDto,
  ): Promise<void> {
    return this.completionsResponder.stopCompletion(req, res, dto, dto.path);
  }

  @Post('completions/attach')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'attachToGeneration',
    summary: 'Attach to an active generation and replay it live',
    description:
      'Opens an SSE stream for the active generation on this conversation path: one `snapshot` event carrying the assistant message as assembled so far and, when the generation runs on this instance outside DIAL Core background mode, its `generationId` — the id `completions/stop` accepts for this path, so a client that attached after a refresh can stop it — then a `chunk` event for every subsequent delta, then exactly one terminal event (`done`/`error`/`stopped`). Used by the frontend to show progressive content when reopening a conversation mid-generation instead of only a typing indicator. Principal-scoped — only the principal that could stop the generation can attach to it.',
  })
  @ApiResponse({
    status: 200,
    description:
      'SSE stream: one snapshot event, live chunk events, then one terminal event',
  })
  @ApiResponse({ status: 400, description: 'Invalid or missing path' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 404,
    description:
      'No active generation found for the given path for this principal — including one that already finished',
  })
  attachToGeneration(
    @Req() req: Request,
    @Res() res: Response,
    @Body() dto: AttachGenerationDto,
  ): Promise<void> {
    return this.completionsResponder.attachToGeneration(
      req,
      res,
      dto,
      dto.path,
    );
  }

  @Post('watch')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'watchConversation',
    summary: 'Subscribe to conversation resource updates via SSE',
    description:
      'Opens an SSE stream that proxies DIAL Core resource-update events for the given conversation path. Used by the frontend to detect when LLM naming completes.',
  })
  @ApiDialCoreErrors()
  @ApiResponse({ status: 200, description: 'SSE stream of resource events' })
  @ApiResponse({ status: 400, description: 'Invalid or missing path' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 502, description: 'DIAL Core subscription failed' })
  async watchConversation(
    @Req() req: Request,
    @Res() res: Response,
    @Body() dto: WatchConversationBodyDto,
  ) {
    const { at, bucket } = req.user as SessionUser;
    const finishSubscription = trackSseSubscription(
      SseSubscriptionKind.ConversationWatch,
    );

    const abortController = new AbortController();
    let isClientAborted = false;
    let isReaderReleased = false;
    let isCancelRequested = false;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    const handleClose = () => {
      isClientAborted = true;
      abortController.abort();
      if (isReaderReleased || isCancelRequested || !reader) {
        return;
      }

      isCancelRequested = true;
      void reader.cancel().catch(() => undefined);
    };

    res.on('close', handleClose);

    try {
      const stream = await this.conversationService.watchConversation(
        dto.path,
        at,
        bucket,
        abortController.signal,
      );

      if (isClientAborted) {
        await stream.cancel().catch(() => undefined);
        return;
      }

      startSseResponse(res);

      reader = stream.getReader();

      let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
      try {
        keepaliveTimer = setInterval(() => {
          if (!isClientAborted && !res.writableEnded) {
            writeSseChunk(res, SSE_KEEPALIVE_PAYLOAD);
          }
        }, SSE_KEEPALIVE_INTERVAL_MS);

        while (true) {
          if (isClientAborted) break;

          const { done, value } = await reader.read();
          if (done) break;

          const { needsDrain } = writeSseChunk(res, value);
          if (needsDrain) {
            const outcome = await waitForDrain(
              res,
              abortController.signal,
              SSE_DRAIN_TIMEOUT_MS,
            );
            if (outcome === 'timeout') {
              isClientAborted = true;
              void reader.cancel().catch(() => undefined);
              break;
            }
            if (outcome === 'aborted') break;
          }
        }
      } catch (err) {
        if (!isClientAborted) {
          this.logger.error(
            'Error while streaming watch events to client',
            err,
          );
        }
      } finally {
        if (keepaliveTimer) clearInterval(keepaliveTimer);
        isReaderReleased = true;
        reader.releaseLock();
        if (!res.writableEnded) {
          res.end();
        }
      }
    } finally {
      res.off('close', handleClose);
      finishSubscription();
    }
  }

  @Patch()
  @ApiOperation({ summary: 'Rename a conversation by path' })
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'Conversation renamed — display name updated, path unchanged',
    type: RenameConversationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Missing or invalid path or newTitle',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 502, description: 'DIAL Core error' })
  @ApiResponse({
    status: 503,
    description:
      'DIAL Core unreachable, or the conversation kept changing while it has a pending background answer; retry shortly',
  })
  renameConversation(
    @Req() req: Request,
    @Query() query: ConversationPathDto,
    @Body() body: RenameConversationBodyDto,
  ) {
    const { at, bucket } = req.user as SessionUser;
    return this.conversationService.renameConversation(
      query.path,
      body.newTitle,
      at,
      bucket,
    );
  }

  @Post('generate-title')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'generateConversationTitle',
    summary: 'Generate an LLM-based title suggestion for a conversation',
    description:
      'Generates a title for an existing conversation using the operator-configured utility model, based on the most recent messages. The suggestion is returned but NOT persisted — the caller confirms the rename separately. Does not read or set the llmNamingDone flag.',
  })
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'Generated title suggestion',
    type: GenerateTitleResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Missing or invalid path, or conversation has no content',
  })
  @ApiResponse({
    status: 401,
    description:
      'Not authenticated, or DIAL Core rejected the calling user’s token for the configured utility model',
  })
  @ApiResponse({
    status: 403,
    description: 'Not authorized to use the configured utility model',
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 502, description: 'LLM title generation failed' })
  @ApiResponse({
    status: 503,
    description: 'LLM title generation unavailable or timed out',
  })
  async generateConversationTitle(
    @Req() req: Request,
    @Query() query: ConversationPathDto,
  ): Promise<GenerateTitleResponseDto> {
    const { at, bucket } = req.user as SessionUser;
    const name = await this.conversationService.generateTitle(
      query.path,
      at,
      bucket,
    );
    return { name };
  }

  @Post('duplicate')
  @ApiOperation({
    summary: "Duplicate a conversation into the user's own bucket",
  })
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 201,
    description: 'Conversation duplicated — new path returned',
    type: DuplicateConversationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Missing or invalid path' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description:
      "The caller cannot read the source conversation, or (`code: conversationDuplicateModelHidden`) the conversation's current model is hidden through HIDDEN_ENTITY_TAGS",
    type: DuplicateConversationErrorDto,
  })
  @ApiResponse({ status: 404, description: 'Source conversation not found' })
  @ApiResponse({ status: 502, description: 'DIAL Core error' })
  @ApiResponse({ status: 503, description: 'DIAL Core unreachable' })
  duplicateConversation(
    @Req() req: Request,
    @Query() query: ConversationPathDto,
  ) {
    const { at, bucket } = req.user as SessionUser;
    return this.conversationService.duplicateConversation(
      query.path,
      at,
      bucket,
    );
  }

  @Post('deletions')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'deleteConversations',
    summary: 'Delete selected conversations',
    description:
      'Deletes up to 100 owned conversations in one request. Returns a result counting deleted, already-absent, and failed items. Already-absent IDs are treated as success. IDs outside the authenticated bucket are rejected with code FORBIDDEN.',
  })
  @ApiResponse({
    status: 200,
    description: 'Deletion result',
    type: ConversationDeletionResultDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'ids is empty, exceeds 100, contains non-strings, or body is missing',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 500, description: 'Unexpected internal error' })
  deleteConversations(
    @Req() req: Request,
    @Body() body: DeleteConversationsBodyDto,
  ) {
    const { at, bucket } = req.user as SessionUser;
    return this.conversationService.deleteConversations(body.ids, at, bucket);
  }

  @Post('deletions/all')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'deleteAllConversations',
    summary: 'Delete all conversations in the user bucket',
    description:
      "Deletes every conversation in the authenticated user's bucket. Requires { confirm: true } in the request body to prevent accidental deletion. Returns a result counting deleted, already-absent, and failed items.",
  })
  @ApiResponse({
    status: 200,
    description: 'Deletion result',
    type: ConversationDeletionResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'confirm is missing, false, or non-boolean',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core metadata listing failed (bucket unreadable)',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core unreachable during metadata listing',
  })
  @ApiResponse({ status: 500, description: 'Unexpected internal error' })
  deleteAllConversations(
    @Req() req: Request,
    @Body() _body: DeleteAllConversationsBodyDto,
  ) {
    const { at, bucket } = req.user as SessionUser;
    return this.conversationService.deleteAllConversations(at, bucket);
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a conversation by path' })
  @ApiDialCoreErrors()
  @ApiResponse({ status: 204, description: 'Conversation deleted' })
  @ApiResponse({ status: 400, description: 'Missing or invalid path' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 502, description: 'DIAL Core error' })
  @ApiResponse({ status: 503, description: 'DIAL Core unreachable' })
  deleteConversation(@Req() req: Request, @Query() query: ConversationPathDto) {
    const { at, bucket } = req.user as SessionUser;
    return this.conversationService.deleteConversation(query.path, at, bucket);
  }

  @Patch('viewed')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'markConversationViewed',
    summary: 'Mark a conversation as viewed',
    description:
      'Idempotently records that the authenticated user has opened this conversation. Used to clear the unread indicator for scheduler-created conversations.',
  })
  @ApiDialCoreErrors()
  @ApiResponse({ status: 204, description: 'Conversation marked as viewed' })
  @ApiResponse({ status: 400, description: 'Missing or invalid path' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 502, description: 'DIAL Core error' })
  markConversationViewed(
    @Req() req: Request,
    @Query() query: ConversationPathDto,
  ) {
    const { at, bucket } = req.user as SessionUser;
    return this.conversationService.markConversationViewed(
      query.path,
      at,
      bucket,
    );
  }
}
