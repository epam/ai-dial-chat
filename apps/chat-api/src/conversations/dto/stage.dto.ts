import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/** Terminal state of a stage. Absent or `null` while the stage is still running. */
export enum StageStatusDto {
  /** The stage completed successfully. */
  Completed = 'completed',
  /** The stage encountered an error. */
  Failed = 'failed',
}

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

  @ApiPropertyOptional({
    description:
      'Stage title. `null` on the chunk that opens the stage, before the name streams in',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Stage text content' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description:
      'Terminal state of the stage. Absent or `null` while the stage is still running',
    enum: StageStatusDto,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(StageStatusDto)
  status?: StageStatusDto | null;

  @ApiPropertyOptional({
    description:
      'Short source/category label shown beside the stage name (e.g. `MCP`)',
    example: 'MCP',
  })
  @IsOptional()
  @IsString()
  tag?: string;

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
