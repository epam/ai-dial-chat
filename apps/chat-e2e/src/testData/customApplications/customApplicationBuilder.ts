import { ApiApplicationModelRegular } from '@/chat/types/applications';
import { ExpectedConstants } from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';
import { webcrypto } from 'node:crypto';

export class CustomApplicationBuilder {
  private customApplication: ApiApplicationModelRegular;

  getCustomApplication(): ApiApplicationModelRegular {
    return this.customApplication;
  }

  constructor() {
    this.customApplication = this.reset();
  }

  private reset(): ApiApplicationModelRegular {
    this.customApplication = {
      display_name: GeneratorUtil.randomString(7),
      display_version: ExpectedConstants.defaultAppVersion,
      endpoint: ExpectedConstants.appDefaultCompletionUrl,
      icon_url: '',
      description: '',
      input_attachment_types: [],
      description_keywords: [],
      reference: webcrypto.randomUUID(),
    };
    return this.customApplication;
  }

  withDisplayName(displayName: string): CustomApplicationBuilder {
    this.customApplication.display_name = displayName;
    return this;
  }

  withDisplayVersion(displayVersion: string): CustomApplicationBuilder {
    this.customApplication.display_version = displayVersion;
    return this;
  }

  withDescriptionKeywords(...keywords: string[]): CustomApplicationBuilder {
    this.customApplication.description_keywords = keywords;
    return this;
  }

  withDescription(description: string): CustomApplicationBuilder {
    this.customApplication.description = description;
    return this;
  }

  withFeaturesData(features: Record<string, string>): CustomApplicationBuilder {
    this.customApplication.features = JSON.parse(JSON.stringify(features));
    return this;
  }

  withInputAttachmentTypes(
    ...attachmentTypes: string[]
  ): CustomApplicationBuilder {
    this.customApplication.input_attachment_types = attachmentTypes;
    return this;
  }

  withMaxInputAttachments(maxAttachments: number): CustomApplicationBuilder {
    this.customApplication.max_input_attachments = maxAttachments;
    return this;
  }

  withIconUrl(iconUrl: string): CustomApplicationBuilder {
    this.customApplication.icon_url = iconUrl;
    return this;
  }

  build(): ApiApplicationModelRegular {
    const customApplication = { ...this.customApplication };
    this.reset();
    return customApplication;
  }
}
