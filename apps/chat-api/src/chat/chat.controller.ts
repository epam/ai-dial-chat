import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { ChatCompletionResponseDto } from '../openapi/openapi-response.dto';
import { ChatService } from './chat.service';
import { ChatCompletionDto } from './dto/chat-completion.dto';

@ApiTags('chat')
@Controller({ path: 'chat', version: '1' })
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('completions')
  @ApiOperation({ summary: 'Send a chat completion request to DIAL Core' })
  @ApiBody({ type: ChatCompletionDto })
  @ApiResponse({
    status: 200,
    description: 'Chat completion response from DIAL Core',
    type: ChatCompletionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 404, description: 'Deployment not found' })
  @ApiResponse({
    status: 502,
    description: 'Unexpected response from DIAL Core',
  })
  @ApiResponse({ status: 503, description: 'DIAL Core is unreachable' })
  sendCompletion(@Req() req: Request, @Body() dto: ChatCompletionDto) {
    const { at } = req.user as SessionUser;
    return this.chatService.sendCompletion(dto, at);
  }
}
