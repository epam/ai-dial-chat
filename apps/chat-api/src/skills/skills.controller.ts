import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
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
import { CreateSkillDto } from './dto/create-skill.dto';
import { ApiIfMatchHeader, IF_MATCH_HEADER } from './dto/skill-file-path.dto';
import {
  SkillFileListQueryDto,
  SkillListQueryDto,
} from './dto/skill-list-query.dto';
import {
  SkillFileListResponseDto,
  SkillListResponseDto,
} from './dto/skill-metadata.dto';
import {
  DeleteSkillDto,
  DeleteSkillFileDto,
  SkillFileDeleteResponseDto,
  SkillGroupingFolderDto,
  SkillGroupingFolderResponseDto,
  SkillOperationResultDto,
} from './dto/skill-mutation.dto';
import {
  SkillFileResourceQueryDto,
  SkillResourceQueryDto,
} from './dto/skill-resource-query.dto';
import {
  SkillFileUploadResponseDto,
  SkillUploadResponseDto,
} from './dto/skill-upload-response.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { UploadSkillFileDto } from './dto/upload-skill-file.dto';
import { SkillsService } from './skills.service';

interface UploadedMulterFile {
  buffer: Buffer;
  mimetype: string;
}

@ApiTags('skills')
@Controller({ path: 'skills', version: '1' })
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({
    operationId: 'listSkills',
    summary: 'List skills and grouping folders',
    description:
      'Proxies DIAL Core listSkillMetadata to list the grouping folders and skills at or under the given path.',
  })
  @ApiResponse({ status: 200, type: SkillListResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid bucket, path, or limit' })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Grouping folder not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  listSkills(
    @Query() query: SkillListQueryDto,
    @Req() req: Request,
  ): Promise<SkillListResponseDto> {
    const { at } = req.user as SessionUser;
    return this.skillsService.listSkills(
      query.bucket,
      query.path ?? '',
      { token: query.token, limit: query.limit, recursive: query.recursive },
      at,
    );
  }

  @Get('files')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({
    operationId: 'listSkillFiles',
    summary: 'List files inside a skill',
    description: 'Proxies DIAL Core listSkillFileMetadata.',
  })
  @ApiResponse({ status: 200, type: SkillFileListResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid bucket, path, or limit' })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Skill not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  listSkillFiles(
    @Query() query: SkillFileListQueryDto,
    @Req() req: Request,
  ): Promise<SkillFileListResponseDto> {
    const { at } = req.user as SessionUser;
    return this.skillsService.listSkillFiles(
      query.bucket,
      query.path ?? '',
      query.filePath,
      { token: query.token, limit: query.limit, recursive: query.recursive },
      at,
    );
  }

  @Get('download')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiProduces('application/zip')
  @ApiOperation({
    operationId: 'downloadSkill',
    summary: 'Download a whole skill as a ZIP archive',
    description:
      'Proxies DIAL Core downloadSkillFolder and streams the response. Returns 400 when the path resolves to a grouping folder instead of a skill.',
  })
  @ApiResponse({
    status: 200,
    description: 'Streamed application/zip archive',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid path, or the path is a grouping folder',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Skill not found' })
  @ApiResponse({ status: 405, description: 'Method not allowed' })
  @ApiResponse({ status: 422, description: 'Unprocessable entity' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  async downloadSkill(
    @Query() query: SkillResourceQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { at } = req.user as SessionUser;
    /*
     * Registered before the await so a client disconnect that happens while
     * skillsService.downloadSkill() is still resolving isn't missed — the
     * 'close' listener attached after an await can fire too late to catch a
     * disconnect that already occurred during that wait.
     */
    let clientDisconnected = false;
    res.on('close', () => {
      clientDisconnected = true;
    });

    const { stream, headers, abortOnDisconnect } =
      await this.skillsService.downloadSkill(query.bucket, query.path, at);

    if (clientDisconnected) {
      abortOnDisconnect();
      return;
    }

    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }

    res.on('close', () => {
      if (!res.writableEnded) {
        abortOnDisconnect();
      }
    });

    await pipeline(Readable.fromWeb(stream as ReadableStream), res).catch(
      () => {
        res.destroy();
      },
    );
  }

  @Get('files/download')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiProduces('application/octet-stream')
  @ApiOperation({
    operationId: 'downloadSkillFile',
    summary: 'Download one file from a skill',
    description:
      'Proxies DIAL Core downloadSkillFile and streams the response.',
  })
  @ApiResponse({
    status: 200,
    description: 'Streamed binary file content',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'File or skill not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  async downloadSkillFile(
    @Query() query: SkillFileResourceQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { at } = req.user as SessionUser;
    /*
     * Registered before the await so a client disconnect that happens while
     * skillsService.downloadSkillFile() is still resolving isn't missed —
     * see downloadSkill() above for the full rationale.
     */
    let clientDisconnected = false;
    res.on('close', () => {
      clientDisconnected = true;
    });

    const { stream, headers, abortOnDisconnect } =
      await this.skillsService.downloadSkillFile(
        query.bucket,
        query.path,
        query.filePath,
        at,
      );

    if (clientDisconnected) {
      abortOnDisconnect();
      return;
    }

    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }

    res.on('close', () => {
      if (!res.writableEnded) {
        abortOnDisconnect();
      }
    });

    await pipeline(Readable.fromWeb(stream as ReadableStream), res).catch(
      () => {
        res.destroy();
      },
    );
  }

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['bucket', 'path', 'skillManifest', 'filePaths'],
      properties: {
        bucket: { type: 'string', example: 'my-bucket' },
        path: { type: 'string', example: 'team-a/docs-helper' },
        skillManifest: {
          type: 'string',
          example:
            '---\nname: docs-helper\ndescription: Explains our docs\n---\n\n...',
        },
        filePaths: {
          type: 'string',
          example: '["scripts/run.sh","assets/icon.png"]',
        },
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiOperation({
    operationId: 'createSkill',
    summary: 'Create a new skill atomically',
    description:
      'Validates skillManifest/filePaths/files (path safety, reserved markers, duplicates, limits), builds one multipart part per file, and sends If-None-Match: * to DIAL Core uploadSkillFolder — no ZIP is ever constructed or forwarded.',
  })
  @ApiResponse({ status: 201, type: SkillUploadResponseDto })
  @ApiResponse({
    status: 400,
    description:
      'Invalid bucket/path, malformed filePaths, unsafe/reserved/duplicate supporting path, or DIAL Core rejected the manifest',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({
    status: 409,
    description: 'A skill already exists at this path',
  })
  @ApiResponse({
    status: 413,
    description: 'A file or the total content is too large',
  })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  createSkill(
    @UploadedFiles() files: UploadedMulterFile[],
    @Body() body: CreateSkillDto,
    @Req() req: Request,
  ): Promise<SkillUploadResponseDto> {
    const { at } = req.user as SessionUser;
    const abortController = new AbortController();
    req.on('close', () => abortController.abort());
    return this.skillsService.createSkill(
      body.bucket,
      body.path,
      body.skillManifest,
      body.filePaths,
      files,
      at,
      abortController.signal,
    );
  }

  @Put()
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiIfMatchHeader({ required: true })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['bucket', 'path', 'skillManifest', 'filePaths'],
      properties: {
        bucket: { type: 'string', example: 'my-bucket' },
        path: { type: 'string', example: 'team-a/docs-helper' },
        skillManifest: {
          type: 'string',
          example:
            '---\nname: docs-helper\ndescription: Explains our docs\n---\n\n...',
        },
        filePaths: {
          type: 'string',
          example: '["scripts/run.sh","assets/icon.png"]',
        },
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiOperation({
    operationId: 'updateSkill',
    summary: 'Update an existing skill, requiring a concrete If-Match',
    description:
      'Validates skillManifest/filePaths/files, builds one multipart part per file, and forwards the required If-Match to DIAL Core uploadSkillFolder — no ZIP is ever constructed or forwarded.',
  })
  @ApiResponse({ status: 200, type: SkillUploadResponseDto })
  @ApiResponse({
    status: 400,
    description:
      'Invalid bucket/path, malformed filePaths, unsafe/reserved/duplicate supporting path, or DIAL Core rejected the manifest',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Skill not found' })
  @ApiResponse({
    status: 412,
    description: 'If-Match precondition failed — stale edit',
  })
  @ApiResponse({
    status: 413,
    description: 'A file or the total content is too large',
  })
  @ApiResponse({
    status: 428,
    description: 'If-Match header is required for update',
  })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  updateSkill(
    @UploadedFiles() files: UploadedMulterFile[],
    @Body() body: UpdateSkillDto,
    @Req() req: Request,
  ): Promise<SkillUploadResponseDto> {
    const ifMatch = req.headers[IF_MATCH_HEADER] as string | undefined;
    if (ifMatch == null) {
      throw new HttpException(
        'If-Match header is required',
        HttpStatus.PRECONDITION_REQUIRED,
      );
    }
    const { at } = req.user as SessionUser;
    const abortController = new AbortController();
    req.on('close', () => abortController.abort());
    return this.skillsService.updateSkill(
      body.bucket,
      body.path,
      body.skillManifest,
      body.filePaths,
      files,
      ifMatch,
      at,
      abortController.signal,
    );
  }

  @Put('files')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiIfMatchHeader()
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'bucket', 'path', 'filePath'],
      properties: {
        file: { type: 'string', format: 'binary' },
        bucket: { type: 'string' },
        path: { type: 'string' },
        filePath: { type: 'string' },
      },
    },
  })
  @ApiOperation({
    operationId: 'uploadSkillFile',
    summary: 'Add or replace one file in a skill',
    description: 'Proxies DIAL Core uploadSkillFile.',
  })
  @ApiResponse({ status: 200, type: SkillFileUploadResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Invalid bucket/path/filePath, or unsafe/reserved filePath',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Skill not found' })
  @ApiResponse({ status: 405, description: 'Method not allowed' })
  @ApiResponse({ status: 412, description: 'If-Match precondition failed' })
  @ApiResponse({ status: 413, description: 'Upload payload too large' })
  @ApiResponse({ status: 422, description: 'Core resource validation failure' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  uploadSkillFile(
    @UploadedFile() file: UploadedMulterFile | undefined,
    @Body() body: UploadSkillFileDto,
    @Req() req: Request,
  ): Promise<SkillFileUploadResponseDto> {
    if (file == null) {
      throw new BadRequestException('file is required');
    }
    const { at } = req.user as SessionUser;
    const ifMatch = req.headers[IF_MATCH_HEADER] as string | undefined;
    const abortController = new AbortController();
    req.on('close', () => abortController.abort());
    return this.skillsService.uploadSkillFile(
      body.bucket,
      body.path,
      body.filePath,
      file,
      at,
      ifMatch,
      abortController.signal,
    );
  }

  @Delete()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiIfMatchHeader()
  @ApiOperation({
    operationId: 'deleteSkill',
    summary: 'Delete a whole skill',
    description: 'Proxies DIAL Core deleteSkillFolder.',
  })
  @ApiResponse({ status: 200, type: SkillOperationResultDto })
  @ApiResponse({ status: 400, description: 'Invalid bucket or path' })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Skill not found' })
  @ApiResponse({ status: 412, description: 'If-Match precondition failed' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  deleteSkill(
    @Query() query: DeleteSkillDto,
    @Req() req: Request,
  ): Promise<SkillOperationResultDto> {
    const { at } = req.user as SessionUser;
    const ifMatch = req.headers[IF_MATCH_HEADER] as string | undefined;
    return this.skillsService.deleteSkill(
      query.bucket,
      query.path,
      at,
      ifMatch,
    );
  }

  @Delete('files')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiIfMatchHeader()
  @ApiOperation({
    operationId: 'deleteSkillFile',
    summary: 'Delete one file from a skill',
    description:
      'Proxies DIAL Core deleteSkillFile. Rejects deleting SKILL.md.',
  })
  @ApiResponse({ status: 200, type: SkillFileDeleteResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Invalid bucket/path/filePath, or filePath is SKILL.md',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'File or skill not found' })
  @ApiResponse({ status: 412, description: 'If-Match precondition failed' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  deleteSkillFile(
    @Query() query: DeleteSkillFileDto,
    @Req() req: Request,
  ): Promise<SkillFileDeleteResponseDto> {
    const { at } = req.user as SessionUser;
    const ifMatch = req.headers[IF_MATCH_HEADER] as string | undefined;
    return this.skillsService.deleteSkillFile(
      query.bucket,
      query.path,
      query.filePath,
      at,
      ifMatch,
    );
  }

  @Post('grouping-folders')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    operationId: 'createSkillGroupingFolder',
    summary: 'Create a grouping folder',
    description:
      'Proxies DIAL Core createSkillGroupingFolder. Accepts no conditional request headers — the verified SDK schema declares none for this operation.',
  })
  @ApiResponse({ status: 200, type: SkillGroupingFolderResponseDto })
  @ApiResponse({
    status: 400,
    description:
      'Invalid bucket/path, or the folder already exists (collision)',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Parent path not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  createSkillGroupingFolder(
    @Query() query: SkillGroupingFolderDto,
    @Req() req: Request,
  ): Promise<SkillGroupingFolderResponseDto> {
    const { at } = req.user as SessionUser;
    return this.skillsService.createSkillGroupingFolder(
      query.bucket,
      query.path,
      at,
    );
  }

  @Delete('grouping-folders')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiIfMatchHeader()
  @ApiOperation({
    operationId: 'deleteSkillGroupingFolder',
    summary: 'Delete an empty grouping folder',
    description: 'Proxies DIAL Core deleteSkillGroupingFolder.',
  })
  @ApiResponse({ status: 200, type: SkillOperationResultDto })
  @ApiResponse({ status: 400, description: 'Invalid bucket or path' })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Grouping folder not found' })
  @ApiResponse({ status: 409, description: 'Grouping folder is not empty' })
  @ApiResponse({ status: 412, description: 'If-Match precondition failed' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  deleteSkillGroupingFolder(
    @Query() query: SkillGroupingFolderDto,
    @Req() req: Request,
  ): Promise<SkillOperationResultDto> {
    const { at } = req.user as SessionUser;
    const ifMatch = req.headers[IF_MATCH_HEADER] as string | undefined;
    return this.skillsService.deleteSkillGroupingFolder(
      query.bucket,
      query.path,
      at,
      ifMatch,
    );
  }
}
