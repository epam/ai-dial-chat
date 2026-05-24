import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/** DIAL Core API attachment object included with a user message. */
export class DialAttachmentDto {
  @ApiPropertyOptional({ description: 'Zero-based position in the list' })
  @IsOptional()
  index?: number;

  @ApiProperty({ description: 'MIME type of the attachment' })
  @IsString()
  type!: string;

  @ApiProperty({ description: 'Display name of the attachment' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ description: 'Inline base-64 encoded content' })
  @IsOptional()
  @IsString()
  data?: string;

  @ApiPropertyOptional({ description: 'Remote URL of the attachment content' })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({ description: 'MIME type of the reference resource' })
  @IsOptional()
  @IsString()
  reference_type?: string;

  @ApiPropertyOptional({ description: 'URL of the reference resource' })
  @IsOptional()
  @IsString()
  reference_url?: string;
}
