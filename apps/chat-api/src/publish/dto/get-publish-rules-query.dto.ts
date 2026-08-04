import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsValidFilePath } from '../../files/dto/file-path.validator';

/** Query params for `GET /api/v1/publish/rules`. */
export class GetPublishRulesQueryDto {
  @ApiProperty({
    description:
      'Destination folder under the Organization/public bucket to look up existing access rules for.',
    example: 'Organization/Data Science/Shared chats',
  })
  @IsString()
  @IsValidFilePath()
  folderPath!: string;
}
