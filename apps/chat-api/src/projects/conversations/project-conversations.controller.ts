import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { FeatureKey } from '../../app-config/feature-flags/feature-key.enum';
import { FeatureGuard } from '../../app-config/feature-flags/feature.guard';
import { RequireFeature } from '../../app-config/feature-flags/require-feature.decorator';
import type { SessionUser } from '../../auth/session/session.types';
import { ApiDialCoreErrors } from '../../common/dial/api-dial-core-errors.decorator';
import { AttachGenerationDto } from '../../conversations/dto/attach-generation.dto';
import { CreateConversationDto } from '../../conversations/dto/create-conversation.dto';
import { GenerateTitleResponseDto } from '../../conversations/dto/generate-title.dto';
import {
  RenameConversationBodyDto,
  RenameConversationResponseDto,
} from '../../conversations/dto/rename-conversation.dto';
import { SaveConversationBodyDto } from '../../conversations/dto/save-conversation.dto';
import { SendCompletionDto } from '../../conversations/dto/send-completion.dto';
import { StopCompletionDto } from '../../conversations/dto/stop-completion.dto';
import { ConversationCompletionsResponder } from '../../conversations/streaming/conversation-completions.responder';
import { LANG_HEADER } from '../../conversations/utils/lang-header';
import { TIMEZONE_HEADER } from '../../conversations/utils/timezone-header';
import { ConversationResponseDto } from '../../openapi/openapi-response.dto';
import { ProjectAccessService } from '../access/project-access.service';
import { ProjectCreateErrorDto } from '../dto/project-create-error.dto';
import {
  PROJECT_ID_PARAM,
  ProjectIdParamDto,
} from '../dto/project-id-param.dto';
import { requireProjectId } from '../projects.service';
import { ProjectConversationListResponseDto } from './dto/project-conversation-list-response.dto';
import { ProjectConversationParamDto } from './dto/project-conversation-param.dto';
import {
  PROJECT_CONVERSATION_TITLES_MAX_NAMES,
  ProjectConversationTitlesBodyDto,
  ProjectConversationTitlesResponseDto,
} from './dto/project-conversation-titles.dto';
import { ProjectConversationsService } from './project-conversations.service';

const CONVERSATION_NAME_PARAM = {
  name: 'conversationName',
  description:
    'File name of the conversation under the project `conversations/` folder, URL-encoded.',
  example: 'gpt-4o__Weekly%20support%20health%20summary__7c1d',
};

const WRITE_FORBIDDEN =
  'The projectsEnabled feature is not enabled for this user, the caller may not write to the project (`canEdit: false`: a view-only share or an organization project), or DIAL Core denied access';
const READ_FORBIDDEN =
  'The projectsEnabled feature is not enabled for this user, or DIAL Core denied read access';
const COMPLETION_PATH_INVALID =
  'Invalid body, or `path` does not name a conversation of the addressed project';

/**
 * Conversations stored inside a project, under the project's base path.
 * Reads work for anyone Core lets read the project; writes and completions
 * are owner-only and refused before any Core call. Completions, stop and
 * attach reuse the conversation pipeline through
 * `ConversationCompletionsResponder`, so they stream exactly as
 * `/api/v1/conversations/completions…` does; their body `path` is the
 * conversation locator without `projects/`.
 */
@ApiTags('projects')
@Controller({ path: 'projects', version: '1' })
@UseGuards(FeatureGuard)
@RequireFeature(FeatureKey.ProjectsEnabled)
export class ProjectConversationsController {
  constructor(
    private readonly conversationsService: ProjectConversationsService,
    private readonly completionsResponder: ConversationCompletionsResponder,
    private readonly accessService: ProjectAccessService,
  ) {}

  @Get(':id/conversations')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'listProjectConversations',
    summary: "List a project's conversations",
    description:
      "Lists every conversation stored in the project's `conversations/` folder, newest first, with their authors. DIAL Core cannot page the folder in this order, so the list is not paged; the client pages it locally. Bodies are read for the 20 newest conversations only: the others have a cached title or carry `isTitlePending`, which `POST /api/v1/projects/:id/conversations/titles` resolves.",
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description:
      'The conversations; a project without conversations lists none',
    type: ProjectConversationListResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid id' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: READ_FORBIDDEN })
  @ApiResponse({ status: 404, description: 'The project does not exist' })
  listProjectConversations(
    @Param() { id }: ProjectIdParamDto,
    @Req() req: Request,
  ): Promise<ProjectConversationListResponseDto> {
    const { at, bucket } = req.user as SessionUser;
    return this.conversationsService.listConversations(
      requireProjectId(id),
      at,
      bucket,
    );
  }

  @Post(':id/conversations/titles')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getProjectConversationTitles',
    summary: "Resolve project conversations' titles",
    description: `Reads the bodies of the named conversations, as listed with \`isTitlePending\`, and returns them with their titles and read state resolved. Up to ${PROJECT_CONVERSATION_TITLES_MAX_NAMES} names per request. Any reader of the project may call it.`,
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description:
      'The named conversations the project holds, in request order; unknown names are omitted',
    type: ProjectConversationTitlesResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid id or body' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: READ_FORBIDDEN })
  @ApiResponse({ status: 404, description: 'The project does not exist' })
  getProjectConversationTitles(
    @Param() { id }: ProjectIdParamDto,
    @Body() { names }: ProjectConversationTitlesBodyDto,
    @Req() req: Request,
  ): Promise<ProjectConversationTitlesResponseDto> {
    const { at, bucket } = req.user as SessionUser;
    return this.conversationsService.resolveConversations(
      requireProjectId(id),
      names,
      at,
      bucket,
    );
  }

  @Post(':id/conversations')
  @HttpCode(201)
  @ApiOperation({
    operationId: 'createProjectConversation',
    summary: 'Create a project conversation',
    description:
      'Creates a conversation inside the project from its first message, as `POST /api/v1/conversations` does at the top level.',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 201,
    description: 'The conversation was created',
    type: ConversationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid id or body' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: WRITE_FORBIDDEN })
  @ApiResponse({ status: 404, description: 'The project does not exist' })
  @ApiResponse({
    status: 413,
    description:
      'The project has no room for the conversation (project-storage-full)',
    type: ProjectCreateErrorDto,
  })
  createProjectConversation(
    @Param() { id }: ProjectIdParamDto,
    @Body() dto: CreateConversationDto,
    @Req() req: Request,
  ): Promise<ConversationResponseDto> {
    const { at, bucket } = req.user as SessionUser;
    return this.conversationsService.createConversation(
      requireProjectId(id),
      dto,
      at,
      bucket,
    );
  }

  @Post(':id/conversations/completions')
  @HttpCode(200)
  @ApiProduces('text/event-stream')
  @ApiOperation({
    operationId: 'streamProjectCompletion',
    summary: 'Stream a completion of a project conversation',
    description:
      'Streams a completion as SSE exactly as `POST /api/v1/conversations/completions` does, with the `x-project-id` header on the model call and nothing else added to the request.',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'SSE stream of completion chunks',
    content: { 'text/event-stream': { schema: { type: 'string' } } },
  })
  @ApiResponse({ status: 400, description: COMPLETION_PATH_INVALID })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: WRITE_FORBIDDEN })
  @ApiResponse({
    status: 404,
    description: 'The project or the conversation does not exist',
  })
  @ApiResponse({
    status: 409,
    description:
      'Another generation is already active for this conversation, or it has a pending background answer',
  })
  async streamProjectCompletion(
    @Param() { id }: ProjectIdParamDto,
    @Req() req: Request,
    @Res() res: Response,
    @Body() dto: SendCompletionDto,
    @Headers(TIMEZONE_HEADER) timezoneHeader: string | string[] | undefined,
    @Headers(LANG_HEADER) langHeader: string | string[] | undefined,
  ): Promise<void> {
    const locator = await this.resolveWritableLocator(id, dto.path, req);
    return this.completionsResponder.streamCompletion(
      req,
      res,
      dto,
      timezoneHeader,
      langHeader,
      locator,
    );
  }

  @Post(':id/conversations/completions/stop')
  @ApiOperation({
    operationId: 'stopProjectCompletion',
    summary: 'Stop a generation of a project conversation',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiResponse({ status: 204, description: 'Generation stopped successfully' })
  @ApiResponse({ status: 400, description: COMPLETION_PATH_INVALID })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: WRITE_FORBIDDEN })
  @ApiResponse({
    status: 404,
    description:
      'No active generation found for this principal for the given path and generationId',
  })
  @ApiResponse({
    status: 503,
    description:
      'The stopped state of a background generation could not be saved; Stop can be retried',
  })
  async stopProjectCompletion(
    @Param() { id }: ProjectIdParamDto,
    @Req() req: Request,
    @Res() res: Response,
    @Body() dto: StopCompletionDto,
  ): Promise<void> {
    const locator = await this.resolveWritableLocator(id, dto.path, req);
    return this.completionsResponder.stopCompletion(req, res, dto, locator);
  }

  @Post(':id/conversations/completions/attach')
  @HttpCode(200)
  @ApiProduces('text/event-stream')
  @ApiOperation({
    operationId: 'attachToProjectGeneration',
    summary: 'Attach to a generation of a project conversation',
    description:
      'Replays the active generation of a project conversation as SSE, exactly as `POST /api/v1/conversations/completions/attach` does.',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiResponse({
    status: 200,
    description:
      'SSE stream: one snapshot event, live chunk events, then one terminal event',
    content: { 'text/event-stream': { schema: { type: 'string' } } },
  })
  @ApiResponse({ status: 400, description: COMPLETION_PATH_INVALID })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: WRITE_FORBIDDEN })
  @ApiResponse({
    status: 404,
    description: 'No active generation found for the given path',
  })
  async attachToProjectGeneration(
    @Param() { id }: ProjectIdParamDto,
    @Req() req: Request,
    @Res() res: Response,
    @Body() dto: AttachGenerationDto,
  ): Promise<void> {
    const locator = await this.resolveWritableLocator(id, dto.path, req);
    return this.completionsResponder.attachToGeneration(req, res, dto, locator);
  }

  @Get(':id/conversations/:conversationName')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getProjectConversation',
    summary: 'Get a project conversation',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiParam(CONVERSATION_NAME_PARAM)
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'The conversation',
    type: ConversationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid id or conversation name' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: READ_FORBIDDEN })
  @ApiResponse({
    status: 404,
    description: 'The project or the conversation does not exist',
  })
  getProjectConversation(
    @Param() { id, conversationName }: ProjectConversationParamDto,
    @Req() req: Request,
  ): Promise<ConversationResponseDto> {
    const { at, bucket } = req.user as SessionUser;
    return this.conversationsService.getConversation(
      requireProjectId(id),
      conversationName,
      at,
      bucket,
    );
  }

  @Put(':id/conversations/:conversationName')
  @ApiOperation({
    operationId: 'saveProjectConversation',
    summary: 'Save a project conversation',
    description:
      'Overwrites the conversation body, never over a pending background answer, as `PUT /api/v1/conversations` does.',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiParam(CONVERSATION_NAME_PARAM)
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'The conversation was saved',
    type: ConversationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid id, conversation name or body',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: WRITE_FORBIDDEN })
  @ApiResponse({
    status: 404,
    description: 'The project or the conversation does not exist',
  })
  @ApiResponse({
    status: 409,
    description: 'The conversation has a pending background answer',
  })
  @ApiResponse({
    status: 413,
    description:
      'The project has no room for the conversation (project-storage-full)',
    type: ProjectCreateErrorDto,
  })
  saveProjectConversation(
    @Param() { id, conversationName }: ProjectConversationParamDto,
    @Body() body: SaveConversationBodyDto,
    @Req() req: Request,
  ): Promise<ConversationResponseDto> {
    const { at, bucket } = req.user as SessionUser;
    return this.conversationsService.saveConversation(
      requireProjectId(id),
      conversationName,
      body.conversation,
      at,
      bucket,
    );
  }

  @Patch(':id/conversations/:conversationName')
  @ApiOperation({
    operationId: 'renameProjectConversation',
    summary: 'Rename a project conversation',
    description:
      "Rewrites the conversation's display name; its file name does not change.",
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiParam(CONVERSATION_NAME_PARAM)
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'The conversation was renamed',
    type: RenameConversationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid id, conversation name or newTitle',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: WRITE_FORBIDDEN })
  @ApiResponse({
    status: 404,
    description: 'The project or the conversation does not exist',
  })
  @ApiResponse({
    status: 409,
    description: 'The conversation has a pending background answer',
  })
  renameProjectConversation(
    @Param() { id, conversationName }: ProjectConversationParamDto,
    @Body() body: RenameConversationBodyDto,
    @Req() req: Request,
  ): Promise<RenameConversationResponseDto> {
    const { at, bucket } = req.user as SessionUser;
    return this.conversationsService.renameConversation(
      requireProjectId(id),
      conversationName,
      body.newTitle,
      at,
      bucket,
    );
  }

  @Post(':id/conversations/:conversationName/generate-title')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'generateProjectConversationTitle',
    summary:
      'Generate an LLM-based title suggestion for a project conversation',
    description:
      'Generates a title with the operator-configured utility model from the most recent messages. The suggestion is returned but NOT persisted; the caller confirms the rename separately.',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiParam(CONVERSATION_NAME_PARAM)
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'Generated title suggestion',
    type: GenerateTitleResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid id or conversation name, or no content to title',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: WRITE_FORBIDDEN })
  @ApiResponse({
    status: 404,
    description: 'The project or the conversation does not exist',
  })
  @ApiResponse({ status: 502, description: 'LLM title generation failed' })
  @ApiResponse({
    status: 503,
    description: 'LLM title generation unavailable or timed out',
  })
  async generateProjectConversationTitle(
    @Param() { id, conversationName }: ProjectConversationParamDto,
    @Req() req: Request,
  ): Promise<GenerateTitleResponseDto> {
    const { at, bucket } = req.user as SessionUser;
    const name = await this.conversationsService.generateTitle(
      requireProjectId(id),
      conversationName,
      at,
      bucket,
    );
    return { name };
  }

  @Delete(':id/conversations/:conversationName')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'deleteProjectConversation',
    summary: 'Delete a project conversation',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiParam(CONVERSATION_NAME_PARAM)
  @ApiDialCoreErrors()
  @ApiResponse({ status: 204, description: 'The conversation was deleted' })
  @ApiResponse({ status: 400, description: 'Invalid id or conversation name' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: WRITE_FORBIDDEN })
  @ApiResponse({
    status: 404,
    description: 'The project or the conversation does not exist',
  })
  deleteProjectConversation(
    @Param() { id, conversationName }: ProjectConversationParamDto,
    @Req() req: Request,
  ): Promise<void> {
    const { at, bucket } = req.user as SessionUser;
    return this.conversationsService.deleteConversation(
      requireProjectId(id),
      conversationName,
      at,
      bucket,
    );
  }

  @Patch(':id/conversations/:conversationName/viewed')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'markProjectConversationViewed',
    summary: 'Mark a project conversation as viewed',
    description:
      "Records the conversation's current version as seen by the caller, in the caller's own read state, so it is not reported unread until it changes. Any reader of the project may call it.",
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiParam(CONVERSATION_NAME_PARAM)
  @ApiDialCoreErrors()
  @ApiResponse({ status: 204, description: 'Conversation marked as viewed' })
  @ApiResponse({ status: 400, description: 'Invalid id or conversation name' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: READ_FORBIDDEN })
  @ApiResponse({
    status: 404,
    description: 'The project or the conversation does not exist',
  })
  markProjectConversationViewed(
    @Param() { id, conversationName }: ProjectConversationParamDto,
    @Req() req: Request,
  ): Promise<void> {
    const { at, bucket } = req.user as SessionUser;
    return this.conversationsService.markViewed(
      requireProjectId(id),
      conversationName,
      at,
      bucket,
    );
  }

  /* Write check first, so a read-only project never reaches the model or a Core write; then the body path must name a conversation of `:id`. */
  private async resolveWritableLocator(
    id: string,
    path: string,
    req: Request,
  ): Promise<string> {
    const project = requireProjectId(id);
    const { at, bucket } = req.user as SessionUser;
    await this.accessService.assertCanWrite(project, bucket, at);
    return this.conversationsService.resolveCompletionLocator(project, path);
  }
}
