import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/environment.config';
import { ExplicitEnvironment } from '../../config/explicit-environment';
import type { AppConfigEvalContext, ConfigProvider } from '../app-config.types';
import type { AdmissionLog } from '../env-admission/admission-log';
import { admitAnnouncements } from '../env-admission/announcements.admission';
import {
  admitContentLocales,
  isLegacyContentLocalesInEffect,
} from '../env-admission/content-locales.admission';
import { admitCustomVariables } from '../env-admission/custom-variables.admission';
import { admitFileManagerTabs } from '../env-admission/file-manager-tabs.admission';
import { admitPublicationFilterSources } from '../env-admission/publication-filter-sources.admission';
import {
  admitApplicationVisualizers,
  admitCustomVisualizers,
} from '../env-admission/visualizers.admission';
import {
  CAPABILITY_FEATURE_KEYS,
  deriveCapabilityFeature,
  type CapabilityInputs,
} from '../feature-capabilities';
import { CONFIG_DEFINITIONS } from './config-registry.constants';

@Injectable()
export class EnvConfigProvider implements ConfigProvider, OnModuleInit {
  private readonly logger = new Logger(EnvConfigProvider.name);
  /* Bound here so admission messages keep this provider's Logger context. */
  private readonly admissionLog: AdmissionLog = {
    warn: (message) => this.logger.warn(message),
    error: (message) => this.logger.error(message),
  };

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables>,
    private readonly explicitEnvironment: ExplicitEnvironment,
  ) {}

  onModuleInit(): void {
    if (
      isLegacyContentLocalesInEffect(
        this.configService.get('ADDITIONAL_CONTENT_LOCALES', { infer: true }),
        this.configService.get('AVAILABLE_LOCALES', { infer: true }),
      )
    ) {
      this.logger.warn(
        'AVAILABLE_LOCALES is deprecated; rename it to ADDITIONAL_CONTENT_LOCALES. It is read only while ADDITIONAL_CONTENT_LOCALES is unset.',
      );
    }
  }

  /* `context` is part of the provider contract; ENV values do not vary by
   * caller now that role gating runs after selection. */
  async resolve(
    key: string,
    _context: AppConfigEvalContext,
  ): Promise<unknown | undefined> {
    const definition = CONFIG_DEFINITIONS.find((d) => d.key === key);
    if (!definition) {
      return undefined;
    }

    if (key === 'ui.activeEventId') {
      const eventId = this.configService.get('UI_EVENT', { infer: true });
      return eventId === 'none' ? null : eventId;
    }

    /* features.asrEnabled, features.llmConversationNaming and features.footer
     * are derived from local capabilities, not read from a variable of their
     * own. Role gating is not applied here: AppConfigService applies it after
     * selection, for every source. */
    if (CAPABILITY_FEATURE_KEYS.some((featureKey) => featureKey === key)) {
      return deriveCapabilityFeature(key, this.readCapabilityInputs());
    }

    // fileManager.availableTabs is validated against a fixed allow-list, dropping unknown ids
    if (key === 'fileManager.availableTabs') {
      return admitFileManagerTabs(
        this.configService.get('FILE_MANAGER_AVAILABLE_TABS', { infer: true }),
      );
    }

    // publish.publicationFilterSources falls back to the registry default when unset/empty
    if (key === 'publish.publicationFilterSources') {
      return admitPublicationFilterSources(
        this.configService.get('PUBLICATION_FILTER_SOURCES', { infer: true }),
      );
    }

    /*
     * content.additionalLocales: ADDITIONAL_CONTENT_LOCALES wins whenever it is
     * present (even empty); the deprecated AVAILABLE_LOCALES is read only when
     * it is absent.
     */
    if (key === 'content.additionalLocales') {
      return admitContentLocales(
        this.configService.get('ADDITIONAL_CONTENT_LOCALES', { infer: true }),
        this.configService.get('AVAILABLE_LOCALES', { infer: true }),
      );
    }

    if (key === 'customVisualizers') {
      return admitCustomVisualizers(
        this.configService.get('CUSTOM_VISUALIZERS', { infer: true }),
        this.admissionLog,
      );
    }

    if (key === 'applicationVisualizers') {
      return admitApplicationVisualizers(
        this.configService.get('APPLICATION_VISUALIZERS', { infer: true }),
        this.configService.get('ALLOWED_IFRAME_ORIGINS', { infer: true }) ?? [],
        this.admissionLog,
      );
    }

    /* ANNOUNCEMENTS is a JSON array. The generic path below would hand the raw
     * string straight through — `isValidType` does not check 'json' — so it is
     * admitted here, like customVisualizers. Entry-level validation stays in
     * the shared client-config normalization. */
    if (key === 'announcement.items') {
      return admitAnnouncements(
        this.configService.get('ANNOUNCEMENTS', { infer: true }),
        this.admissionLog,
      );
    }

    if (key === 'customVariables') {
      return admitCustomVariables(
        this.configService.get('CUSTOM_CLIENT_VARIABLES', { infer: true }),
        this.admissionLog,
      );
    }

    /* A variable that only holds its typed default is not an operator value,
     * so the next provider (the registry default) applies. */
    if (
      !definition.envVar ||
      !this.explicitEnvironment.isExplicit(definition.envVar)
    ) {
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

    return rawValue;
  }

  private readCapabilityInputs(): CapabilityInputs {
    return {
      asrModel: this.configService.get('ASR_MODEL', { infer: true }),
      utilityModel: this.configService.get('UTILITY_MODEL', { infer: true }),
      dialApiKey: this.configService.get('DIAL_API_KEY', { infer: true }),
      llmConversationNamingEnabled: this.configService.get(
        'LLM_CONVERSATION_NAMING_ENABLED',
        { infer: true },
      ),
      footerHtmlMessage: this.configService.get('FOOTER_HTML_MESSAGE', {
        infer: true,
      }),
    };
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
