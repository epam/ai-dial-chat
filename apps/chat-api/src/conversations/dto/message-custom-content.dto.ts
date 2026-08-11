import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { AttachmentDto } from './attachment.dto';

/**
 * One reasoning-summary text fragment, keyed by `(itemId, outputIndex,
 * summaryIndex)`. Mirrors the wire shape emitted by
 * `ResponsesAdapter.relay` and merged by `applyChunkToMessage`.
 */
export class ReasoningSummaryPartDto {
  @ApiProperty({
    description: 'Upstream reasoning output item id',
    example: 'rs_1',
  })
  @IsString()
  itemId!: string;

  @ApiProperty({
    description:
      "Position of the reasoning item in the response's output array",
  })
  @IsInt()
  @Min(0)
  outputIndex!: number;

  @ApiProperty({
    description: 'Position of this summary part within the reasoning item',
  })
  @IsInt()
  @Min(0)
  summaryIndex!: number;

  @ApiProperty({
    description: 'Accumulated summary text fragment for this key',
  })
  @IsString()
  text!: string;
}

/** Optional DIAL extra payload attached to a user message. */
export class MessageCustomContentDto {
  @ApiPropertyOptional({
    description: 'DIAL API attachments to include with the message',
    type: [AttachmentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

  @ApiPropertyOptional({
    description: 'Form/button submission value (e.g. `{ button: 1 }`).',
    example: { button: 1 },
  })
  @IsOptional()
  @IsObject()
  configuration_value?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Key-value map of form field values submitted via an embedded form widget.',
    example: { field1: 'value', field2: 42 },
  })
  @IsOptional()
  @IsObject()
  form_value?: Record<string, unknown>;
}
