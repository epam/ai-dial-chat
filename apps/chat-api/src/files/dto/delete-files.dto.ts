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

export enum DeleteItemNodeType {
  Item = 'item',
  Folder = 'folder',
}

export class DeleteItemDto {
  @IsString()
  @IsNotEmpty()
  @Matches(BUCKET_NAME_PATTERN, { message: BUCKET_NAME_VALIDATION_MESSAGE })
  @MaxLength(256)
  @ApiProperty({ description: 'DIAL Core bucket name', example: 'my-bucket' })
  bucket!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  @IsValidFilePath()
  @ApiProperty({
    description: 'File or folder path within the bucket',
    example: 'reports/',
  })
  path!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @ApiProperty({
    description: 'Display name (used in error messages)',
    example: 'reports',
  })
  name!: string;

  @IsEnum(DeleteItemNodeType)
  @ApiProperty({ enum: DeleteItemNodeType })
  nodeType!: DeleteItemNodeType;
}

export class DeleteFilesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => DeleteItemDto)
  @ApiProperty({ type: [DeleteItemDto] })
  items!: DeleteItemDto[];
}

export class DeleteItemResultDto {
  @ApiProperty({ description: 'Same path from the request' })
  path!: string;

  @ApiProperty({ description: 'true when DIAL Core returned 2xx or 404' })
  success!: boolean;

  @IsOptional()
  @ApiProperty({
    description: 'Human-readable error reason when success is false',
    required: false,
  })
  error?: string;
}

export class DeleteFilesResponseDto {
  @ApiProperty({ type: [DeleteItemResultDto] })
  results!: DeleteItemResultDto[];
}
