import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl } from 'class-validator';

/** Attachment object included with a chat message. */
export class AttachmentDto {
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
  @IsUrl({ protocols: ['https'], require_tld: true, require_protocol: true })
  url?: string;

  @ApiPropertyOptional({ description: 'MIME type of the reference resource' })
  @IsOptional()
  @IsString()
  reference_type?: string;

  @ApiPropertyOptional({ description: 'URL of the reference resource' })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_tld: true, require_protocol: true })
  reference_url?: string;
}
