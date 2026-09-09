import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { getUserDisplayName } from '../common/utils/user-display-name';
import { ConversationPublishService } from './conversation-publish.service';
import { ConversationPathDto } from './dto/conversation-path.dto';
import { PublishConversationResultDto } from './dto/publish-conversation-result.dto';
import { PublishConversationDto } from './dto/publish-conversation.dto';
import { UnpublishConversationResultDto } from './dto/unpublish-conversation-result.dto';
import { UnpublishConversationDto } from './dto/unpublish-conversation.dto';

/**
 * Publishes conversations to an Organization folder and reads their publish
 * history, both proxied through DIAL Core's Publication API. A sibling of
 * `ConversationController` rather than a merged set of methods on it (kept
 * separate for file-size reasons — see design.md D1) and a sibling of
 * `apps/chat-api/src/publish/publish.controller.ts` rather than an extension
 * of its `entityType` enum, since conversation paths don't fit that
 * controller's single-URL-segment `entityId` shape.
 */
@ApiTags('conversations')
@Controller({ path: 'conversations', version: '1' })
export class ConversationPublishController {
  constructor(
    private readonly conversationPublishService: ConversationPublishService,
  ) {}

  @Post('publish')
  @HttpCode(201)
  @ApiOperation({
    operationId: 'publishConversation',
    summary: 'Publish a conversation to an Organization folder',
    description:
      'Publishes an owned conversation to a folder under the Organization/public bucket by proxying ' +
      "DIAL Core's Publication API (`createPublication`). This endpoint keeps no publish records of " +
      'its own — DIAL Core is the sole source of truth. The conversation title is re-fetched ' +
      'server-side and used as the publication name.',
  })
  @ApiBody({ type: PublishConversationDto })
  @ApiResponse({
    status: 201,
    description: 'Conversation published successfully',
    type: PublishConversationResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — invalid path or folderPath',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description: 'Caller lacks write access to the target folder',
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  publish(
    @Req() req: Request,
    @Query() { path }: ConversationPathDto,
    @Body() { folderPath, rules }: PublishConversationDto,
  ): Promise<PublishConversationResultDto> {
    const { at, bucket, claims } = req.user as SessionUser;
    return this.conversationPublishService.publish(
      at,
      bucket,
      path,
      folderPath,
      getUserDisplayName(claims),
      rules,
    );
  }

  @Post('unpublish')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'unpublishConversation',
    summary: 'Request removal of a published conversation from a folder',
    description:
      'Submits a removal request for one already-published folder of an owned conversation by proxying ' +
      "DIAL Core's Publication API (`createPublication`) with a single `DELETE`-action resource. " +
      '**The removal takes effect only after an administrator approves the request.** Until then the ' +
      'published copy stays visible to everyone who could already see it, and the folder continues to ' +
      'appear in the conversation’s publish history. The conversation title is re-fetched server-side ' +
      'and used as the publication name, so the request is legible in the admin queue.',
  })
  @ApiBody({ type: UnpublishConversationDto })
  @ApiResponse({
    status: 200,
    description: 'Unpublish request submitted for administrator approval',
    type: UnpublishConversationResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — invalid path or folderPath',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description: 'Caller lacks write access to the target folder',
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  unpublish(
    @Req() req: Request,
    @Query() { path }: ConversationPathDto,
    @Body() { folderPath }: UnpublishConversationDto,
  ): Promise<UnpublishConversationResultDto> {
    const { at, bucket, claims } = req.user as SessionUser;
    return this.conversationPublishService.unpublish(
      at,
      bucket,
      path,
      folderPath,
      getUserDisplayName(claims),
    );
  }

  @Get('publish-history')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'getConversationPublishHistory',
    summary: 'Get publish history for a conversation',
    description:
      'Returns every folder this conversation has been published to, most recent first, derived from ' +
      "DIAL Core's Publication API (`getPublications`) — never from chat-api-side storage.",
  })
  @ApiResponse({
    status: 200,
    description: 'Publish history for the conversation',
    type: PublishConversationResultDto,
    isArray: true,
  })
  @ApiResponse({ status: 400, description: 'Validation error — invalid path' })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  getPublishHistory(
    @Req() req: Request,
    @Query() { path }: ConversationPathDto,
  ): Promise<PublishConversationResultDto[]> {
    const { at, bucket } = req.user as SessionUser;
    return this.conversationPublishService.getPublishHistory(at, bucket, path);
  }
}
