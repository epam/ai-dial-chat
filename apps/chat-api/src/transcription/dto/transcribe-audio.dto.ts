import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class TranscribeAudioDto {
  @ApiProperty({ description: 'DIAL storage URL of the uploaded audio file.' })
  @IsString()
  audioUrl!: string;

  @ApiProperty({ description: 'MIME type of the audio file (e.g. audio/webm;codecs=opus).' })
  @IsString()
  mimeType!: string;
}
