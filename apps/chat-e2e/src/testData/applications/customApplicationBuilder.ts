import { ApiApplicationModelRegular } from '@/chat/types/applications';
import { ExpectedConstants } from '@/src/testData';
import { ApplicationBuilderBase } from '@/src/testData/applications/applicationBuilderBase';

export class CustomApplicationBuilder extends ApplicationBuilderBase<ApiApplicationModelRegular> {
  withEndpoint(endpoint: string): this {
    this.application.endpoint = endpoint;
    return this;
  }

  protected reset(): ApiApplicationModelRegular {
    this.application = super.reset();
    this.application.endpoint = ExpectedConstants.defaultEntityUrl;
    return this.application;
  }
}
