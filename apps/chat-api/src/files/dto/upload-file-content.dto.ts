import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { UploadFileDto } from './upload-file.dto';

/*
 * `contentType` is interpolated into the multipart part header sent to DIAL
 * Core, so only a bare `type/subtype` passes: no parameters (`;`), quotes or
 * CR/LF.
 */
const MIME_TYPE_PATTERN = /^[\w.+-]+\/[\w.+-]+$/;

/** Query of `PUT /api/v1/files/content`; the request body is the file itself. */
export class UploadFileContentQueryDto extends UploadFileDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(MIME_TYPE_PATTERN, {
    message: 'contentType must be a MIME type of the form type/subtype',
  })
  @ApiPropertyOptional({
    description:
      'MIME type of the file, sent to DIAL Core as the Content-Type of the file part. Defaults to application/octet-stream.',
    example: 'text/csv',
    maxLength: 255,
  })
  contentType?: string;
}
