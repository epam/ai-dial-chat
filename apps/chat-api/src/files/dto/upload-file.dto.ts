import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { UploadMode } from '../types/upload-mode.enum';
import { FileParamsDto } from './file-params.dto';

export class UploadFileDto extends FileParamsDto {
  @IsOptional()
  @IsString()
  @IsIn(Object.values(UploadMode))
  @ApiPropertyOptional({
    description:
      "Upload mode: 'overwrite' (default) overwrites any existing file; 'create-only' fails with 409 if the file already exists",
    enum: Object.values(UploadMode),
    example: UploadMode.CreateOnly,
  })
  uploadMode?: UploadMode;
}
