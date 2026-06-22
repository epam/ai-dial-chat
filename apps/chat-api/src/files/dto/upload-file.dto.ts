import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { FileParamsDto } from './file-params.dto';

export type UploadMode = 'overwrite' | 'create-only';

export class UploadFileDto extends FileParamsDto {
  @IsOptional()
  @IsString()
  @IsIn(['overwrite', 'create-only'])
  @ApiPropertyOptional({
    description:
      "Upload mode: 'overwrite' (default) overwrites any existing file; 'create-only' fails with 409 if the file already exists",
    enum: ['overwrite', 'create-only'],
    example: 'create-only',
  })
  uploadMode?: UploadMode;
}
