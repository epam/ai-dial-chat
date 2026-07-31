import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { EnvironmentVariables } from '../../config/environment.config';
import type {
  AppConfigEvalContext,
  ConfigDefinition,
  ConfigProvider,
} from '../app-config.types';
import { CustomVisualizerDto } from '../dto/custom-visualizer.dto';
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

    // customVisualizers is a JSON array requiring full parse + per-entry validation
    if (key === 'customVisualizers') {
      const raw = this.configService.get('CUSTOM_VISUALIZERS', {
        infer: true,
      });
      if (!raw) {
        return undefined;
      }
      return this.parseCustomVisualizers(raw);
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

  /**
   * Parses `CUSTOM_VISUALIZERS` fail-open: invalid JSON or a non-array
   * yields `[]`; each entry is validated independently, so one malformed
   * entry never drops the others. Unrecognized fields on an entry (e.g.
   * deferred `development`-only fields) are logged and ignored, never
   * causing the entry itself to be dropped.
   */
  private parseCustomVisualizers(raw: string): CustomVisualizerDto[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.error(
        'CUSTOM_VISUALIZERS is not valid JSON; resolving to an empty registry',
      );
      return [];
    }

    if (!Array.isArray(parsed)) {
      this.logger.error(
        'CUSTOM_VISUALIZERS must be a JSON array; resolving to an empty registry',
      );
      return [];
    }

    const entries: CustomVisualizerDto[] = [];

    parsed.forEach((rawEntry: unknown, index: number) => {
      if (typeof rawEntry !== 'object' || rawEntry === null) {
        this.logger.error(
          `CUSTOM_VISUALIZERS[${index}] is not an object; dropping entry`,
        );
        return;
      }

      const dto = plainToInstance(CustomVisualizerDto, rawEntry);
      const errors = validateSync(dto);
      if (errors.length > 0) {
        this.logger.error(
          `CUSTOM_VISUALIZERS[${index}] failed validation, dropping entry: ${errors
            .map((error) => Object.values(error.constraints ?? {}).join(', '))
            .join('; ')}`,
        );
        return;
      }

      if (
        dto.contentType
          .split(',')
          .map((mime) => mime.trim())
          .filter((mime) => mime.length > 0).length === 0
      ) {
        this.logger.error(
          `CUSTOM_VISUALIZERS[${index}] has no usable MIME type in "contentType"; dropping entry`,
        );
        return;
      }

      // `title` needs no check beyond @IsNotEmpty() above: it is an opaque
      // postMessage namespace, and a whitespace-only value is a legitimate
      // `appName` for some deployed visualizers, so it is never trimmed.
      const knownFields = new Set([
        'title',
        'description',
        'icon',
        'contentType',
        'url',
        'requestTimeout',
        'width',
        'height',
        'mobileHeight',
        'passAuthInfo',
        'passExplicitToken',
      ]);
      const unknownKeys = Object.keys(rawEntry as object).filter(
        (k) => !knownFields.has(k),
      );
      if (unknownKeys.length > 0) {
        this.logger.warn(
          `CUSTOM_VISUALIZERS[${index}] contains unrecognized fields that will be ignored: ${unknownKeys.join(', ')}`,
        );
      }

      entries.push({
        title: dto.title,
        description: dto.description,
        icon: dto.icon,
        contentType: dto.contentType,
        url: dto.url,
        requestTimeout: dto.requestTimeout,
        width: dto.width,
        height: dto.height,
        mobileHeight: dto.mobileHeight,
        passAuthInfo: dto.passAuthInfo,
        passExplicitToken: dto.passExplicitToken,
      });
    });

    return entries;
  }
}
