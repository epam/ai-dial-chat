import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import {
  BUCKET_NAME_PATTERN,
  BUCKET_NAME_VALIDATION_MESSAGE,
} from '../../common/validators/bucket-name.pattern';
import { IsValidFilePath } from './file-path.validator';

export class GetFileMetadataQueryDto {
  @IsString()
  @IsNotEmpty()
  @Matches(BUCKET_NAME_PATTERN, { message: BUCKET_NAME_VALIDATION_MESSAGE })
  @MaxLength(256)
  @ApiProperty({ description: 'DIAL Core bucket name', example: 'my-bucket' })
  bucket!: string;

  @IsString()
  @IsNotEmpty()
  @IsValidFilePath()
  @Matches(/[^/]$/, { message: 'path must not end with /' })
  @MaxLength(1024)
  @ApiProperty({
    description:
      'File path within the bucket (no leading slash, no .., no trailing /)',
    example: 'reports/q1-2024.pdf',
  })
  path!: string;
}
