import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  NotFoundException,
  Patch,
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
import { ConversationGenerationService } from './conversation-generation.service';
import { ConversationService } from './conversation.service';
import { ConversationListResponseDto } from './dto/conversation-list.dto';
import { ConversationPathDto } from './dto/conversation-path.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { DeleteAllConversationsBodyDto } from './dto/delete-all-conversations-body.dto';
import { DeleteConversationsBodyDto } from './dto/delete-conversations-body.dto';
import { ConversationDeletionResultDto } from './dto/delete-conversations.dto';
import { DuplicateConversationResponseDto } from './dto/duplicate-conversation.dto';
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

@ApiTags('conversations')
@Controller({ path: 'conversations', version: '1' })
export class ConversationController {
  private readonly logger = new Logger(ConversationController.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly generationService: ConversationGenerationService,
  ) {}

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
      'Appends the user message to the conversation history, streams a completion from DIAL Core as SSE, persists the result, and returns the raw event stream. Backend owns persistence.',
  })
  @ApiResponse({ status: 200, description: 'SSE stream of completion chunks' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions on conversation',
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({
    status: 409,
    description: 'Another generation is already active for this conversation',
  })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 502, description: 'DIAL Core error' })
  @ApiResponse({ status: 503, description: 'DIAL Core unreachable' })
  async streamCompletion(
    @Req() req: Request,
    @Res() res: Response,
    @Body() dto: SendCompletionDto,
  ): Promise<void> {
    const { at, bucket, sid } = req.user as SessionUser;
    await this.conversationService.streamCompletion(
      dto.path,
      at,
      bucket,
      dto.generationId,
      dto.mode,
      dto.message,
      dto.messageIndex,
      dto.model,
      dto.custom_content,
      sid,
      res,
    );
  }

  @Post('completions/stop')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Stop an active generation' })
  @ApiResponse({ status: 204, description: 'Generation stopped successfully' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 404,
    description:
      'No active generation found for the given path and generationId',
  })
  async stopCompletion(
    @Req() req: Request,
    @Res() res: Response,
    @Body() dto: StopCompletionDto,
  ): Promise<void> {
    const { sid } = req.user as SessionUser;
    const aborted = this.generationService.abort(
      sid,
      dto.path,
      dto.generationId,
    );
    if (!aborted) {
      throw new NotFoundException(
        'No active generation found for the given path and generationId',
      );
    }
    res.status(204).end();
  }

  @Patch()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Rename a conversation by path' })
  @ApiResponse({
    status: 200,
    description: 'Conversation renamed — new path returned',
    type: RenameConversationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Missing or invalid path or newTitle',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 409, description: 'Destination path already exists' })
  @ApiResponse({ status: 502, description: 'DIAL Core error' })
  @ApiResponse({ status: 503, description: 'DIAL Core unreachable' })
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

  @Post('duplicate')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: "Duplicate a conversation into the user's own bucket",
  })
  @ApiResponse({
    status: 201,
    description: 'Conversation duplicated — new path returned',
    type: DuplicateConversationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Missing or invalid path' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
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
  @Throttle({ default: { limit: 5, ttl: 60000 } })
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
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
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
  @Throttle({ default: { limit: 2, ttl: 60000 } })
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
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
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
