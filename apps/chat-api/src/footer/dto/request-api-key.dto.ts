import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class RequestApiKeyDto {
  @ApiProperty({ description: 'Project name.', example: 'My AI Project' })
  @IsString()
  @IsNotEmpty()
  project_id!: string;

  @ApiProperty({ description: 'Stream name.', example: 'Stream A' })
  @IsString()
  @IsNotEmpty()
  project_stream!: string;

  @ApiProperty({
    description: 'Email of the project tech lead.',
    example: 'lead@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  project_lead!: string;

  @ApiProperty({
    description: 'Business justification for the access request.',
    example: 'We need access for automated document processing.',
  })
  @IsString()
  @IsNotEmpty()
  business_reason!: string;

  @ApiProperty({
    description: 'Project end date in DD/MM/YYYY format.',
    example: '31/12/2025',
  })
  @IsString()
  @IsNotEmpty()
  project_end!: string;

  @ApiProperty({
    description: 'Description of the access scenario.',
    example: 'Daily batch processing of documents.',
  })
  @IsString()
  @IsNotEmpty()
  access_scenario!: string;

  @ApiProperty({
    description: 'Cost and workload description.',
    example: 'Estimated 10k tokens per day.',
  })
  @IsString()
  @IsNotEmpty()
  workload_pattern!: string;
}
