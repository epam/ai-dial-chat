import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/** DIAL Core attachment shape — what travels in `Message.custom_content.attachments`. */
export class AttachmentDto {
  @ApiPropertyOptional({
    description: 'Position used to order attachments inside custom_content',
    example: 0,
  })
  @IsOptional()
  @IsInt()
  index?: number;

  @ApiPropertyOptional({
    description: 'MIME type of the attachment',
    example: 'application/pdf',
  })
  @IsString()
  type!: string;

  @ApiPropertyOptional({
    description: 'Display title (usually the original filename)',
    example: 'About_EPAM.pdf',
  })
  @IsString()
  title!: string;

  @ApiPropertyOptional({
    description: 'URL of the file in DIAL storage',
    example: 'files/bucket-id/uploads/2026-05-25/About_EPAM.pdf',
  })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({
    description: 'Base64-encoded inline content (mutually exclusive with url)',
  })
  @IsOptional()
  @IsString()
  data?: string;

  @ApiPropertyOptional({
    description:
      'MIME type of the referenced resource for citation-style attachments',
  })
  @IsOptional()
  @IsString()
  reference_type?: string;

  @ApiPropertyOptional({
    description: 'External URL the attachment references (citations, links)',
  })
  @IsOptional()
  @IsString()
  reference_url?: string;
}

/** DIAL Core `custom_content` payload carried on a chat message. */
export class CustomContentDto {
  @ApiPropertyOptional({
    description: 'Files attached to the message',
    type: () => [AttachmentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}
