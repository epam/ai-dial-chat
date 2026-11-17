import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmptyObject,
  IsObject,
  IsString,
  MaxLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/** Largest accepted serialized size of the property values, in characters. */
export const MAX_APPLICATION_VALUES_LENGTH = 64 * 1024;

/** Longest accepted application type schema id. */
export const MAX_SCHEMA_ID_LENGTH = 2048;

/** Rejects a value whose JSON form is larger than {@link MAX_APPLICATION_VALUES_LENGTH}. */
@ValidatorConstraint({ name: 'maxSerializedLength', async: false })
export class MaxSerializedLengthConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return (
      (JSON.stringify(value) ?? '').length <= MAX_APPLICATION_VALUES_LENGTH
    );
  }

  defaultMessage(): string {
    return `properties must not exceed ${MAX_APPLICATION_VALUES_LENGTH} characters when serialized`;
  }
}

/** Application form values whose private dependencies are requested before the application is saved. */
export class ApplicationValuesDependenciesRequestDto {
  @ApiProperty({
    description: 'The application type schema the values belong to.',
    example: 'https://example.com/schemas/my-app.json',
    maxLength: MAX_SCHEMA_ID_LENGTH,
  })
  @IsString()
  @MaxLength(MAX_SCHEMA_ID_LENGTH)
  schemaId!: string;

  @ApiProperty({
    description:
      'The application property values as the form holds them, keyed by schema property.',
    type: 'object',
    additionalProperties: true,
    example: { skills: [{ type: 'dial-prompt', url: 'prompts/bucket/Hi' }] },
  })
  @IsObject()
  @IsNotEmptyObject()
  @Validate(MaxSerializedLengthConstraint)
  properties!: Record<string, unknown>;
}
