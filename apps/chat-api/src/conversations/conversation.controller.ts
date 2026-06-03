import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import {
  ConversationMetadataDto,
  ConversationResponseDto,
} from '../openapi/openapi-response.dto';
import { ConversationService } from './conversation.service';
import { ConversationListResponseDto } from './dto/conversation-list.dto';
import { ConversationPathDto } from './dto/conversation-path.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { GetConversationMetadataDto } from './dto/get-conversation-metadata.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import {
  SaveConversationBodyDto,
  SaveConversationQueryDto,
} from './dto/save-conversation.dto';
import { SendCompletionDto } from './dto/send-completion.dto';

const SSE_KEEPALIVE_INTERVAL_MS = 15_000;
const SSE_KEEPALIVE_PAYLOAD = ': keepalive\n\n';

@ApiTags('conversations')
@Controller({ path: 'conversations', version: '1' })
export class ConversationController {
  private readonly logger = new Logger(ConversationController.name);

  constructor(private readonly conversationService: ConversationService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Create a new conversation',
    description:
      'Creates a new conversation with an initial user message and returns it with a server-assigned ID.',
  })
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
      'Returns a flat, paginated list of all conversations for the authenticated user by calling the DIAL Core metadata endpoint with `recursive=true` on the root path.',
  })
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
      query.path,
    );
  }

  @Get('metadata')
  @ApiOperation({ summary: 'Get metadata for a conversation' })
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
  @ApiResponse({
    status: 200,
    description: 'Conversation saved',
    type: ConversationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Missing or invalid path or body' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 502, description: 'DIAL Core error' })
  @ApiResponse({ status: 503, description: 'DIAL Core unreachable' })
  saveConversation(
    @Req() req: Request,
    @Query() query: SaveConversationQueryDto,
    @Body() body: SaveConversationBodyDto,
  ) {
    const { at, bucket } = req.user as SessionUser;
    return this.conversationService.saveConversation(
      query.path,
      at,
      bucket,
      body.conversation,
    );
  }

  @Post('completions')
  @HttpCode(200)
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  @ApiOperation({
    summary: 'Stream a chat completion',
    description:
      'Appends the user message to the conversation history, streams a completion from DIAL Core as SSE, and returns the raw event stream.',
  })
  @ApiResponse({ status: 200, description: 'SSE stream of completion chunks' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions on conversation',
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 502, description: 'DIAL Core error' })
  @ApiResponse({ status: 503, description: 'DIAL Core unreachable' })
  async streamCompletion(
    @Req() req: Request,
    @Res() res: Response,
    @Body() dto: SendCompletionDto,
  ) {
    const { at, bucket } = req.user as SessionUser;
    const stream = await this.conversationService.streamCompletion(
      dto.path,
      at,
      bucket,
      dto.message,
      dto.model,
      dto.custom_content,
    );

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const reader = stream.getReader();

    let isClientAborted = false;
    let isReaderReleased = false;
    let isCancelRequested = false;

    const handleClose = () => {
      isClientAborted = true;
      if (isReaderReleased || isCancelRequested) {
        return;
      }

      isCancelRequested = true;
      void reader.cancel().catch(() => undefined);
    };

    res.on('close', handleClose);

    let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
    try {
      keepaliveTimer = setInterval(() => {
        if (!isClientAborted && !res.writableEnded) {
          res.write(SSE_KEEPALIVE_PAYLOAD);
        }
      }, SSE_KEEPALIVE_INTERVAL_MS);

      while (true) {
        if (isClientAborted) break;

        const { done, value } = await reader.read();
        if (done) break;

        res.write(value);
      }
    } catch (err) {
      if (!isClientAborted) {
        this.logger.error('Error while streaming completion to client', err);
      }
    } finally {
      if (keepaliveTimer) clearInterval(keepaliveTimer);
      res.off('close', handleClose);
      isReaderReleased = true;
      reader.releaseLock();
      if (!res.writableEnded) {
        res.end();
      }
    }
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a conversation by path' })
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
}
