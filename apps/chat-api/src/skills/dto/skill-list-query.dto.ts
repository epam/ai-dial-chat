import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  BUCKET_NAME_PATTERN,
  BUCKET_NAME_VALIDATION_MESSAGE,
} from '../../common/validators/bucket-name.pattern';
import { IsValidFilePath } from '../../files/dto/file-path.validator';

export class SkillListQueryDto {
  @IsString()
  @IsNotEmpty()
  @Matches(BUCKET_NAME_PATTERN, { message: BUCKET_NAME_VALIDATION_MESSAGE })
  @MaxLength(256)
  @ApiProperty({ description: 'DIAL Core bucket name', example: 'my-bucket' })
  bucket!: string;

  @IsOptional()
  @IsString()
  @IsValidFilePath()
  @MaxLength(1024)
  @ApiPropertyOptional({
    description:
      'Grouping folder path within the bucket (no leading slash, no ..); empty lists the bucket root',
    example: 'team-a/',
  })
  path?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  @ApiPropertyOptional({
    description: 'Pagination token from a previous response',
  })
  token?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(0)
  @Max(1000)
  @ApiPropertyOptional({
    description: 'Max items to return (0-1000, default 100)',
    example: 100,
  })
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @ApiPropertyOptional({
    description:
      'If true, lists the whole subtree; otherwise only immediate children',
    default: false,
  })
  recursive?: boolean;
}

export class SkillFileListQueryDto extends SkillListQueryDto {
  @IsString()
  @IsValidFilePath()
  @MaxLength(1024)
  @ApiProperty({
    description:
      "The relative path of a subfolder inside the skill to scope the listing (empty string for the skill's root)",
    example: '',
  })
  filePath!: string;
}
