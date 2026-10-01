import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';

export class StopCompletionDto {
  @ApiProperty({
    description: 'Generation ID that was returned by the active stream.',
    example: 'cfeaf733-4ecd-4898-ad3b-d6835c0b5fc8',
    format: 'uuid',
  })
  @IsUUID('4')
  generationId!: string;

  @ApiProperty({
    description: 'Conversation path of the active generation.',
    example: 'gpt-4o__My Conversation__cfeaf733-4ecd-4898-ad3b-d6835c0b5fc8',
  })
  @IsString()
  @MinLength(1)
  @Matches(/^(?!.*\.\.)[\s\S]+$/, {
    message: 'path contains invalid characters',
  })
  path!: string;

  @ApiPropertyOptional({
    description:
      'Answer text the client has shown so far. Saved as the stopped answer of a background generation, whose text the backend never assembles; ignored for every other generation, whose answer the backend already holds.',
  })
  @IsOptional()
  @IsString()
  content?: string;
}
