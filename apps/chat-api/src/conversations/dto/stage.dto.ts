import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/** File attached to one assistant "thinking step" (stage). */
export class StageAttachmentDto {
  @ApiPropertyOptional({ description: 'Zero-based position in the list' })
  @IsOptional()
  @IsNumber()
  index?: number;

  @ApiPropertyOptional({ description: 'Display name of the attachment' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Inline base-64 encoded content' })
  @IsOptional()
  @IsString()
  data?: string;
}

/**
 * One assistant "thinking step" streamed alongside the message text. Already
 * accumulated at runtime for Chat Completions (see `apply-chunk.server.ts`'s
 * `mergeStages`) — this DTO only makes the existing shape part of the
 * documented, validated contract.
 */
export class StageDto {
  @ApiPropertyOptional({ description: 'Zero-based position in the list' })
  @IsOptional()
  @IsNumber()
  index?: number;

  @ApiPropertyOptional({ description: 'Stage title' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Stage text content' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: 'Files produced or referenced by this stage',
    type: [StageAttachmentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StageAttachmentDto)
  attachments?: StageAttachmentDto[];
}
