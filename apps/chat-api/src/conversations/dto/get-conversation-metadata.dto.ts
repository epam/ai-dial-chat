import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { ConversationPathDto } from './conversation-path.dto';

export class GetConversationMetadataDto extends ConversationPathDto {
  @ApiPropertyOptional({
    description: 'Include READ/WRITE/SHARE permissions for the requesting user',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  permissions?: boolean;
}
