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
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { getUserDisplayName } from '../common/utils/user-display-name';
import { ConversationPublishService } from './conversation-publish.service';
import { ConversationPathDto } from './dto/conversation-path.dto';
import { PublishConversationResultDto } from './dto/publish-conversation-result.dto';
import { PublishConversationDto } from './dto/publish-conversation.dto';

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
  @Throttle({ default: { limit: 10, ttl: 60000 } })
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
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
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

  @Get('publish-history')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
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
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
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
