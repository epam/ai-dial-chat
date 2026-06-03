import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class ApplicationSchemaSummaryDto {
  @ApiPropertyOptional({ example: 'https://example.com/schemas/quick-app' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional({ example: 'Quick App' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ example: 'https://example.com/viewer' })
  @IsOptional()
  @IsString()
  viewerUrl?: string;

  @ApiPropertyOptional({ example: 'https://example.com/editor' })
  @IsOptional()
  @IsString()
  editorUrl?: string;

  @ApiPropertyOptional({ example: 'https://example.com/schema' })
  @IsOptional()
  @IsString()
  schemaEndpoint?: string;

  @ApiPropertyOptional({ example: 'https://example.com/icon.png' })
  @IsOptional()
  @IsString()
  iconUrl?: string;
}

export class ApplicationSchemasResponseDto {
  @ApiProperty({ type: () => [ApplicationSchemaSummaryDto] })
  schemas!: ApplicationSchemaSummaryDto[];
}

export class GetApplicationSchemaDto {
  @ApiProperty({
    description: 'Schema $id — arbitrary non-whitespace identifier',
    example: 'quick-app-v1',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\S+$/, { message: 'id must not contain whitespace' })
  id!: string;
}
