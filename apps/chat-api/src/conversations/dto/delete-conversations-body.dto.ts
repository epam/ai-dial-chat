import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  MinLength,
} from 'class-validator';

export class DeleteConversationsBodyDto {
  @ApiProperty({
    description:
      'Stable DIAL Core conversation IDs to delete. 1–100 IDs. Duplicates are silently deduplicated.',
    type: [String],
    minItems: 1,
    maxItems: 100,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  ids!: string[];
}
