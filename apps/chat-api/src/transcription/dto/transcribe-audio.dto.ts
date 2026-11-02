import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class TranscribeAudioDto {
  @ApiProperty({ description: 'DIAL storage URL of the uploaded audio file.' })
  @IsString()
  @IsNotEmpty()
  audioUrl!: string;

  @ApiProperty({
    description: 'MIME type of the audio file (e.g. audio/webm;codecs=opus).',
  })
  @IsString()
  @IsNotEmpty()
  mimeType!: string;
}
