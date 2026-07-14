import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  BUCKET_NAME_PATTERN,
  BUCKET_NAME_VALIDATION_MESSAGE,
} from '../../common/validators/bucket-name.pattern';
import { IsValidFilePath } from './file-path.validator';

export enum MoveItemNodeType {
  Item = 'item',
  Folder = 'folder',
}

export class MoveItemDto {
  @IsString()
  @IsNotEmpty()
  @Matches(BUCKET_NAME_PATTERN, { message: BUCKET_NAME_VALIDATION_MESSAGE })
  @MaxLength(256)
  @ApiProperty({ description: 'DIAL Core bucket name', example: 'my-bucket' })
  bucket!: string;

  @IsString()
  @IsNotEmpty()
  @IsValidFilePath()
  @MaxLength(1024)
  @ApiProperty({
    description: 'Relative source path within bucket',
    example: 'inbox/draft.pdf',
  })
  sourcePath!: string;

  @IsString()
  @IsNotEmpty()
  @IsValidFilePath()
  @MaxLength(1024)
  @ApiProperty({
    description: 'Relative destination path within bucket',
    example: 'reports/draft.pdf',
  })
  destinationPath!: string;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    description: 'Whether to overwrite an existing destination resource',
    default: false,
    example: true,
  })
  overwrite?: boolean;

  @IsEnum(MoveItemNodeType)
  @ApiProperty({ enum: MoveItemNodeType })
  nodeType!: MoveItemNodeType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @ApiProperty({
    description: 'Display name (last segment) for error messages',
    example: 'draft.pdf',
  })
  name!: string;
}

export class MoveFilesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => MoveItemDto)
  @ApiProperty({ type: [MoveItemDto] })
  items!: MoveItemDto[];
}

export class MoveItemResultDto {
  @ApiProperty({ description: 'Source path from request' })
  sourcePath!: string;

  @ApiProperty({ description: 'Destination path from request' })
  destinationPath!: string;

  @ApiProperty({
    description: 'true when all Core moveResource calls succeeded',
  })
  success!: boolean;

  @IsOptional()
  @ApiProperty({
    description: 'Human-readable error reason when success is false',
    required: false,
  })
  error?: string;
}

export class MoveFilesResponseDto {
  @ApiProperty({ type: [MoveItemResultDto] })
  results!: MoveItemResultDto[];
}
