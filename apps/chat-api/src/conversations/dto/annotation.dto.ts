import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { IsAttachmentUrl } from './attachment.dto';

/**
 * Selector pointing to the cited region within a source: a character range,
 * a PDF bounding box, or an inline `<tag id="…">` position. Validated as an
 * open shape (`type` plus every known optional field) rather than a
 * discriminated union, mirroring `AnnotationSelector` in `chat-shared`.
 */
export class AnnotationSelectorDto {
  @ApiPropertyOptional({
    description:
      "Selector discriminator, e.g. 'text_character_range', 'pdf_bbox', 'html_tag'",
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Character range start (inclusive)' })
  @IsOptional()
  @IsNumber()
  start?: number;

  @ApiPropertyOptional({ description: 'Character range end (inclusive)' })
  @IsOptional()
  @IsNumber()
  end?: number;

  @ApiPropertyOptional({ description: '1-based PDF page number' })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: 'PDF bounding box left edge' })
  @IsOptional()
  @IsNumber()
  x1?: number;

  @ApiPropertyOptional({ description: 'PDF bounding box top edge' })
  @IsOptional()
  @IsNumber()
  y1?: number;

  @ApiPropertyOptional({ description: 'PDF bounding box right edge' })
  @IsOptional()
  @IsNumber()
  x2?: number;

  @ApiPropertyOptional({ description: 'PDF bounding box bottom edge' })
  @IsOptional()
  @IsNumber()
  y2?: number;

  @ApiPropertyOptional({ description: "Inline tag name, e.g. 'cit'" })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ description: "Inline tag's id attribute value" })
  @IsOptional()
  @IsString()
  id?: string;
}

/** Identifies the part of the message (or a related resource) an annotation targets. */
export class AnnotationTargetDto {
  @ApiPropertyOptional({ type: () => AnnotationSelectorDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AnnotationSelectorDto)
  selector?: AnnotationSelectorDto;
}

/** A file attachment referenced by a citation — same shape as `AttachmentDto` but scoped to annotations. */
export class AttachmentResourceDto {
  @ApiPropertyOptional({ description: 'MIME type of the attached file' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Remote URL pointing to the file content' })
  @IsOptional()
  @IsAttachmentUrl()
  url?: string;

  @ApiPropertyOptional({ description: 'Human-readable display name for the file' })
  @IsOptional()
  @IsString()
  title?: string;
}

/** Identifies the cited document attached to the annotation. */
export class AnnotationSourceDto {
  @ApiPropertyOptional({ description: "Always 'attachment' for file-based sources" })
  @IsOptional()
  @IsIn(['attachment'])
  type?: 'attachment';

  @ApiPropertyOptional({ type: () => AttachmentResourceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AttachmentResourceDto)
  attachment?: AttachmentResourceDto;
}

/** Quoted source detail behind one annotation/citation. */
export class AnnotationBodyDto {
  @ApiPropertyOptional({ description: 'Title of the cited source' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Quoted excerpt from the cited source' })
  @IsOptional()
  @IsString()
  quote?: string;

  @ApiPropertyOptional({ type: () => AnnotationSourceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AnnotationSourceDto)
  source?: AnnotationSourceDto;
}

/**
 * One citation/annotation attached to the message text. Already accumulated
 * at runtime for Chat Completions (see `apply-chunk.server.ts`) — this DTO
 * only makes the existing shape part of the documented, validated contract.
 */
export class AnnotationDto {
  @ApiPropertyOptional({ description: 'Zero-based position in the list' })
  @IsOptional()
  @IsNumber()
  index?: number;

  @ApiPropertyOptional({ type: () => AnnotationTargetDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AnnotationTargetDto)
  target?: AnnotationTargetDto;

  @ApiPropertyOptional({ type: () => AnnotationBodyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AnnotationBodyDto)
  body?: AnnotationBodyDto;
}
