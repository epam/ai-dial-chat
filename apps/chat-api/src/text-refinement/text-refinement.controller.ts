import {
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import {
  RefineTextRequestDto,
  RefineTextResponseDto,
} from './dto/refine-text.dto';
import { TextRefinementService } from './text-refinement.service';

@ApiTags('text-refinement')
@Controller({ path: 'text-refinement', version: '1' })
export class TextRefinementController {
  constructor(private readonly service: TextRefinementService) {}

  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Refine an authoring draft',
    description:
      'Rewrite one field using a server-owned prompt and the caller credentials. Does not save or cache drafts. Scheduled-task purposes require scheduled-task access.',
  })
  @ApiResponse({
    status: 200,
    type: RefineTextResponseDto,
    description: 'Complete refined text',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid purpose, text, length or unknown body fields',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description: 'CSRF, feature or model permission denied',
  })
  @ApiResponse({
    status: 413,
    description: 'Global request body limit exceeded',
  })
  @ApiResponse({
    status: 429,
    description: 'DIAL Core quota or rate limit exceeded',
  })
  @ApiResponse({
    status: 502,
    description: 'Upstream failure or invalid/incomplete output',
  })
  @ApiResponse({
    status: 503,
    description:
      'Model unconfigured, network unavailable or 30-second deadline exceeded',
  })
  async refineText(
    @Body() dto: RefineTextRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefineTextResponseDto> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    req.once('aborted', abort);
    res.once('close', abort);
    if (req.aborted || res.destroyed) abort();
    try {
      return await this.service.refineText(
        dto,
        req.user as SessionUser | undefined,
        controller.signal,
      );
    } finally {
      req.off('aborted', abort);
      res.off('close', abort);
    }
  }
}
