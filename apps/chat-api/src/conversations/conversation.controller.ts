import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { ApiDialCoreErrors } from '../common/dial/api-dial-core-errors.decorator';
import {
  ConversationMetadataDto,
  ConversationResponseDto,
} from '../openapi/openapi-response.dto';
import { ConversationService } from './conversation.service';
import { ConversationListResponseDto } from './dto/conversation-list.dto';
import { ConversationPathDto } from './dto/conversation-path.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { DeleteAllConversationsBodyDto } from './dto/delete-all-conversations-body.dto';
import { DeleteConversationsBodyDto } from './dto/delete-conversations-body.dto';
import { ConversationDeletionResultDto } from './dto/delete-conversations.dto';
import {
  DuplicateConversationErrorDto,
  DuplicateConversationResponseDto,
} from './dto/duplicate-conversation.dto';
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

/**
 * Creates, reads, lists, saves, renames, duplicates, deletes and marks
 * conversations viewed. Completions, titles and watch live in sibling
 * controllers on the same `conversations` v1 path (see `openspec/changes/split-conversation-controller/design.md` D1).
 */
@ApiTags('conversations')
@Controller({ path: 'conversations', version: '1' })
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

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
      'Idempotently records that the authenticated user has seen this conversation. Clears the unread indicator of scheduler-created conversations and of regular conversations whose answer arrived while the user was elsewhere.',
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
