import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DeploymentsService } from '../deployments/deployments.service';
import { SchedulerConsentService } from '../external-services/scheduler-consent.service';
import { SchedulerServiceConsentStatus } from '../external-services/types/scheduler-service-consent-status.enum';
import type { CreateScheduledTaskBodyDto } from './dto/create-scheduled-task.dto';
import { SchedulerUpstreamClient } from './scheduler-upstream.client';
import { ScheduledTaskErrorCode } from './types/scheduled-task-error-code.enum';

/**
 * Checks that must pass before a scheduled-task operation reaches DIAL
 * Scheduler: the DIAL_NATIVE application consent and the model/skill
 * configuration. Runs inside the operation, after DTO validation.
 */
@Injectable()
export class ScheduledTaskPreconditionsService {
  private readonly logger = new Logger(ScheduledTaskPreconditionsService.name);

  constructor(
    private readonly schedulerConsentService: SchedulerConsentService,
    private readonly deploymentsService: DeploymentsService,
    private readonly upstream: SchedulerUpstreamClient,
  ) {}

  /*
   * A DIAL_NATIVE scheduler service runs every schedule on the user's behalf
   * under an application consent an administrator can revoke at any time.
   * Once revoked, DIAL Scheduler only fails later with an opaque 5xx, so the
   * consent is read fresh (never cached) before every operation that makes a
   * schedule run. Only an explicit SIGNED_OUT blocks: a failed lookup or a
   * status Core does not report leaves the decision to DIAL Scheduler itself.
   */
  async assertSchedulerConsent(accessToken: string): Promise<void> {
    const consent =
      await this.schedulerConsentService.getSchedulerServiceConsent(
        accessToken,
      );
    if (consent === SchedulerServiceConsentStatus.SignedOut) {
      this.logger.warn(
        `Scheduler service "${this.upstream.getSchedulerServiceId()}" has no application consent; rejecting the operation`,
      );
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: ScheduledTaskErrorCode.AdminConsentRequired,
        message:
          "A DIAL administrator must approve this application's access before you can continue.",
      });
    }
  }

  async validateConfiguration(
    body: CreateScheduledTaskBodyDto,
    accessToken: string,
    bucket: string,
  ): Promise<void> {
    if (!body.prompt.trim() && !body.skillUrls?.length) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: ScheduledTaskErrorCode.InstructionsOrSkillRequired,
        field: 'prompt',
        message: 'Choose a skill or write instructions.',
      });
    }
    if (!body.skillUrls?.length) return;

    const unavailable = {
      code: ScheduledTaskErrorCode.DeploymentUnavailable,
      field: 'model',
      message: 'Selected model is unavailable.',
    };
    let deployment;
    try {
      deployment = await this.deploymentsService.resolveDeploymentItem(
        body.model,
        accessToken,
        bucket,
      );
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw new ForbiddenException({
          ...unavailable,
          statusCode: 403,
          error: 'Forbidden',
        });
      }
      if (!(error instanceof NotFoundException)) throw error;
    }
    if (!deployment) {
      throw new NotFoundException({
        ...unavailable,
        statusCode: 404,
        error: 'Not Found',
      });
    }
    if (deployment.features?.skillsSupported !== true) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: ScheduledTaskErrorCode.SkillUnsupported,
        field: 'skillUrls',
        message:
          'Selected model does not support skills. Remove the skill or select different model to proceed.',
      });
    }
  }
}
