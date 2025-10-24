import { ApiApplicationModelRegular } from '@/chat/types/applications';
import { ExpectedConstants } from '@/src/testData';
import { ApplicationBuilderBase } from '@/src/testData/applications/applicationBuilderBase';
import { GeneratorUtil } from '@/src/utils';
import { webcrypto } from 'node:crypto';

export class CustomApplicationBuilder extends ApplicationBuilderBase<ApiApplicationModelRegular> {
  withEndpoint(endpoint: string): this {
    this.application.endpoint = endpoint;
    return this;
  }

  protected reset(): ApiApplicationModelRegular {
    this.application = {
      display_name: GeneratorUtil.randomString(7),
      display_version: ExpectedConstants.defaultAppVersion,
      endpoint: ExpectedConstants.appDefaultCompletionUrl,
      icon_url: '',
      description: '',
      input_attachment_types: [],
      description_keywords: [],
      reference: webcrypto.randomUUID(),
    };
    return this.application;
  }
}
