import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

const parseBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

export class CatalogQueryDto {
  @ApiPropertyOptional({
    type: Boolean,
    example: false,
    description: 'Filter model items by capabilities.completion exact value.',
  })
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  'modelCapabilities.completion'?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    example: true,
    description:
      'Filter model items by capabilities.chat_completion exact value.',
  })
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  'modelCapabilities.chat_completion'?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    example: false,
    description: 'Filter model items by capabilities.embeddings exact value.',
  })
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  'modelCapabilities.embeddings'?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    example: false,
    description: 'Filter model items by capabilities.fine_tune exact value.',
  })
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  'modelCapabilities.fine_tune'?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    example: false,
    description: 'Filter model items by capabilities.inference exact value.',
  })
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  'modelCapabilities.inference'?: boolean;
}
