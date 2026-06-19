import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';
import { ConversationResponseDto } from '../../openapi/openapi-response.dto';
import { ConversationPathDto } from './conversation-path.dto';

export class SaveConversationQueryDto extends ConversationPathDto {}

export class SaveConversationBodyDto {
  @ApiProperty({
    description: 'Full conversation object to persist',
    type: ConversationResponseDto,
  })
  @IsObject()
  conversation!: ConversationResponseDto;
}
