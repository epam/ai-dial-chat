import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  BUCKET_NAME_PATTERN,
  BUCKET_NAME_VALIDATION_MESSAGE,
} from '../../common/validators/bucket-name.pattern';
import { IsValidFilePath } from './file-path.validator';

export class UploadArchiveDto {
  @IsString()
  @IsNotEmpty()
  @Matches(BUCKET_NAME_PATTERN, { message: BUCKET_NAME_VALIDATION_MESSAGE })
  @MaxLength(256)
  @ApiProperty({ description: 'DIAL Core bucket name', example: 'my-bucket' })
  bucket!: string;

  @IsString()
  @IsValidFilePath()
  @MaxLength(1024)
  @ApiProperty({
    description:
      'Destination folder, relative to bucket. Empty string uploads to bucket root.',
    example: 'reports/2026',
  })
  destinationPath!: string;
}

export class UploadArchiveEntryResultDto {
  @ApiProperty({
    description: 'Destination path of the extracted entry (relative to bucket)',
  })
  path!: string;

  @ApiProperty({
    description: 'true when the entry was extracted and uploaded successfully',
  })
  success!: boolean;

  @IsOptional()
  @ApiProperty({
    description: 'Human-readable error reason when success is false',
    required: false,
  })
  error?: string;
}

export class UploadArchiveResponseDto {
  @ApiProperty({ type: [UploadArchiveEntryResultDto] })
  results!: UploadArchiveEntryResultDto[];
}
