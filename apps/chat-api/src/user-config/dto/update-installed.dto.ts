import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString, Matches } from 'class-validator';

export class UpdateInstalledDto {
  @ApiProperty({
    description: 'Identifier of the resource to install or uninstall.',
    example: 'toolset-abc',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\S+$/, {
    message: 'id must not contain whitespace',
  })
  id!: string;

  @ApiProperty({
    description: 'Pass `true` to install the resource, `false` to uninstall.',
    example: true,
  })
  @IsBoolean()
  isInstalled!: boolean;
}
