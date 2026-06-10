import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { DownloadFileDto } from './dto/download-file.dto';
import { FileUploadResponseDto } from './dto/upload-file-response.dto';
import { UploadFileDto } from './dto/upload-file.dto';
import { FilesService } from './files.service';

@ApiTags('files')
@Controller({ path: 'files', version: '1' })
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'bucket', 'path'],
      properties: {
        file: { type: 'string', format: 'binary' },
        bucket: { type: 'string' },
        path: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 201, type: FileUploadResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid bucket or path' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 413, description: 'Payload too large' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 502, description: 'DIAL Core returned an error' })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core unreachable or timed out',
  })
  uploadFile(
    @UploadedFile() file: { buffer: Buffer; mimetype: string },
    @Body() body: UploadFileDto,
    @Req() req: Request,
  ): Promise<FileUploadResponseDto> {
    const { at } = req.user as SessionUser;
    return this.filesService.uploadFile(body.bucket, body.path, file, at);
  }

  @Get('download')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiProduces('application/octet-stream')
  @ApiResponse({
    status: 200,
    description: 'Binary file content',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiResponse({ status: 400, description: 'Invalid bucket or path' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'File not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 502, description: 'DIAL Core returned an error' })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core unreachable or timed out',
  })
  async downloadFile(
    @Query() query: DownloadFileDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { at } = req.user as SessionUser;
    const { stream, headers } = await this.filesService.downloadFile(
      query.bucket,
      query.path,
      at,
    );

    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }

    await pipeline(Readable.fromWeb(stream as ReadableStream), res).catch(() => {
      res.destroy();
    });
  }
}
