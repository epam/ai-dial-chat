import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

const FORBIDDEN_PATH_CHARS = /[:;,={}%&\\"]/;

const IsValidFilePath = (validationOptions?: ValidationOptions) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isValidFilePath',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          if (value.startsWith('/')) return false;
          if (value.includes('..')) return false;
          if (FORBIDDEN_PATH_CHARS.test(value)) return false;
          return true;
        },
        defaultMessage() {
          return 'path must not start with /, contain .., or include forbidden characters';
        },
      },
    });
  };
};

export class DownloadFileDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[\w.-]+$/)
  @MaxLength(256)
  @ApiProperty({ description: 'DIAL Core bucket name', example: 'my-bucket' })
  bucket!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  @IsValidFilePath()
  @ApiProperty({
    description: 'File path within the bucket (no leading slash, no ..)',
    example: 'folder/file.pdf',
  })
  path!: string;
}
