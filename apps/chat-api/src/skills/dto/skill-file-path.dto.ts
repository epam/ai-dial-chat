import { applyDecorators } from '@nestjs/common';
import { ApiHeader, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsValidFilePath } from '../../files/dto/file-path.validator';

/** Lowercased header name used to read the conditional `If-Match` request header off `Request`. */
export const IF_MATCH_HEADER = 'if-match';

/**
 * Shared `filePath` field decorator reused by every DTO that addresses one
 * file inside a skill (`upload-skill-file.dto.ts`,
 * `skill-mutation.dto.ts`'s `DeleteSkillFileDto`, and the file
 * download/list query DTOs) — validated with the same `IsValidFilePath`
 * rule the rest of the codebase uses for DIAL Core resource paths.
 */
export const SkillFilePathField = () =>
  applyDecorators(
    IsString(),
    IsNotEmpty(),
    /*
     * IsValidFilePath()'s own declared return type
     * (`(object: object, propertyName: string) => void`) is narrower than
     * `PropertyDecorator` (`propertyKey: string | symbol`) — fine for direct
     * `@IsValidFilePath()` field application, but `applyDecorators`
     * requires the formal `PropertyDecorator` shape.
     */
    IsValidFilePath() as PropertyDecorator,
    MaxLength(1024),
    ApiProperty({
      description: 'Relative path of the file within the skill',
      example: 'scripts/helper.py',
    }),
  );

/**
 * Shared `@ApiHeader` decorator documenting the optional conditional
 * `If-Match` request header for skill mutation endpoints. The verified SDK
 * schema declares this header per-operation, not per-DTO (see design.md
 * D2), so it's applied to controller methods rather than modeled as a
 * validated DTO field.
 */
export const ApiIfMatchHeader = (): MethodDecorator =>
  ApiHeader({
    name: 'If-Match',
    required: false,
    description:
      'ETag of the resource version to operate on, for optimistic concurrency control',
  });
