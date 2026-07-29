import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/environment.config';
import type {
  AppConfigEvalContext,
  ConfigDefinition,
  ConfigProvider,
} from '../app-config.types';
import { CONFIG_DEFINITIONS } from './config-registry.constants';

const FILE_MANAGER_ALLOWED_TABS = ['my_files', 'shared', 'organization'];

@Injectable()
export class EnvConfigProvider implements ConfigProvider {
  private readonly logger = new Logger(EnvConfigProvider.name);

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  async resolve(
    key: string,
    context: AppConfigEvalContext,
  ): Promise<unknown | undefined> {
    const definition = CONFIG_DEFINITIONS.find((d) => d.key === key);
    if (!definition) {
      return undefined;
    }

    // features.asrEnabled is derived from ASR_MODEL presence, not a direct env var
    if (key === 'features.asrEnabled') {
      const asrModel = this.configService.get('ASR_MODEL', { infer: true });
      if (asrModel == null) return undefined;
      return this.applyRoleGating(definition, context, true);
    }

    // features.llmConversationNaming requires UTILITY_MODEL, DIAL_API_KEY, and explicit opt-in
    if (key === 'features.llmConversationNaming') {
      const utilityModel = this.configService.get('UTILITY_MODEL', {
        infer: true,
      });
      const dialApiKey = this.configService.get('DIAL_API_KEY', {
        infer: true,
      });
      if (!utilityModel || !dialApiKey) return undefined;
      const enabled = this.configService.get(
        'LLM_CONVERSATION_NAMING_ENABLED',
        {
          infer: true,
        },
      );
      return enabled === true;
    }

    // features.footer is derived from FOOTER_HTML_MESSAGE presence
    if (key === 'features.footer') {
      const footerHtml = this.configService.get('FOOTER_HTML_MESSAGE', {
        infer: true,
      });
      if (footerHtml == null) return undefined;
      return true;
    }

    // features.requestApiKey is derived from REQUEST_API_KEY_CODE presence
    if (key === 'features.requestApiKey') {
      const code = this.configService.get('REQUEST_API_KEY_CODE', {
        infer: true,
      });
      if (code == null) return undefined;
      return true;
    }

    // features.reportAnIssue is derived from REPORT_ISSUE_CODE presence
    if (key === 'features.reportAnIssue') {
      const code = this.configService.get('REPORT_ISSUE_CODE', { infer: true });
      if (code == null) return undefined;
      return true;
    }

    // fileManager.availableTabs is validated against a fixed allow-list, dropping unknown ids
    if (key === 'fileManager.availableTabs') {
      const availableTabs = this.configService.get(
        'FILE_MANAGER_AVAILABLE_TABS',
        { infer: true },
      );
      if (!availableTabs?.length) return undefined;
      const filtered = availableTabs.filter((tab) =>
        FILE_MANAGER_ALLOWED_TABS.includes(tab),
      );
      if (!filtered.length) return undefined;
      return filtered;
    }

    if (!definition.envVar) {
      return undefined;
    }

    const rawValue = this.configService.get(definition.envVar, { infer: true });
    if (rawValue == null) {
      return undefined;
    }

    if (!this.isValidType(key, rawValue, definition.valueType)) {
      this.logger.warn(
        `Config key "${key}" has a type mismatch: expected ${definition.valueType}, got ${typeof rawValue}`,
      );
      return undefined;
    }

    return this.applyRoleGating(definition, context, rawValue);
  }

  /**
   * When `definition.allowedRolesEnvVar` is set and the env var is non-empty,
   * the resolved value is only returned for users whose roles include at least
   * one entry from the allowed list. An absent or empty roles env var means
   * the feature is unrestricted (all users receive the value).
   */
  private applyRoleGating(
    definition: ConfigDefinition,
    context: AppConfigEvalContext,
    resolvedValue: unknown,
  ): unknown {
    if (!definition.allowedRolesEnvVar) {
      return resolvedValue;
    }

    const allowedRoles = this.configService.get(definition.allowedRolesEnvVar, {
      infer: true,
    }) as string[] | undefined;

    if (!allowedRoles?.length) {
      return resolvedValue; // no restriction configured
    }

    const userRoles = context.roles ?? [];
    if (allowedRoles.some((r) => userRoles.includes(r))) {
      return resolvedValue;
    }

    this.logger.debug(
      `Key "${definition.key}" restricted: user roles [${userRoles.join(', ')}] not in allowed [${allowedRoles.join(', ')}]`,
    );
    return false;
  }

  private isValidType(key: string, value: unknown, valueType: string): boolean {
    if (valueType === 'number') {
      const isValid = typeof value === 'number' && !isNaN(value as number);
      if (!isValid) {
        this.logger.warn(`Config key "${key}" value is not a valid number`);
      }
      return isValid;
    }
    if (valueType === 'boolean') {
      return typeof value === 'boolean';
    }
    if (valueType === 'string') {
      return typeof value === 'string';
    }
    return true;
  }
}
