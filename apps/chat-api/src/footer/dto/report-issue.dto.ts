import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReportIssueDto {
  @ApiProperty({
    description: 'Short title describing the issue.',
    example: 'Something is broken',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty({
    description: 'Detailed description of the issue.',
    example: 'When I click the button, nothing happens.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  description!: string;
}
