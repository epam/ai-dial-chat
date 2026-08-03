import { ApiProperty } from '@nestjs/swagger';

export class PromptFolderResponseDto {
  @ApiProperty({
    description: 'Folder path within the prompts namespace',
    example: 'Work/AI',
  })
  id!: string;

  @ApiProperty({
    description: 'Last path segment (display name)',
    example: 'AI',
  })
  name!: string;
}
