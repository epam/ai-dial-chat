import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { AttachmentDto } from './attachment.dto';

/** Optional DIAL extra payload attached to a user message. */
export class MessageCustomContentDto {
  @ApiPropertyOptional({
    description: 'DIAL API attachments to include with the message',
    type: [AttachmentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

  @ApiPropertyOptional({
    description: 'Form/button submission value (e.g. `{ button: 1 }`).',
    example: { button: 1 },
  })
  @IsOptional()
  @IsObject()
  configuration_value?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Key-value map of form field values submitted via an embedded form widget.',
    example: { field1: 'value', field2: 42 },
  })
  @IsOptional()
  @IsObject()
  form_value?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Opaque app-managed state to echo back verbatim on the next turn, per the DIAL stateful-app contract.',
  })
  @IsOptional()
  @IsObject()
  state?: Record<string, unknown>;
}
