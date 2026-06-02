import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class GetModelDto {
  @ApiProperty({
    description:
      'Model name (alphanumeric, dash, underscore, dot, colon, at-sign, and slash only)',
    example: 'gpt-4o',
  })
  @IsString()
  @Matches(/^[a-zA-Z0-9_\-.:@]+$/, {
    message:
      'Model name must contain only alphanumeric characters, dash, underscore, dot, colon, and at-sign',
  })
  modelName!: string;
}
