import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { FOLDER_NODE_TYPE, MARKER_NAME } from '../files.constants';
import { IsValidFilePath } from './file-path.validator';

const IsNotReservedMarkerName = (
  validationOptions?: ValidationOptions,
): PropertyDecorator => {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isNotReservedMarkerName',
      target: (object as { constructor: new (...args: unknown[]) => unknown })
        .constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return value !== MARKER_NAME;
        },
        defaultMessage() {
          return `name must not be the reserved marker name "${MARKER_NAME}"`;
        },
      },
    });
  };
};

export class CreateFolderDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[\w.-]+$/)
  @MaxLength(256)
  @ApiProperty({ description: 'DIAL Core bucket name', example: 'my-bucket' })
  bucket!: string;

  @IsOptional()
  @IsString()
  @IsValidFilePath()
  @MaxLength(1024)
  @ApiPropertyOptional({
    description: 'Parent folder path within bucket (no leading slash, no ..)',
    example: 'reports/',
  })
  parentPath?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[^/\\\0.][^/\\\0]{0,253}$/, {
    message:
      'name must not start with / \\ . or null; must not contain / \\ or null; max 254 characters',
  })
  @IsNotReservedMarkerName()
  @MaxLength(254)
  @ApiProperty({ description: 'Folder name', example: 'reports' })
  name!: string;
}

export class CreateFolderResponseDto {
  @ApiProperty({ example: 'reports' })
  name!: string;

  @ApiProperty({ example: 'reports/' })
  path!: string;

  @ApiProperty({ example: '' })
  parentPath!: string;

  @ApiProperty({ example: 'my-bucket' })
  bucket!: string;

  @ApiProperty({ example: FOLDER_NODE_TYPE })
  nodeType!: string;

  @ApiProperty({ example: 'my-bucket:reports/' })
  folderId!: string;
}
