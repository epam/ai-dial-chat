import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
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

export enum SharePermission {
  Read = 'read',
  ReadWrite = 'readWrite',
}

export class ShareItemDto {
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
    description: 'Relative path within bucket',
    example: 'reports/q1.pdf',
  })
  path!: string;
}

export class ShareFilesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ShareItemDto)
  @ApiProperty({ type: [ShareItemDto] })
  items!: ShareItemDto[];

  @IsEnum(SharePermission)
  @ApiProperty({ enum: SharePermission })
  permission!: SharePermission;
}

export class ShareFilesResponseDto {
  @ApiProperty({ description: 'Invitation link covering all shared resources' })
  invitationLink!: string;
}
