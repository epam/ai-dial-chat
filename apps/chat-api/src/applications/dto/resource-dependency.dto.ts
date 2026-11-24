import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ResourceDependencyAccess } from '../types/resource-dependency-access.enum';

/** DIAL Core rejects a declaration with more entries than this. */
export const MAX_RESOURCE_DEPENDENCIES = 100;

export const RESOURCE_DEPENDENCY_URL_MAX_LENGTH = 1024;

/*
 * A superset of what DIAL Core accepts for `target.url`, so an entry an
 * administrator already stored can be sent back unchanged. Core stays the
 * authority: this only rejects what can never be valid (unknown type, empty
 * segment, whitespace, `*`, `.`/`..` segment). A segment may be the
 * `{current-user}` placeholder or percent-encoded.
 */
export const RESOURCE_DEPENDENCY_URL_PATTERN =
  /^(?:files|prompts|conversations|applications|toolsets|skills|projects)(?:\/(?!\.{1,2}(?:\/|$))[^\s*/]+)+\/?$/;

export const RESOURCE_DEPENDENCY_URL_VALIDATION_MESSAGE =
  'target.url must start with a supported resource type, contain no empty, dot or dot-dot segment, no whitespace and no wildcard';

export class ApplicationResourceDependencyTargetDto {
  @ApiProperty({
    description:
      'A DIAL resource URL: `<type>/<bucket>/<path>` or `<type>/{current-user}/<path>`.',
    example: 'files/{current-user}/',
    maxLength: RESOURCE_DEPENDENCY_URL_MAX_LENGTH,
    pattern: RESOURCE_DEPENDENCY_URL_PATTERN.source,
  })
  @IsString()
  @MaxLength(RESOURCE_DEPENDENCY_URL_MAX_LENGTH)
  @Matches(RESOURCE_DEPENDENCY_URL_PATTERN, {
    message: RESOURCE_DEPENDENCY_URL_VALIDATION_MESSAGE,
  })
  url!: string;
}

/** One declared resource dependency; the `dial.resourceLink` kind is implied. */
export class ApplicationResourceDependencyDto {
  @ApiProperty({
    description: 'Identity of the entry within the application declaration.',
    example: 'access-files',
    maxLength: RESOURCE_DEPENDENCY_URL_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(RESOURCE_DEPENDENCY_URL_MAX_LENGTH)
  linkId!: string;

  @ApiProperty({ type: () => ApplicationResourceDependencyTargetDto })
  @IsObject()
  @ValidateNested()
  @Type(() => ApplicationResourceDependencyTargetDto)
  target!: ApplicationResourceDependencyTargetDto;

  @ApiProperty({
    enum: ResourceDependencyAccess,
    enumName: 'ResourceDependencyAccess',
    isArray: true,
    example: [ResourceDependencyAccess.Read],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(ResourceDependencyAccess, { each: true })
  access!: ResourceDependencyAccess[];

  @ApiPropertyOptional({
    description:
      'When true, an unresolvable or unconsented dependency fails the call. Defaults to false.',
  })
  @IsBoolean()
  @IsOptional()
  required?: boolean;
}

/** The resource dependencies currently stored on an application. */
export class ApplicationResourceDependenciesDto {
  @ApiProperty({
    type: () => [ApplicationResourceDependencyDto],
    maxItems: MAX_RESOURCE_DEPENDENCIES,
  })
  @IsArray()
  @ArrayMaxSize(MAX_RESOURCE_DEPENDENCIES)
  @ValidateNested({ each: true })
  @Type(() => ApplicationResourceDependencyDto)
  resourceDependencies!: ApplicationResourceDependencyDto[];
}
