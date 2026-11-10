import { Controller, Get, HttpCode, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { ResourceDependenciesResultDto } from '../publish/dto/resource-dependency.dto';
import { ConversationPublishDependenciesService } from './conversation-publish-dependencies.service';
import { ConversationPathDto } from './dto/conversation-path.dto';

/**
 * Reads the resources a conversation refers to that are not in the public
 * bucket. A sibling of `ConversationPublishController` on the same path; it is
 * advisory and never fails on an upstream error.
 */
@ApiTags('conversations')
@Controller({ path: 'conversations', version: '1' })
export class ConversationPublishDependenciesController {
  constructor(
    private readonly conversationPublishDependenciesService: ConversationPublishDependenciesService,
  ) {}

  @Get('publish-dependencies')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'getConversationPublishDependencies',
    summary: 'List the private dependencies of a conversation',
    description:
      'Returns the direct references of an owned conversation that are not in the public bucket: its model ' +
      'or add-ons when they are applications or toolsets, the skills its messages use, and attachment files ' +
      'that belong to another user. Files in the author’s own bucket are not listed, because they are ' +
      'published with the conversation. The list is advisory: when it cannot be resolved the response is an ' +
      'empty list rather than an error.',
  })
  @ApiResponse({
    status: 200,
    description: 'The conversation’s private dependencies, possibly empty',
    type: ResourceDependenciesResultDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error — invalid path' })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  getPublishDependencies(
    @Req() req: Request,
    @Query() { path }: ConversationPathDto,
  ): Promise<ResourceDependenciesResultDto> {
    const { at, bucket } = req.user as SessionUser;
    return this.conversationPublishDependenciesService.getDependencies(
      at,
      bucket,
      path,
    );
  }
}
