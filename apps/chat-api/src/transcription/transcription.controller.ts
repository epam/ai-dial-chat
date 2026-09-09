import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { TranscribeAudioDto } from './dto/transcribe-audio.dto';
import { TranscriptionUnavailableException } from './transcription-unavailable.exception';
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
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unreachable or ASR is temporarily unavailable',
    headers: {
      'Retry-After': {
        description: 'Upstream retry delay, when provided by DIAL Core',
        schema: { type: 'string' },
      },
    },
  })
  async transcribeAudio(
    @Req() req: Request,
    @Body() dto: TranscribeAudioDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ transcript: string }> {
    const { at } = req.user as SessionUser;
    try {
      const transcript = await this.transcriptionService.transcribeAudio(
        dto,
        at,
      );
      return { transcript };
    } catch (error) {
      if (
        error instanceof TranscriptionUnavailableException &&
        error.retryAfter
      ) {
        res.setHeader('Retry-After', error.retryAfter);
      }
      throw error;
    }
  }
}
