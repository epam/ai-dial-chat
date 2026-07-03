import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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

export enum RenameItemNodeType {
  Item = 'item',
  Folder = 'folder',
}

export class RenameItemDto {
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
    example: 'reports/q1.pdf',
  })
  sourcePath!: string;

  @IsString()
  @IsNotEmpty()
  @IsValidFilePath()
  @MaxLength(1024)
  @ApiProperty({
    description: 'Relative destination path within bucket',
    example: 'reports/q1-final.pdf',
  })
  destinationPath!: string;

  @IsEnum(RenameItemNodeType)
  @ApiProperty({ enum: RenameItemNodeType })
  nodeType!: RenameItemNodeType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @ApiProperty({
    description: 'Display name (last segment) for error messages',
    example: 'q1.pdf',
  })
  name!: string;
}

export class RenameFilesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RenameItemDto)
  @ApiProperty({ type: [RenameItemDto] })
  items!: RenameItemDto[];
}

export class RenameItemResultDto {
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

export class RenameFilesResponseDto {
  @ApiProperty({ type: [RenameItemResultDto] })
  results!: RenameItemResultDto[];
}
