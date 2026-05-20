import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';
import { ConversationPathDto } from './conversation-path.dto';

export class SaveConversationQueryDto extends ConversationPathDto {}

export class SaveConversationBodyDto {
  @ApiProperty({ description: 'Full conversation object to persist' })
  @IsObject()
  conversation!: Record<string, unknown>;
}
