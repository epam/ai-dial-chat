import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ApiDialCoreErrors } from '../common/dial/api-dial-core-errors.decorator';
import { AttachGenerationDto } from './dto/attach-generation.dto';
import { ConversationModelHiddenErrorDto } from './dto/conversation-model-hidden-error.dto';
import { SendCompletionDto } from './dto/send-completion.dto';
import { StopCompletionDto } from './dto/stop-completion.dto';
import { ConversationCompletionsResponder } from './streaming/conversation-completions.responder';
import { LANG_HEADER, LANG_MAX_LENGTH } from './utils/lang-header';
import { TIMEZONE_HEADER, TIMEZONE_MAX_LENGTH } from './utils/timezone-header';

/**
 * Streams, stops and attaches to conversation completions. A sibling of
 * `ConversationController` on the same `conversations` v1 path, split out by
 * route group (see `openspec/changes/split-conversation-controller/design.md` D1); every handler delegates to
 * `ConversationCompletionsResponder`.
 */
@ApiTags('conversations')
@Controller({ path: 'conversations', version: '1' })
export class ConversationGenerationController {
  constructor(
    private readonly completionsResponder: ConversationCompletionsResponder,
  ) {}

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
  @ApiHeader({
    name: LANG_HEADER,
    required: false,
    description:
      'Current UI language forwarded to DIAL Core for language-sensitive tools and agents.',
    schema: {
      type: 'string',
      maxLength: LANG_MAX_LENGTH,
      example: 'en',
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
    @Headers(LANG_HEADER) langHeader: string | string[] | undefined,
  ): Promise<void> {
    return this.completionsResponder.streamCompletion(
      req,
      res,
      dto,
      timezoneHeader,
      langHeader,
      dto.path,
      { isUnreadTracked: true },
    );
  }

  @Post('completions/stop')
  @ApiOperation({ summary: 'Stop an active generation' })
  @ApiResponse({ status: 204, description: 'Generation stopped successfully' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 503,
    description:
      'The Stop could not be saved for a background generation or on a foreground generation marker; the generation keeps running and Stop can be retried',
  })
  @ApiResponse({
    status: 404,
    description:
      'No active generation the caller may stop for the given path and generationId',
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
}
