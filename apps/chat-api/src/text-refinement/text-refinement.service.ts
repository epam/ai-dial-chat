import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FeatureFlagsService } from '../app-config/feature-flags/feature-flags.service';
import { FeatureKey } from '../app-config/feature-flags/feature-key.enum';
import type { SessionUser } from '../auth/session/session.types';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { resolvePrompt } from '../common/utils/resolve-prompt';
import { EnvironmentVariables } from '../config/environment.config';
import { DialClientService } from '../dial/dial-client.service';
import {
  RefineTextRequestDto,
  RefineTextResponseDto,
  TEXT_REFINEMENT_LIMITS,
  TextRefinementPurpose,
} from './dto/refine-text.dto';
import { SCHEDULED_TASK_DESCRIPTION_PROMPT } from './prompts/scheduled-task-description.prompt';
import { SCHEDULED_TASK_INSTRUCTIONS_PROMPT } from './prompts/scheduled-task-instructions.prompt';
import { SKILL_DESCRIPTION_PROMPT } from './prompts/skill-description.prompt';
import { SKILL_INSTRUCTIONS_PROMPT } from './prompts/skill-instructions.prompt';

@Injectable()
export class TextRefinementService {
  private readonly logger = new Logger(TextRefinementService.name);

  constructor(
    private readonly config: ConfigService<EnvironmentVariables>,
    private readonly dialClient: DialClientService,
    private readonly features: FeatureFlagsService,
  ) {}

  async refineText(
    dto: RefineTextRequestDto,
    user: SessionUser | undefined,
    signal: AbortSignal,
  ): Promise<RefineTextResponseDto> {
    if (!user?.at) throw new UnauthorizedException();
    const limit = TEXT_REFINEMENT_LIMITS[dto.purpose];
    if (
      !limit ||
      typeof dto.text !== 'string' ||
      !dto.text.trim() ||
      [...dto.text].length > limit
    ) {
      throw new BadRequestException(
        'Invalid text for the selected refinement purpose',
      );
    }
    if (
      dto.purpose === TextRefinementPurpose.ScheduledTaskDescription ||
      dto.purpose === TextRefinementPurpose.ScheduledTaskInstructions
    ) {
      const roles = user.claims['roles'];
      if (
        !(await this.features.isEnabled(FeatureKey.ScheduledTasksEnabled, {
          appId: 'chat-ui',
          userId: user.sub,
          roles: Array.isArray(roles)
            ? roles.filter((role): role is string => typeof role === 'string')
            : undefined,
        }))
      )
        throw new ForbiddenException('Scheduled tasks are not enabled');
    }
    const model = this.config.get('UTILITY_MODEL', { infer: true })?.trim();
    if (!model)
      throw new ServiceUnavailableException('Text refinement is unavailable');
    const defaultPrompt = {
      [TextRefinementPurpose.SkillDescription]: SKILL_DESCRIPTION_PROMPT,
      [TextRefinementPurpose.SkillInstructions]: SKILL_INSTRUCTIONS_PROMPT,
      [TextRefinementPurpose.ScheduledTaskDescription]:
        SCHEDULED_TASK_DESCRIPTION_PROMPT,
      [TextRefinementPurpose.ScheduledTaskInstructions]:
        SCHEDULED_TASK_INSTRUCTIONS_PROMPT,
    }[dto.purpose];
    const promptKey = {
      [TextRefinementPurpose.SkillDescription]:
        'TEXT_REFINEMENT_SKILL_DESCRIPTION_PROMPT',
      [TextRefinementPurpose.SkillInstructions]:
        'TEXT_REFINEMENT_SKILL_INSTRUCTIONS_PROMPT',
      [TextRefinementPurpose.ScheduledTaskDescription]:
        'TEXT_REFINEMENT_SCHEDULED_TASK_DESCRIPTION_PROMPT',
      [TextRefinementPurpose.ScheduledTaskInstructions]:
        'TEXT_REFINEMENT_SCHEDULED_TASK_INSTRUCTIONS_PROMPT',
    } as const;
    const prompt = resolvePrompt(
      this.config.get(promptKey[dto.purpose], { infer: true }),
      defaultPrompt,
    );

    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    const timeout = setTimeout(abort, 30_000);
    let rejectAborted: (() => void) | undefined;
    try {
      const aborted = new Promise<never>((_resolve, reject) => {
        rejectAborted = () =>
          reject(
            new ServiceUnavailableException('Text refinement is unavailable'),
          );
        controller.signal.addEventListener('abort', rejectAborted, {
          once: true,
        });
        if (controller.signal.aborted) rejectAborted();
      });
      if (controller.signal.aborted) return await aborted;
      const result = await Promise.race([
        this.dialClient.client.sendChatCompletionRequest(model, {
          /* The SDK schema marks optional sampling controls as required; use the same
           * request-body boundary as conversation naming and leave model defaults intact. */
          body: {
            messages: [
              { role: 'system', content: prompt },
              { role: 'user', content: dto.text },
            ],
            stream: false,
          } as Parameters<
            DialClientService['client']['sendChatCompletionRequest']
          >[1]['body'],
          headers: getBearerAuthHeaders(user.at),
          params: { query: { 'api-version': this.dialClient.dialApiVersion } },
          signal: controller.signal,
        }),
        aborted,
      ]);
      if (result.response.status === 403)
        throw new ForbiddenException('Text refinement is not permitted');
      if (result.response.status === 429)
        throw new HttpException(
          {
            statusCode: 429,
            error: 'Too Many Requests',
            message: 'Text refinement quota exceeded',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      if (!result.response.ok || result.error != null)
        throw new BadGatewayException('Text refinement failed');
      const data: unknown = result.data;
      const choices =
        typeof data === 'object' && data !== null && 'choices' in data
          ? data.choices
          : undefined;
      const choice = (Array.isArray(choices) ? choices[0] : undefined) as
        | {
            finish_reason?: unknown;
            message?: { content?: unknown };
          }
        | undefined;
      const text = choice?.message?.content;
      if (
        choice?.finish_reason !== 'stop' ||
        typeof text !== 'string' ||
        !text.trim() ||
        [...text].length > limit
      ) {
        throw new BadGatewayException('Invalid text refinement response');
      }
      return { text };
    } catch (error) {
      /* Never pass SDK errors or response bodies to logging: they can contain the draft. */
      const status = error instanceof HttpException ? error.getStatus() : 503;
      this.logger.warn(
        `Text refinement failed: purpose=${dto.purpose} status=${status}`,
      );
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Text refinement is unavailable');
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      if (rejectAborted)
        controller.signal.removeEventListener('abort', rejectAborted);
    }
  }
}
