import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsBoolean } from 'class-validator';

export class DeleteAllConversationsBodyDto {
  @ApiProperty({
    description:
      'Must be `true` to confirm intentional deletion of all conversations.',
    example: true,
  })
  @IsBoolean()
  @Equals(true)
  confirm!: boolean;
}
