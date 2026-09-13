import {
  ApiExtraModels,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  registerDecorator,
  validateSync,
  ValidationOptions,
  ValidateNested,
} from 'class-validator';
import { IsAttachmentUrl } from './attachment.dto';

/**
 * 1-based cell address used by an `excel_rc_range` selector's `start`/`end`,
 * in place of the numeric character offset the other selector kinds use.
 */
export class CellAddressDto {
  @ApiPropertyOptional({ description: '1-based row number' })
  @IsOptional()
  @IsInt()
  row?: number;

  @ApiPropertyOptional({ description: '1-based column number' })
  @IsOptional()
  @IsInt()
  col?: number;
}

/**
 * Validates `AnnotationSelectorDto.start`/`.end`, which are `number |
 * CellAddressDto`. class-validator ANDs every `@ValidateIf` attached to a
 * single property, so two opposing conditions on one property can never both
 * run their guarded decorator — this constraint branches on the value's
 * shape itself instead. The nested `validateSync` call re-runs whitelist
 * stripping/rejection for `CellAddressDto`, since that only happens for
 * objects actually reached during validation.
 */
const IsNumberOrCellAddress =
  (validationOptions?: ValidationOptions) =>
  (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isNumberOrCellAddress',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown): boolean => {
          if (typeof value === 'number') {
            return true;
          }
          if (!(value instanceof CellAddressDto)) {
            return false;
          }
          const errors = validateSync(value, {
            whitelist: true,
            forbidNonWhitelisted: true,
          });
          return errors.length === 0;
        },
        defaultMessage: (): string =>
          `${propertyName} must be a number or a cell address ({ row, col })`,
      },
    });
  };

/**
 * Selector pointing to the cited region within a source: a character range,
 * a PDF bounding box, an inline `<tag id="…">` position, or an Office
 * document range (DOCX/PPTX character range, XLSX cell/range). Validated as
 * an open shape (`type` plus every known optional field) rather than a
 * discriminated union, mirroring `AnnotationSelector` in `chat-shared`.
 */
@ApiExtraModels(CellAddressDto)
export class AnnotationSelectorDto {
  @ApiPropertyOptional({
    description:
      "Selector discriminator, e.g. 'text_character_range', 'pdf_bbox', 'html_tag', 'excel_rc_range'",
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    description:
      'Range start: a character offset (inclusive), or a 1-based cell address for an `excel_rc_range` selector',
    oneOf: [{ type: 'number' }, { $ref: getSchemaPath(CellAddressDto) }],
  })
  @IsOptional()
  @Type(() => CellAddressDto)
  @IsNumberOrCellAddress()
  start?: number | CellAddressDto;

  @ApiPropertyOptional({
    description:
      "Range end. For `text_character_range`/`pdf_bbox`, an inclusive character offset. For `docx_text_range`/`pptx_text_range`, an already-exclusive character offset (confirmed against captured DIAL Core responses). For `excel_rc_range`, a 1-based cell address naming the range's last (inclusive) cell. `null` and omitted are equivalent",
    nullable: true,
    oneOf: [{ type: 'number' }, { $ref: getSchemaPath(CellAddressDto) }],
  })
  @IsOptional()
  @Type(() => CellAddressDto)
  @IsNumberOrCellAddress()
  end?: number | CellAddressDto | null;

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

  @ApiPropertyOptional({
    description:
      "DOCX story name a character range lives in, e.g. 'body' (opaque — no closed set is confirmed)",
  })
  @IsOptional()
  @IsString()
  story?: string;

  @ApiPropertyOptional({
    description:
      'DOCX source-tree element indices identifying the paragraph, matched element-wise',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  path?: number[];

  @ApiPropertyOptional({ description: '1-based PPTX slide number' })
  @IsOptional()
  @IsInt()
  slide?: number;

  @ApiPropertyOptional({
    description: 'PPTX shape identifier, compared as a string',
  })
  @IsOptional()
  @IsString()
  shape_id?: string;

  @ApiPropertyOptional({ description: 'XLSX sheet name, matched exactly' })
  @IsOptional()
  @IsString()
  sheet?: string;

  @ApiPropertyOptional({
    description:
      'Cited text for a DOCX/PPTX range, compared against the text resolved over `start`/`end`',
  })
  @IsOptional()
  @IsString()
  text?: string;
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

  @ApiPropertyOptional({
    description: 'Remote URL pointing to the file content',
  })
  @IsOptional()
  @IsAttachmentUrl()
  url?: string;

  @ApiPropertyOptional({
    description: 'Human-readable display name for the file',
  })
  @IsOptional()
  @IsString()
  title?: string;
}

/** Identifies the cited document attached to the annotation. */
export class AnnotationSourceDto {
  @ApiPropertyOptional({
    description: "Always 'attachment' for file-based sources",
  })
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
@ApiExtraModels(AnnotationSelectorDto)
export class AnnotationBodyDto {
  @ApiPropertyOptional({
    description: 'Location in the cited document; PDF page numbers are 1-based',
    oneOf: [
      { $ref: getSchemaPath(AnnotationSelectorDto) },
      { type: 'array', items: { $ref: getSchemaPath(AnnotationSelectorDto) } },
    ],
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AnnotationSelectorDto)
  selector?: AnnotationSelectorDto | AnnotationSelectorDto[];

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
