import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/** Kinds of DIAL Core resource an item can depend on. Built-in models are never one: they have no bucket. */
export enum ResourceDependencyType {
  Application = 'application',
  Toolset = 'toolset',
  Prompt = 'prompt',
  Skill = 'skill',
  File = 'file',
}

/** One resource an item refers to directly. */
export class ResourceDependencyDto {
  @ApiProperty({
    description:
      "The dependency's DIAL Core resource url, as stored in the reference.",
    example: 'prompts/bucket-123/Support/Greeting',
  })
  @IsString()
  id!: string;

  @ApiProperty({
    description:
      'Display name, percent-decoded, without a trailing `__version`.',
    example: 'Greeting',
  })
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    description: 'Present only for a versioned dependency.',
    example: '1.0.0',
  })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiProperty({ enum: ResourceDependencyType, example: 'prompt' })
  @IsEnum(ResourceDependencyType)
  type!: ResourceDependencyType;

  @ApiProperty({
    description:
      "Percent-decoded folder path of the dependency inside its owner's bucket; empty at the bucket root.",
    example: 'Support',
  })
  @IsString()
  location!: string;
}

/** The direct dependencies of one item. */
export class ResourceDependenciesResultDto {
  @ApiProperty({ type: [ResourceDependencyDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResourceDependencyDto)
  dependencies!: ResourceDependencyDto[];
}
