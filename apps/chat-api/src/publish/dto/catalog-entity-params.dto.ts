import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { IsValidFilePath } from '../../files/dto/file-path.validator';

/** Catalog entity kinds that can be published (resource-backed only — excludes built-in Models). */
export enum CatalogEntityType {
  Model = 'model',
  Toolset = 'toolset',
  Application = 'application',
  Prompt = 'prompt',
  Skill = 'skill',
}

/** Path params shared by both publish endpoints. */
export class CatalogEntityParamsDto {
  @ApiProperty({
    description: 'Catalog entity kind.',
    enum: CatalogEntityType,
    example: CatalogEntityType.Toolset,
  })
  @IsEnum(CatalogEntityType)
  entityType!: CatalogEntityType;

  @ApiProperty({
    description:
      "The entity's DIAL Core resource path, used directly as the Publication API `sourceUrl`.",
    example: 'tool-abc123',
  })
  @IsString()
  @IsValidFilePath()
  entityId!: string;
}
