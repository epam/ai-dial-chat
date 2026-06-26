import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateSelectedDeploymentDto {
  @ApiPropertyOptional({
    description: 'Deployment ID to set as selected, or null to clear.',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsString()
  id: string | null = null;
}
