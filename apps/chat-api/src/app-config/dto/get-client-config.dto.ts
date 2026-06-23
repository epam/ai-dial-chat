import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class GetClientConfigDto {
  @IsString()
  @IsIn(['chat-ui'])
  @ApiProperty({
    example: 'chat-ui',
    description: 'Application identifier. Must be a known app ID.',
  })
  appId!: string;
}
