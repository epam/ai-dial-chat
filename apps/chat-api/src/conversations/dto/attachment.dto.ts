import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  ValidationOptions,
  isURL,
  registerDecorator,
} from 'class-validator';

const DIAL_FILE_URL_PATTERN = /^files\/[A-Za-z0-9_-]+\/.+$/;
/*
 * RFC 2045 media-type: `type/subtype` with optional `; param=value`
 * parameters (e.g. `text/plain; charset=utf-8`). Commas are still rejected
 * because they delimit the mediatype from the data in a `data:` URI and
 * would corrupt it — parameters are stripped at the adapter level before
 * building the URI (see `ResponsesAdapter.buildInputItem`).
 */
const MIME_TYPE_PATTERN =
  /^[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.+]*(?:\s*;\s*[a-zA-Z0-9-]+=(?:[a-zA-Z0-9\-_.+%]+|"[^"]*"))*$/;
const INVALID_PERCENT_ENCODING = /%(?![0-9a-fA-F]{2})/;
const ENCODED_PATH_SEPARATOR_OR_DOT = /%(?:2e|2f|5c)/i;

const IsAttachmentUrl = (validationOptions?: ValidationOptions) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isAttachmentUrl',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;

          const isHttpsUrl = isURL(value, {
            protocols: ['https'],
            require_tld: true,
            require_protocol: true,
          });
          if (isHttpsUrl) return true;

          return (
            DIAL_FILE_URL_PATTERN.test(value) &&
            !value.includes('..') &&
            !INVALID_PERCENT_ENCODING.test(value) &&
            !ENCODED_PATH_SEPARATOR_OR_DOT.test(value)
          );
        },
        defaultMessage() {
          return 'url must be an HTTPS URL or a DIAL file path';
        },
      },
    });
  };
};

/** Attachment object included with a chat message. */
export class AttachmentDto {
  @ApiPropertyOptional({ description: 'Zero-based position in the list' })
  @IsOptional()
  index?: number;

  @ApiProperty({ description: 'MIME type of the attachment' })
  @IsString()
  @Matches(MIME_TYPE_PATTERN, {
    message:
      'type must be a valid MIME type (type/subtype or type/subtype; param=value)',
  })
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
  @IsAttachmentUrl()
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
