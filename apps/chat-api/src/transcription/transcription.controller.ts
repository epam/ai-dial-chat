import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { TranscribeAudioDto } from './dto/transcribe-audio.dto';
import { TranscriptionService } from './transcription.service';

@ApiTags('transcription')
@Controller({ path: 'transcription', version: '1' })
export class TranscriptionController {
  constructor(private readonly transcriptionService: TranscriptionService) {}

  @Post()
  @ApiOperation({ summary: 'Transcribe audio using the configured ASR model' })
  @ApiBody({ type: TranscribeAudioDto })
  @ApiResponse({
    status: 200,
    schema: { properties: { transcript: { type: 'string' } } },
  })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 500, description: 'ASR_MODEL is not configured' })
  @ApiResponse({
    status: 502,
    description: 'Unexpected response from DIAL Core',
  })
  @ApiResponse({ status: 503, description: 'DIAL Core is unreachable' })
  async transcribeAudio(
    @Req() req: Request,
    @Body() dto: TranscribeAudioDto,
  ): Promise<{ transcript: string }> {
    const { at } = req.user as SessionUser;
    const transcript = await this.transcriptionService.transcribeAudio(dto, at);
    return { transcript };
  }
}
