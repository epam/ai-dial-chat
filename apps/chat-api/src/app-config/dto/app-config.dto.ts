import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AppConfigDto {
  @ApiPropertyOptional({
    description:
      'Deployment ID of the ASR model used for transcription. Null when ASR_MODEL is not configured.',
    nullable: true,
  })
  asrModelId!: string | null;

  @ApiProperty({
    description: 'Maximum audio file size in bytes accepted by the transcription endpoint.',
  })
  transcribeSizeLimitBytes!: number;
}
