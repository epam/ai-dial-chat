import {
  Body,
  Controller,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { ApiDialCoreErrors } from '../common/dial/api-dial-core-errors.decorator';
import { ConversationService } from './conversation.service';
import { ConversationPathDto } from './dto/conversation-path.dto';
import {
  ConversationTitlesBodyDto,
  ConversationTitlesResponseDto,
} from './dto/conversation-titles.dto';
import { GenerateTitleResponseDto } from './dto/generate-title.dto';
import {
  CONVERSATION_TITLE_STREAM_ERROR_EXAMPLE,
  CONVERSATION_TITLE_STREAM_EVENT_MODELS,
  CONVERSATION_TITLE_STREAM_EXAMPLE,
  CONVERSATION_TITLE_STREAM_MAX_ID_BYTES,
  CONVERSATION_TITLE_STREAM_MAX_IDS,
  StreamConversationTitlesBodyDto,
} from './dto/stream-conversation-titles.dto';

/**
 * Resolves, streams and generates conversation display titles. A sibling of
 * `ConversationController` on the same `conversations` v1 path, split out by
 * route group (see `openspec/changes/split-conversation-controller/design.md` D1).
 */
@ApiTags('conversations')
@Controller({ path: 'conversations', version: '1' })
export class ConversationTitlesController {
  constructor(private readonly conversationService: ConversationService) {}

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
}
