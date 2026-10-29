import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { AppConfigEvalContext } from '../../app-config/app-config.types';
import { FeatureFlagsService } from '../../app-config/feature-flags/feature-flags.service';
import { FeatureKey } from '../../app-config/feature-flags/feature-key.enum';
import { StringUtils } from '../../common/utils/string-utils';
import { DeploymentsService } from '../../deployments/deployments.service';
import { GenerationApi, resolveGenerationApi } from './generation-api';
import type { GenerationApiSelection } from './generation.types';

const SERVER_APP_CONFIG_CONTEXT: AppConfigEvalContext = { appId: 'chat-api' };

/** DIAL Core interface name advertising full Responses support, including background jobs. */
const OPENAI_RESPONSES_INTERFACE = 'openaiResponses';

/**
 * Chooses the generation API for one completion from the deployment's
 * `features`, the Responses feature flags and, for background mode, the
 * deployment's DIAL Core `interfaces`.
 */
@Injectable()
export class GenerationApiSelector {
  private readonly logger = new Logger(GenerationApiSelector.name);

  constructor(
    private readonly deploymentsService: DeploymentsService,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  /**
   * Resolves the generation API and request capabilities for `model`; rejects a
   * toolset with `BadRequestException`.
   * @param sub - caller's subject
   * @param model - deployment id
   * @param token - caller's bearer token
   */
  async select(
    sub: string,
    model: string,
    token: string,
  ): Promise<GenerationApiSelection> {
    /*
     * getDeploymentDetails is not skipped when features.responsesApiEnabled is
     * disabled — it also performs the toolset rejection and temperature-
     * capability derivation below, neither of which is specific to the
     * Responses API. Resolved concurrently with the feature flag so a
     * disabled (default) flag adds no sequential latency.
     */
    const [details, responsesApiEnabled, responsesBackgroundEnabled] =
      await Promise.all([
        this.deploymentsService.getDeploymentDetails(sub, model, token),
        this.featureFlagsService.isEnabled(
          FeatureKey.ResponsesApiEnabled,
          SERVER_APP_CONFIG_CONTEXT,
        ),
        this.featureFlagsService.isEnabled(
          FeatureKey.ResponsesBackgroundEnabled,
          SERVER_APP_CONFIG_CONTEXT,
        ),
      ]);

    if (details.type === 'toolset') {
      const safeModel = StringUtils.sanitizeForLog(model);
      throw new BadRequestException(
        `Deployment "${safeModel}" is a toolset and cannot be used for generation`,
      );
    }

    const features =
      details.type === 'application'
        ? details.applicationDetails?.features
        : details.modelDetails?.features;

    const generationApi = responsesApiEnabled
      ? resolveGenerationApi(features)
      : GenerationApi.ChatCompletions;

    /*
     * Background mode is a sub-mode of Responses: `interfaces` is read only when
     * Responses is already selected and the background flag is on, so a disabled
     * flag adds no Core call.
     */
    const isBackground =
      generationApi === GenerationApi.Responses &&
      responsesBackgroundEnabled &&
      (await this.readDeploymentInterfaces(sub, model, token)).includes(
        OPENAI_RESPONSES_INTERFACE,
      );

    const safeModel = StringUtils.sanitizeForLog(model);
    this.logger.debug(
      `Generation API resolved for "${safeModel}" — api: ${generationApi}, background: ${isBackground}, responsesApiEnabled: ${responsesApiEnabled}, responsesBackgroundEnabled: ${responsesBackgroundEnabled}, deployment.responsesApi: ${features?.responsesApi ?? false}`,
    );

    return {
      generationApi,
      isBackground,
      temperatureSupported: features?.temperature === true,
      reasoningEfforts: features?.reasoningEfforts,
    };
  }

  /**
   * Reads the deployment's DIAL Core `interfaces`; any failure means "not eligible for
   * the background path" and never fails the completion request.
   * @param sub - caller's subject
   * @param model - deployment id
   * @param token - caller's bearer token
   */
  private async readDeploymentInterfaces(
    sub: string,
    model: string,
    token: string,
  ): Promise<string[]> {
    try {
      return await this.deploymentsService.getDeploymentInterfaces(
        sub,
        model,
        token,
      );
    } catch (err) {
      this.logger.warn(
        `Deployment interfaces lookup failed for "${StringUtils.sanitizeForLog(model)}"; using the stateless path`,
        err,
      );
      return [];
    }
  }
}
