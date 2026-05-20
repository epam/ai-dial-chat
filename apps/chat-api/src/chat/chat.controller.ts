import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ChatCompletionResponseDto } from '../openapi/openapi-response.dto';
import { ChatService } from './chat.service';
import { ChatCompletionDto } from './dto/chat-completion.dto';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('completions/:deployment')
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
  sendCompletion(
    @Param('deployment') deployment: string,
    @Body() dto: ChatCompletionDto,
  ) {
    return this.chatService.sendCompletion(deployment, dto);
  }
}
