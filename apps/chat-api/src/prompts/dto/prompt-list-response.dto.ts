import { ApiProperty } from '@nestjs/swagger';
import { PromptFolderResponseDto } from './prompt-folder-response.dto';
import { PromptResponseDto } from './prompt-response.dto';

export class PromptListResponseDto {
  @ApiProperty({ type: [PromptResponseDto] })
  prompts!: PromptResponseDto[];

  @ApiProperty({ type: [PromptFolderResponseDto] })
  folders!: PromptFolderResponseDto[];

  @ApiProperty({ type: [PromptResponseDto] })
  sharedWithMe!: PromptResponseDto[];
}
