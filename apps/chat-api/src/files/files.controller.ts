import {
  Controller,
  Get,
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
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { FileUploadResponseDto } from './dto/file-upload-response.dto';
import { FilesService } from './files.service';

const MAX_FILE_SIZE = parseInt(
  process.env['MAX_FILE_SIZE_BYTES'] ?? String(512 * 1024 * 1024),
  10,
);

@ApiTags('files')
@Controller({ path: 'files', version: '1' })
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiOperation({
    summary: 'Upload a file',
    description:
      'Uploads a file to the user bucket under uploads/{yyyy-mm-dd}/. Deduplicates filenames automatically.',
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
    type: FileUploadResponseDto,
  })
  @ApiResponse({ status: 400, description: 'No file provided' })
  @ApiResponse({ status: 413, description: 'File too large' })
  uploadFile(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<FileUploadResponseDto> {
    const { at, bucket } = req.user as SessionUser;
    return this.filesService.uploadFile(at, bucket, file);
  }

  @Get()
  @ApiOperation({
    summary: 'Get a DIAL file',
    description:
      'Fetches a DIAL file server-side (with user auth) and streams it to the browser.',
  })
  @ApiQuery({
    name: 'url',
    description: 'DIAL file URL to fetch',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'File content' })
  @ApiResponse({ status: 400, description: 'Missing url param' })
  @ApiResponse({ status: 502, description: 'DIAL Core error' })
  async proxyFile(
    @Req() req: Request,
    @Res() res: Response,
    @Query('url') fileUrl: string,
  ): Promise<void> {
    const { at } = req.user as SessionUser;
    await this.filesService.getFile(at, fileUrl, res);
  }
}
