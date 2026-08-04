import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

/** Combining function applied across a rule's `targets`, matching DIAL Core's `Rule.function` values used by this feature. */
export enum PublishRuleFunction {
  Equal = 'EQUAL',
  Contain = 'CONTAIN',
  Regex = 'REGEX',
}

/**
 * One access-restriction rule forwarded to DIAL Core's Publication API
 * unchanged: grants access when `source`'s claim value matches any of
 * `targets` (OR) under `function`. Rules within a publish request's `rules`
 * array are combined with AND by DIAL Core.
 */
export class PublishRuleDto {
  @ApiProperty({
    description: 'Claim/category name this rule matches against.',
    example: 'roles',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  source!: string;

  @ApiProperty({
    enum: PublishRuleFunction,
    example: PublishRuleFunction.Contain,
  })
  @IsEnum(PublishRuleFunction)
  function!: PublishRuleFunction;

  @ApiProperty({
    description:
      'Values combined with OR; exactly one pattern when function is REGEX.',
    type: [String],
    example: ['engineering', 'support'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(200, { each: true })
  targets!: string[];
}
