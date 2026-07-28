import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ReportIssueDto {
  @ApiProperty({
    description: 'Short title describing the issue.',
    example: 'Something is broken',
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    description: 'Detailed description of the issue.',
    example: 'When I click the button, nothing happens.',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;
}
