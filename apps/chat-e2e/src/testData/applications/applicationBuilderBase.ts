import { ApiApplicationModelBase } from '@/chat/types/applications';
import { QuickAppConfig } from '@/chat/types/quick-apps';
import { ExpectedConstants } from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';
import { webcrypto } from 'node:crypto';

export class ApplicationBuilderBase<T extends ApiApplicationModelBase> {
  protected application: T;

  constructor() {
    this.application = this.reset();
  }

  protected reset(): T {
    this.application = {
      display_name: GeneratorUtil.randomString(7),
      display_version: ExpectedConstants.defaultAppVersion,
      icon_url: '',
      description: '',
      input_attachment_types: [],
      description_keywords: [],
      reference: webcrypto.randomUUID(),
    } as unknown as T;
    return this.application;
  }

  withDisplayName(displayName: string): this {
    this.application.display_name = displayName;
    return this;
  }

  withDisplayVersion(displayVersion: string): this {
    this.application.display_version = displayVersion;
    return this;
  }

  withDescriptionKeywords(...keywords: string[]): this {
    this.application.description_keywords = keywords;
    return this;
  }

  withDescription(description: string): this {
    this.application.description = description;
    return this;
  }

  withFeaturesData(features: Record<string, string>): this {
    this.application.features = JSON.parse(JSON.stringify(features));
    return this;
  }

  withInputAttachmentTypes(...attachmentTypes: string[]): this {
    this.application.input_attachment_types = attachmentTypes;
    return this;
  }

  withMaxInputAttachments(maxAttachments: number): this {
    this.application.max_input_attachments = maxAttachments;
    return this;
  }

  withIconUrl(iconUrl: string): this {
    this.application.icon_url = iconUrl;
    return this;
  }

  withUrl(url: string): this {
    this.application.url = url;
    return this;
  }

  withReference(reference: string): this {
    this.application.reference = reference;
    return this;
  }

  withDefaults(defaults: Record<string, unknown>): this {
    this.application.defaults = defaults;
    return this;
  }

  withApplicationTypeSchemaId(schemaId: string): this {
    this.application.applicationTypeSchemaId = schemaId;
    return this;
  }

  withApplicationProperties(
    properties: QuickAppConfig | Record<string, unknown>,
  ): this {
    this.application.applicationProperties = properties;
    return this;
  }

  build(): T {
    const builtApplication = { ...this.application };
    this.reset();
    return builtApplication;
  }
}
