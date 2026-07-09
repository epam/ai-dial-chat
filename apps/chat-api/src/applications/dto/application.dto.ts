import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApplicationDto {
  @ApiProperty({ example: 'my-app' })
  id!: string;

  @ApiProperty({ example: 'application' })
  object!: string;

  @ApiPropertyOptional({ example: 'My App' })
  display_name?: string;

  @ApiPropertyOptional({ example: '1.0' })
  display_version?: string;

  @ApiPropertyOptional({ example: 'MyApp.svg' })
  icon_url?: string;

  @ApiPropertyOptional({ example: 'A custom application.' })
  description?: string;

  @ApiPropertyOptional({
    example: 'Summarizes long documents in one line.',
    maxLength: 90,
  })
  intro?: string;

  @ApiPropertyOptional({ type: [String], example: ['image/png'] })
  input_attachment_types?: string[];

  @ApiPropertyOptional({ example: 5 })
  max_input_attachments?: number;
}

export class ApplicationsResponseDto {
  @ApiProperty({ type: () => [ApplicationDto] })
  data!: ApplicationDto[];
}
