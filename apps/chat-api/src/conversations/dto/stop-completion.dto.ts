import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class StopCompletionDto {
  @ApiProperty({
    description: 'Generation ID that was returned by the active stream.',
    example: 'cfeaf733-4ecd-4898-ad3b-d6835c0b5fc8',
  })
  @IsString()
  @IsNotEmpty()
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
}
