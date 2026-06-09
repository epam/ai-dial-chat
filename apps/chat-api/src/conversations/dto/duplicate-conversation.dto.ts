import { ApiProperty } from '@nestjs/swagger';

export class DuplicateConversationResponseDto {
  @ApiProperty({
    description: 'Path of the newly created duplicate conversation',
    example: 'conversations/bucket/gpt-4o__My conversation',
  })
  newPath!: string;
}
