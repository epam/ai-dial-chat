import { ApiTypeSchemaApplication } from '@/chat/types/applications';
import { QuickAppConfig } from '@/chat/types/quick-apps';
import { ApplicationBuilderBase } from '@/src/testData/applications/applicationBuilderBase';

export class ExternalApplicationBuilder extends ApplicationBuilderBase<ApiTypeSchemaApplication> {
  withApplicationTypeSchemaId(schemaId: string): this {
    this.application.application_type_schema_id = schemaId;
    return this;
  }

  withApplicationProperties(
    properties: QuickAppConfig | Record<string, unknown> | null,
  ): this {
    this.application.application_properties = properties;
    return this;
  }

  withExternalUrl(externalUrl: string): this {
    if (
      !this.application.application_properties ||
      typeof this.application.application_properties !== 'object'
    ) {
      this.application.application_properties = {
        external_url: externalUrl,
        document_relative_url: [],
      };
    } else {
      this.application.application_properties = {
        ...this.application.application_properties,
        external_url: externalUrl,
        document_relative_url:
          this.application.application_properties.document_relative_url || [],
      };
    }
    return this;
  }

  withDocumentRelativeUrl(urls: string[]): this {
    if (
      !this.application.application_properties ||
      typeof this.application.application_properties !== 'object'
    ) {
      this.application.application_properties = {
        external_url: '',
        document_relative_url: urls,
      };
    } else {
      this.application.application_properties = {
        ...this.application.application_properties,
        document_relative_url: urls,
      };
    }
    return this;
  }

  protected reset(): ApiTypeSchemaApplication {
    this.application = super.reset();
    this.application.application_type_schema_id = '';
    this.application.application_properties = null;
    return this.application;
  }
}
