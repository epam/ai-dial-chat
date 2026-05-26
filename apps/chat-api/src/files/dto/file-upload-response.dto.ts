import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FileUploadResponseDto {
  @ApiProperty({ example: 'files/test-bucket/uploads/2026-05-25/report.pdf' })
  url!: string;

  @ApiProperty({ example: 'report.pdf' })
  name!: string;

  @ApiProperty({ example: 'application/pdf' })
  contentType!: string;

  @ApiPropertyOptional({ example: 204800 })
  contentLength?: number;
}
