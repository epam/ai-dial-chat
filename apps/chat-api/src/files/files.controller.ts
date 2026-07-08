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
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { CopyFilesDto, CopyFilesResponseDto } from './dto/copy-files.dto';
import {
  CreateFolderDto,
  CreateFolderResponseDto,
} from './dto/create-folder.dto';
import { DeleteFilesDto, DeleteFilesResponseDto } from './dto/delete-files.dto';
import { DownloadArchiveDto } from './dto/download-archive.dto';
import { DownloadFileDto } from './dto/download-file.dto';
import { FileMetadataResponseDto } from './dto/file-metadata-response.dto';
import { GetFileMetadataQueryDto } from './dto/get-file-metadata.dto';
import {
  ListFilesQueryDto,
  ListFilesResponseDto,
  ListPublicFilesQueryDto,
  ListSharedFilesQueryDto,
} from './dto/list-files.dto';
import { MoveFilesDto, MoveFilesResponseDto } from './dto/move-files.dto';
import { RenameFilesDto, RenameFilesResponseDto } from './dto/rename-files.dto';
import { FileUploadResponseDto } from './dto/upload-file-response.dto';
import { UploadFileDto } from './dto/upload-file.dto';
import { FilesService } from './files.service';

@ApiTags('files')
@Controller({ path: 'files', version: '1' })
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 100, ttl: 60000 } })
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
        uploadMode: {
          type: 'string',
          enum: ['overwrite', 'create-only'],
          description:
            "Optional upload mode. 'overwrite' (default) overwrites; 'create-only' fails with 409 if file exists.",
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: FileUploadResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid bucket or path' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({
    status: 409,
    description: 'File already exists (create-only mode)',
  })
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
    return this.filesService.uploadFile(
      body.bucket,
      body.path,
      file,
      at,
      body.uploadMode,
    );
  }

  @Get('list')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({
    summary: 'List files and folders',
    description:
      'Returns a page of file and folder items from DIAL Core storage, normalized for FileManager compatibility.',
  })
  @ApiResponse({
    status: 200,
    type: ListFilesResponseDto,
    description: 'Paginated list of files and folders',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid bucket, path, or query parameter',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — user does not own the bucket',
  })
  @ApiResponse({ status: 404, description: 'Bucket or path not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 502, description: 'DIAL Core returned an error' })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core unreachable or timed out',
  })
  async listFiles(
    @Query() query: ListFilesQueryDto,
    @Req() req: Request,
  ): Promise<ListFilesResponseDto> {
    const { at } = req.user as SessionUser;
    return this.filesService.listFiles(
      query.bucket,
      query.path,
      {
        token: query.token,
        limit: query.limit,
        recursive: query.recursive,
        permissions: query.permissions,
      },
      at,
    );
  }

  @Get('public')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({
    summary: 'List files from the organization (public) bucket',
    description:
      'Returns files from the fixed public bucket. Permissions are always false — users cannot write to the public bucket.',
    operationId: 'listPublicFiles',
  })
  @ApiResponse({
    status: 200,
    type: ListFilesResponseDto,
    description: 'Paginated list of files from the public bucket',
  })
  @ApiResponse({ status: 400, description: 'Invalid path or query parameter' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Path not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 502, description: 'DIAL Core returned an error' })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core unreachable or timed out',
  })
  async listPublicFiles(
    @Query() query: ListPublicFilesQueryDto,
    @Req() req: Request,
  ): Promise<ListFilesResponseDto> {
    const { at } = req.user as SessionUser;
    return this.filesService.listPublicFiles(
      {
        path: query.path,
        token: query.token,
        limit: query.limit,
        recursive: query.recursive,
      },
      at,
    );
  }

  @Get('shared')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({
    summary: 'List files shared with the current user',
    description:
      'Proxies the DIAL Core sharing API to return files shared with the authenticated user.',
    operationId: 'listSharedFiles',
  })
  @ApiResponse({
    status: 200,
    type: ListFilesResponseDto,
    description: 'Files shared with the current user',
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameter' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 502, description: 'DIAL Core returned an error' })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core unreachable or timed out',
  })
  async listSharedFiles(
    @Query() query: ListSharedFilesQueryDto,
    @Req() req: Request,
  ): Promise<ListFilesResponseDto> {
    const { at } = req.user as SessionUser;
    return this.filesService.listSharedFiles(
      {
        path: query.path,
        token: query.token,
        limit: query.limit,
      },
      at,
    );
  }

  @Get('metadata')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({
    summary: 'Get file metadata',
    description:
      'Returns metadata for a single named file from DIAL Core. Path must not end with /.',
  })
  @ApiResponse({
    status: 200,
    type: FileMetadataResponseDto,
    description: 'File metadata',
  })
  @ApiResponse({ status: 400, description: 'Invalid bucket or path' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — user lacks READ permission on the file',
  })
  @ApiResponse({ status: 404, description: 'File not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 502, description: 'DIAL Core returned an error' })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core unreachable or timed out',
  })
  async getFileMetadata(
    @Query() query: GetFileMetadataQueryDto,
    @Req() req: Request,
  ): Promise<FileMetadataResponseDto> {
    const { at } = req.user as SessionUser;
    return this.filesService.getFileMetadata(query.bucket, query.path, at);
  }

  @Post('folders')
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Create a folder' })
  @ApiResponse({ status: 201, type: CreateFolderResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid bucket, path, or name' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Bucket or parent path not found' })
  @ApiResponse({ status: 409, description: 'Folder already exists' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 502, description: 'DIAL Core returned an error' })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core unreachable or timed out',
  })
  createFolder(
    @Body() body: CreateFolderDto,
    @Req() req: Request,
  ): Promise<CreateFolderResponseDto> {
    const { at } = req.user as SessionUser;
    return this.filesService.createFolder(
      body.bucket,
      body.parentPath ?? '',
      body.name,
      at,
    );
  }

  @Post('download-archive')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiProduces('application/zip')
  @ApiOperation({ summary: 'Download files and folders as a ZIP archive' })
  @ApiResponse({
    status: 200,
    description: 'Streamed ZIP archive',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'File or folder not found' })
  @ApiResponse({
    status: 413,
    description: 'Too many items or archive too large',
  })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 502, description: 'DIAL Core returned an error' })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core unreachable or timed out',
  })
  async downloadArchive(
    @Body() body: DownloadArchiveDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { at } = req.user as SessionUser;
    await this.filesService.downloadArchive(body.items, at, res);
  }

  @Post('delete')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Delete files and folders' })
  @ApiBody({ type: DeleteFilesDto })
  @ApiResponse({ status: 200, type: DeleteFilesResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 502, description: 'DIAL Core returned an error' })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core unreachable or timed out',
  })
  async deleteFiles(
    @Body() body: DeleteFilesDto,
    @Req() req: Request,
  ): Promise<DeleteFilesResponseDto> {
    const { at } = req.user as SessionUser;
    return this.filesService.deleteFiles(body.items, at);
  }

  @Post('rename')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Rename files and folders' })
  @ApiBody({ type: RenameFilesDto })
  @ApiResponse({ status: 200, type: RenameFilesResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 502, description: 'DIAL Core returned an error' })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core unreachable or timed out',
  })
  async renameFiles(
    @Body() body: RenameFilesDto,
    @Req() req: Request,
  ): Promise<RenameFilesResponseDto> {
    const { at } = req.user as SessionUser;
    return this.filesService.renameFiles(body.items, at);
  }

  @Post('copy')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Copy files and folders' })
  @ApiBody({ type: CopyFilesDto })
  @ApiResponse({ status: 200, type: CopyFilesResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 502, description: 'DIAL Core returned an error' })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core unreachable or timed out',
  })
  async copyFiles(
    @Body() body: CopyFilesDto,
    @Req() req: Request,
  ): Promise<CopyFilesResponseDto> {
    const { at } = req.user as SessionUser;
    return this.filesService.copyFiles(body.items, at);
  }

  @Post('move')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Move files and folders across folders' })
  @ApiBody({ type: MoveFilesDto })
  @ApiResponse({ status: 200, type: MoveFilesResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 502, description: 'DIAL Core returned an error' })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core unreachable or timed out',
  })
  async moveFiles(
    @Body() body: MoveFilesDto,
    @Req() req: Request,
  ): Promise<MoveFilesResponseDto> {
    const { at } = req.user as SessionUser;
    return this.filesService.moveFiles(body.items, at);
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

    await pipeline(Readable.fromWeb(stream as ReadableStream), res).catch(
      () => {
        res.destroy();
      },
    );
  }
}
