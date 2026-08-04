import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { IsValidFilePath } from '../../files/dto/file-path.validator';
import { PublishRuleDto } from '../../publish/dto/publish-rule.dto';

/**
 * Request body for `POST /api/v1/conversations/publish`. Unlike
 * `PublishCatalogEntityDto`, there is no `version` field — conversations
 * have no version concept.
 */
export class PublishConversationDto {
  @ApiProperty({
    description:
      'Destination folder under the Organization/public bucket, forwarded to DIAL Core as `targetFolder`.',
    example: 'Organization/Data Science/Shared chats',
  })
  @IsString()
  @IsValidFilePath()
  folderPath!: string;

  @ApiPropertyOptional({
    description:
      'Access-restriction rules combined with AND; forwarded to DIAL Core unchanged. Omitted or empty means no additional restriction.',
    type: [PublishRuleDto],
    default: [],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PublishRuleDto)
  rules?: PublishRuleDto[];
}
