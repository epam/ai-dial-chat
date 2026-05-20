import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class GetThemeIconDto {
  @ApiProperty({
    description: 'Icon filename (alphanumeric, dash, underscore, and dot only)',
    example: 'icon-light.svg',
    type: String,
  })
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message:
      'Icon name must contain only alphanumeric characters, dash, underscore, and dot',
  })
  iconName!: string;
}
