import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { CreatePromptFolderDto } from './dto/create-prompt-folder.dto';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { MovePromptDto } from './dto/move-prompt.dto';
import { PromptFolderResponseDto } from './dto/prompt-folder-response.dto';
import { PromptListResponseDto } from './dto/prompt-list-response.dto';
import { PromptResponseDto } from './dto/prompt-response.dto';
import { PublicPromptListResponseDto } from './dto/public-prompt-list-response.dto';
import { RenamePromptFolderDto } from './dto/rename-prompt-folder.dto';
import { RequiredPromptPathDto } from './dto/required-prompt-path.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';
import { PromptService } from './prompt.service';

@ApiTags('prompts')
@Controller({ path: 'prompts', version: '1' })
export class PromptController {
  constructor(private readonly promptService: PromptService) {}

  /* ------------------------------------------------------------------ */
  /* Personal prompts                                                     */
  /* ------------------------------------------------------------------ */

  @Get()
  @ApiOperation({
    operationId: 'listPrompts',
    summary: 'List personal prompts',
    description: 'Returns all personal prompts and the folder hierarchy.',
  })
  @ApiResponse({
    status: 200,
    description: 'Prompts returned',
    type: PromptListResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 502, description: 'DIAL Core error' })
  listPrompts(@Req() req: Request) {
    const { at, bucket } = req.user as SessionUser;
    return this.promptService.listPrompts(at, bucket);
  }

  @Get('item')
  @ApiOperation({
    operationId: 'getPrompt',
    summary: 'Get a personal prompt',
  })
  @ApiResponse({
    status: 200,
    description: 'Prompt returned',
    type: PromptResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Prompt not found' })
  @ApiResponse({ status: 502, description: 'DIAL Core error' })
  getPrompt(@Req() req: Request, @Query() query: RequiredPromptPathDto) {
    const { at, bucket } = req.user as SessionUser;
    return this.promptService.getPrompt(at, bucket, query.path);
  }

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    operationId: 'createPrompt',
    summary: 'Create a personal prompt',
  })
  @ApiResponse({
    status: 201,
    description: 'Prompt created',
    type: PromptResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 409,
    description: 'Prompt already exists at that path',
  })
  @ApiResponse({ status: 502, description: 'DIAL Core error' })
  createPrompt(@Req() req: Request, @Body() dto: CreatePromptDto) {
    const { at, bucket } = req.user as SessionUser;
    return this.promptService.createPrompt(at, bucket, dto);
  }

  @Put()
  @ApiOperation({
    operationId: 'updatePrompt',
    summary: 'Update a personal prompt',
  })
  @ApiQuery({
    name: 'path',
    required: true,
    description: 'Prompt path to update',
  })
  @ApiResponse({
    status: 200,
    description: 'Prompt updated',
    type: PromptResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Prompt not found' })
  @ApiResponse({ status: 409, description: 'Rename target already exists' })
  @ApiResponse({ status: 502, description: 'DIAL Core error' })
  updatePrompt(
    @Req() req: Request,
    @Query() query: RequiredPromptPathDto,
    @Body() dto: UpdatePromptDto,
  ) {
    const { at, bucket } = req.user as SessionUser;
    return this.promptService.updatePrompt(at, bucket, query.path, dto);
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({
    operationId: 'deletePrompt',
    summary: 'Delete a personal prompt',
  })
  @ApiQuery({
    name: 'path',
    required: true,
    description: 'Prompt path to delete',
  })
  @ApiResponse({ status: 204, description: 'Prompt deleted' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Prompt not found' })
  @ApiResponse({ status: 502, description: 'DIAL Core error' })
  deletePrompt(@Req() req: Request, @Query() query: RequiredPromptPathDto) {
    const { at, bucket } = req.user as SessionUser;
    return this.promptService.deletePrompt(at, bucket, query.path);
  }

  /* ------------------------------------------------------------------ */
  /* Organisation (public) prompts                                        */
  /* ------------------------------------------------------------------ */

  @Get('public')
  @ApiOperation({
    operationId: 'listPublicPrompts',
    summary: 'List organisation prompts',
  })
  @ApiResponse({
    status: 200,
    description: 'Prompts returned',
    type: PublicPromptListResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 502, description: 'DIAL Core error' })
  listPublicPrompts(@Req() req: Request) {
    const { at } = req.user as SessionUser;
    return this.promptService.listPublicPrompts(at);
  }

  @Get('public/item')
  @ApiOperation({
    operationId: 'getPublicPrompt',
    summary: 'Get an organisation prompt',
  })
  @ApiResponse({
    status: 200,
    description: 'Prompt returned',
    type: PromptResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Prompt not found' })
  @ApiResponse({ status: 502, description: 'DIAL Core error' })
  getPublicPrompt(@Req() req: Request, @Query() query: RequiredPromptPathDto) {
    const { at } = req.user as SessionUser;
    return this.promptService.getPublicPrompt(at, query.path);
  }

  /* ------------------------------------------------------------------ */
  /* Folders                                                              */
  /* ------------------------------------------------------------------ */

  @Post('folders')
  @HttpCode(201)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    operationId: 'createPromptFolder',
    summary: 'Create a prompt folder',
  })
  @ApiResponse({
    status: 201,
    description: 'Folder created',
    type: PromptFolderResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Folder already exists' })
  @ApiResponse({ status: 502, description: 'DIAL Core error' })
  createFolder(@Req() req: Request, @Body() dto: CreatePromptFolderDto) {
    const { at, bucket } = req.user as SessionUser;
    return this.promptService.createFolder(at, bucket, dto);
  }

  @Put('folders')
  @ApiOperation({
    operationId: 'renamePromptFolder',
    summary: 'Rename a prompt folder',
  })
  @ApiQuery({
    name: 'path',
    required: true,
    description: 'Folder path to rename',
  })
  @ApiResponse({
    status: 200,
    description: 'Folder renamed',
    type: PromptFolderResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  @ApiResponse({ status: 409, description: 'Target folder already exists' })
  @ApiResponse({ status: 502, description: 'DIAL Core error' })
  renameFolder(
    @Req() req: Request,
    @Query() query: RequiredPromptPathDto,
    @Body() dto: RenamePromptFolderDto,
  ) {
    const { at, bucket } = req.user as SessionUser;
    return this.promptService.renameFolder(at, bucket, query.path, dto);
  }

  @Delete('folders')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'deletePromptFolder',
    summary: 'Delete a prompt folder',
  })
  @ApiQuery({
    name: 'path',
    required: true,
    description: 'Folder path to delete',
  })
  @ApiResponse({ status: 204, description: 'Folder deleted' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  @ApiResponse({ status: 502, description: 'DIAL Core error' })
  deleteFolder(@Req() req: Request, @Query() query: RequiredPromptPathDto) {
    const { at, bucket } = req.user as SessionUser;
    return this.promptService.deleteFolder(at, bucket, query.path);
  }

  @Post('move')
  @HttpCode(200)
  @ApiOperation({ summary: 'Move a personal prompt to a different folder' })
  @ApiQuery({
    name: 'path',
    required: true,
    description: 'Prompt path to move',
  })
  @ApiResponse({
    status: 200,
    description: 'Prompt moved',
    type: PromptResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Prompt not found' })
  @ApiResponse({ status: 409, description: 'Target path already exists' })
  @ApiResponse({ status: 502, description: 'DIAL Core error' })
  movePrompt(
    @Req() req: Request,
    @Query() query: RequiredPromptPathDto,
    @Body() dto: MovePromptDto,
  ) {
    const { at, bucket } = req.user as SessionUser;
    return this.promptService.movePrompt(at, bucket, query.path, dto);
  }
}
