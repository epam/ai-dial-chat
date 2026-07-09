import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateApplicationBodyDto {
  @ApiProperty({ example: 'My App' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9 _.-]+$/, {
    message:
      'name must contain only letters, digits, spaces, underscores, dots, and dashes',
  })
  name!: string;

  @ApiProperty({
    example: 'https://mydial.epam.com/custom_application_schemas/quickapps2',
  })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiPropertyOptional({ example: 'A custom application.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/icon.svg' })
  @IsString()
  @IsOptional()
  @IsUrl()
  iconUrl?: string;

  @ApiPropertyOptional({ example: '1.0' })
  @IsString()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message:
      'version must contain only letters, digits, dots, underscores, and dashes',
  })
  version?: string;

  @ApiPropertyOptional({ example: ['nlp', 'assistant'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  topics?: string[];

  @ApiPropertyOptional({
    example: 'Summarizes long documents in one line.',
    maxLength: 90,
  })
  @IsString()
  @IsOptional()
  @MaxLength(90)
  intro?: string;
}

export class CreatedApplicationDto {
  @ApiProperty({ example: 'users/my-user/applications/my-app' })
  id!: string;

  @ApiPropertyOptional({ example: 'My App' })
  displayName?: string;

  @ApiPropertyOptional({ example: 'application' })
  object?: string;
}
