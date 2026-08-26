import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

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

  @ApiPropertyOptional({ type: () => AnnotationBodyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AnnotationBodyDto)
  body?: AnnotationBodyDto;
}
